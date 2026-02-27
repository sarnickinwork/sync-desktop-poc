/**
 * Original Transcript Parser for DVT Generation (Universal Version)
 *
 * Handles multiple court transcript formats by parsing explicit line numbers
 * (e.g. `00001:01`, `  1`, `        25`) that appear on the left margin.
 *
 * Algorithm:
 * 1. Split text into pages (using \f if present, else it's one large "page").
 * 2. For pages with explicit line numbers (majority of cases):
 *    - Extract the explicit line number.
 *    - All following text until the next explicitly numbered line is considered
 *      a continuation of that line.
 *    - Record the physical line spacing grid (e.g. 2 physical rows per logical line)
 *      to handle unnumbered pages.
 * 3. For pages without explicit line numbers (e.g. cover pages):
 *    - Project the physical line spacing grid computed from numbered pages.
 *    - Map physical rows strictly to logical lines 1-25.
 *    - This brilliantly aligns items like "CASSIE DENISE MCKINNEY" exactly to their
 *      logical line (e.g. Line 4) by mapping physical blanks back to their grid positions.
 */

export interface OriginalTranscriptLine {
  pageNo: number;
  lineNo: number;
  text: string;
  isContinuation: boolean;
}

// Regex to detect explicit line numbers (1-25) at start of line
// Matches: "  00001:01", " 1 ", "       25"
const EXPLICIT_LINE_REGEX = /^\s*(?:\d{1,5}:)?0*([1-9]|1[0-9]|2[0-5])(?=\s|$)/;

// Standalone page headers to ignore (e.g. "       1      ")
const PAGE_HEADER_REGEX = /^\s*(\d{1,3})\s*$/;

export function parseOriginalTranscript(
  content: string,
  maxLines: number = 25,
): OriginalTranscriptLine[] {
  const hasFF = content.includes("\f");
  const rawPages = hasFF ? content.split("\f") : [content];

  // Intermediate parsing representations
  const parsedPages: {
    isExplicit: boolean;
    lines: string[];
    parsed: OriginalTranscriptLine[];
  }[] = [];

  let globalPageNo = 1;

  // Pass 1: Parse explicitly numbered pages and build grid mechanics
  for (let pIdx = 0; pIdx < rawPages.length; pIdx++) {
    const rawLines = rawPages[pIdx].split(/\r?\n/);

    let explicitCount = 0;

    // Check for relative line numbers (1-25) on this page
    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i].replace(/\u00A0/g, " ");
      if (PAGE_HEADER_REGEX.test(raw)) continue;

      const match = EXPLICIT_LINE_REGEX.exec(raw);
      if (match) {
        explicitCount++;
      }
    }

    const isExplicit = explicitCount >= 5 || (!hasFF && explicitCount > 0);

    if (isExplicit) {
      // Parse this explicit page using relative line numbers
      const parsed = parseExplicitLines(
        rawLines,
        hasFF ? pIdx + 1 : globalPageNo,
        maxLines,
      );
      parsedPages.push({ isExplicit: true, lines: rawLines, parsed });

      if (parsed.length > 0) {
        globalPageNo = parsed[parsed.length - 1].pageNo; // Advance global page for seamless files
      }
    } else {
      // Unnumbered page (cover page, etc.) — parse but keep physical row indices
      parsedPages.push({ isExplicit: false, lines: rawLines, parsed: [] });
      if (hasFF) globalPageNo++;
    }
  }

  // Pass 2: Fill in unnumbered pages by preserving every physical row as-is
  const result: OriginalTranscriptLine[] = [];

  for (let pIdx = 0; pIdx < parsedPages.length; pIdx++) {
    const page = parsedPages[pIdx];
    if (page.isExplicit) {
      result.push(...page.parsed);
    } else {
      const pageNo = hasFF ? pIdx + 1 : 1;
      const parsed = parseUnnumberedLines(page.lines, pageNo);
      result.push(...parsed);
    }
  }

  return result;
}

/**
 * Parse a page that has explicit line numbers on the left margin.
 * Any text without a line number belongs to the preceding line number as a continuation.
 */
function parseExplicitLines(
  rawLines: string[],
  startPageNo: number,
  maxLines: number,
): OriginalTranscriptLine[] {
  let currentPage = startPageNo;
  let currentLine = 0;

  // Map to group all text pieces by page and line
  // Format: "page" -> "line" -> text[]
  const pageMap = new Map<number, Map<number, string[]>>();

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].replace(/\u00A0/g, " ");
    if (PAGE_HEADER_REGEX.test(raw)) continue;

    const match = EXPLICIT_LINE_REGEX.exec(raw);
    if (match) {
      const fullMatchStr = match[0];
      const parts = fullMatchStr.split(":");
      let lNumStr = parts.length > 1 ? parts[1] : parts[0];
      const lNum = parseInt(lNumStr.replace(/[^0-9]/g, ""));

      if (parts.length > 1) {
        currentPage = parseInt(parts[0].replace(/[^0-9]/g, ""));
      } else if (lNum < currentLine) {
        currentPage++; // Line wrapped back to 1
      }

      currentLine = lNum;
      const textContent = raw.substring(fullMatchStr.length);

      if (!pageMap.has(currentPage)) pageMap.set(currentPage, new Map());
      const lineMap = pageMap.get(currentPage)!;
      if (!lineMap.has(currentLine)) lineMap.set(currentLine, []);

      // Only push content if it's not a complete duplicate block
      // (fixes the issue where the exact same line block gets double-pushed)
      const textToPush = textContent;
      lineMap.get(currentLine)!.push(textToPush);
    } else {
      // Continuation line — skip blank rows (IST format has one blank row between each line)
      if (currentLine > 0 && raw.trim() !== "") {
        if (!pageMap.has(currentPage)) pageMap.set(currentPage, new Map());
        const lineMap = pageMap.get(currentPage)!;
        if (!lineMap.has(currentLine)) lineMap.set(currentLine, []);
        lineMap.get(currentLine)!.push(raw);
      }
    }
  }

  // Build the final array
  const entries: OriginalTranscriptLine[] = [];
  const pagesSeen = Array.from(pageMap.keys()).sort((a, b) => a - b);

  for (const p of pagesSeen) {
    const lineMap = pageMap.get(p)!;
    for (let l = 1; l <= maxLines; l++) {
      const parts = lineMap.get(l) || [];

      if (parts.length === 0) {
        entries.push({ pageNo: p, lineNo: l, text: "", isContinuation: false });
      } else {
        for (let idx = 0; idx < parts.length; idx++) {
          entries.push({
            pageNo: p,
            lineNo: l,
            text: parts[idx].trimEnd(),
            isContinuation: idx > 0,
          });
        }
      }
    }
  }

  return entries;
}

/**
 * Parse an unnumbered page (cover page, title page, etc.).
 *
 * Every physical row is preserved exactly as-is.  The 1-based row index
 * becomes the LineNo so all absolute line positions — including blank rows —
 * are faithfully represented in the DVT.
 *
 * The only row skipped is the standalone page-number header (e.g. "    1   "
 * at the very top) which is a printer artifact, not transcript content.
 */
function parseUnnumberedLines(
  rawLines: string[],
  pageNo: number,
): OriginalTranscriptLine[] {
  const entries: OriginalTranscriptLine[] = [];
  let lineNo = 0; // 1-based physical row counter (skipping the page header)

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].replace(/\u00A0/g, " ");

    // Skip the standalone page-number header line (e.g. "               1")
    if (PAGE_HEADER_REGEX.test(raw)) continue;

    lineNo++;
    entries.push({
      pageNo,
      lineNo,
      text: raw.trimEnd(),
      isContinuation: false,
    });
  }

  return entries;
}



export function getOriginalTranscriptSummary(lines: OriginalTranscriptLine[]) {
  const pages = new Set(lines.map((l) => l.pageNo));
  const contentLines = lines.filter((l) => l.text.trim() !== "");
  const blankLines = lines.filter(
    (l) => l.text.trim() === "" && !l.isContinuation,
  );
  const continuationLines = lines.filter((l) => l.isContinuation);

  return {
    totalEntries: lines.length,
    totalPages: pages.size,
    firstPage: Math.min(...pages),
    lastPage: Math.max(...pages),
    contentLines: contentLines.length,
    blankLines: blankLines.length,
    continuationLines: continuationLines.length,
  };
}
