/**
 * DVT Test Runner
 *
 * Standalone script to generate a DVT file from:
 *   - IST71923willmanFelton.txt (user-provided court transcript)
 *   - assemblyAIResponse.json (AssemblyAI word-level timestamps)
 *
 * Uses the new originalTranscriptParser for correct page/line mapping,
 * then runs DTW alignment separately to attach timestamps.
 *
 * Usage: npx tsx src/utils/dvt-testing/dvtTestRunner.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  parseOriginalTranscript,
  getOriginalTranscriptSummary,
  OriginalTranscriptLine,
} from "./originalTranscriptParser";
import { generateFullDVT, DVTConfig } from "./dvtGenerator";
import { WordDTO } from "../types";
import { sanitizeLineForAlignment } from "../textSanitization";
import { extractWords } from "../textProcessingUtils";
import { getChunkedWordAlignments } from "../dtwAlignmentUtils";

// ─── ESM __dirname shim ─────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────────────

const TRANSCRIPT_FILE = path.join(__dirname, "IST71923willmanFelton.txt");
const AI_RESPONSE_FILE = path.join(__dirname, "assemblyAIResponse.json");
const OUTPUT_FILE = path.join(__dirname, "acd.dvt");

/** Line number in the transcript where spoken audio begins.
 *  Page 4 Line 1 = absolute non-continuation entry #76.
 *  The videographer opens with "Okay. We are on the record." which matches
 *  the first word in assemblyAIResponse.json at 2720ms. */
const START_LINE = 76;

/** Video duration: 41 minutes 21 seconds = 2,481,000 ms */
const VIDEO_DURATION_MS = 41 * 60 * 1000 + 21 * 1000; // 2,481,000

const VIDEO_PATH = String.raw`C:\Users\HP\Downloads\acd\media\JasonKellyWillman.mp4`;
const VIDEO_RELATIVE_PATH = String.raw`\media\JasonKellyWillman.mp4`;

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== DVT Test Runner (v2 — with blank line preservation) ===\n");

  // 1. Read input files
  console.log("[1/6] Reading input files...");

  if (!fs.existsSync(TRANSCRIPT_FILE)) {
    console.error(`Transcript file not found: ${TRANSCRIPT_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(AI_RESPONSE_FILE)) {
    console.error(`AI response file not found: ${AI_RESPONSE_FILE}`);
    process.exit(1);
  }

  const transcriptContent = fs.readFileSync(TRANSCRIPT_FILE, "utf-8");
  const aiResponseRaw = fs.readFileSync(AI_RESPONSE_FILE, "utf-8");
  const aiResponse = JSON.parse(aiResponseRaw);

  console.log(`  AI words: ${aiResponse.words.length}`);

  // 2. Parse transcript using the new form-feed parser
  console.log("\n[2/6] Parsing transcript (form-feed page split)...");

  const parsedLines = parseOriginalTranscript(transcriptContent);
  const summary = getOriginalTranscriptSummary(parsedLines);

  console.log(`  Total entries: ${summary.totalEntries}`);
  console.log(
    `  Pages: ${summary.firstPage} → ${summary.lastPage} (${summary.totalPages} pages)`,
  );
  console.log(`  Content lines: ${summary.contentLines}`);
  console.log(`  Blank lines: ${summary.blankLines}`);
  console.log(`  Continuation lines: ${summary.continuationLines}`);

  // Debug: show first page
  console.log("\n  Page 1 sample:");
  const page1Lines = parsedLines.filter((l) => l.pageNo === 1);
  for (const line of page1Lines.slice(0, 10)) {
    const textPreview = line.text ? line.text.substring(0, 50) : "(blank)";
    console.log(
      `    P${line.pageNo}:L${line.lineNo}${line.isContinuation ? "*" : " "} → "${textPreview}"`,
    );
  }

  // 3. Prepare AI words
  console.log("\n[3/6] Preparing AI transcript...");

  const aiWords: WordDTO[] = aiResponse.words.map((w: any) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));

  console.log(`  Prepared ${aiWords.length} WordDTO entries`);

  // 4. Run DTW alignment between spoken transcript lines and AI words
  console.log("\n[4/6] Running DTW alignment...");

  // Convert START_LINE (absolute) to a page:line position
  // Find which entries should be timestamped
  let absoluteLineCounter = 0;
  const startInfo = { pageNo: 0, lineNo: 0 };

  for (const line of parsedLines) {
    if (!line.isContinuation) {
      absoluteLineCounter++;
    }
    if (absoluteLineCounter === START_LINE) {
      startInfo.pageNo = line.pageNo;
      startInfo.lineNo = line.lineNo;
      break;
    }
  }

  console.log(
    `  Start line ${START_LINE} → Page ${startInfo.pageNo}, Line ${startInfo.lineNo}`,
  );

  // Extract human words from all lines at or after the start position
  const humanWords: string[] = [];
  interface LineWordInfo {
    entryIndex: number;
    wordStart: number;
    wordCount: number;
  }
  const lineWordMap: LineWordInfo[] = [];

  let pastStart = false;
  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];

    // Check if we've reached the start position
    if (
      line.pageNo > startInfo.pageNo ||
      (line.pageNo === startInfo.pageNo && line.lineNo >= startInfo.lineNo)
    ) {
      pastStart = true;
    }

    if (!pastStart || line.text.trim() === "") continue;

    // Sanitize for alignment (remove speaker labels, parentheticals)
    const sanitized = sanitizeLineForAlignment(line.text);
    if (sanitized.trim() === "") continue;

    const words = extractWords([sanitized]);
    if (words.length > 0) {
      lineWordMap.push({
        entryIndex: i,
        wordStart: humanWords.length,
        wordCount: words.length,
      });
      humanWords.push(...words);
    }
  }

  console.log(`  Human words for alignment: ${humanWords.length}`);

  const startTime = Date.now();
  const alignments = getChunkedWordAlignments(humanWords, aiWords);
  const elapsed = Date.now() - startTime;

  console.log(`  DTW alignment complete in ${elapsed}ms`);
  console.log(`  Total alignments: ${alignments.length}`);

  // 5. Map timestamps back to parsed lines
  console.log("\n[5/6] Mapping timestamps to lines...");

  // Create a timestamps map: entryIndex → { start, end }
  const timestampMap = new Map<number, { start: number; end: number }>();

  for (const lwi of lineWordMap) {
    const relevantAlignments = alignments.filter(
      (a) =>
        a.humanIndex >= lwi.wordStart &&
        a.humanIndex < lwi.wordStart + lwi.wordCount,
    );

    if (relevantAlignments.length > 0) {
      const validAlignments = relevantAlignments.filter(
        (a) => a.start >= 0 && a.end >= 0,
      );
      if (validAlignments.length > 0) {
        timestampMap.set(lwi.entryIndex, {
          start: validAlignments[0].start,
          end: validAlignments[validAlignments.length - 1].end,
        });
      }
    }
  }

  console.log(`  Lines with timestamps: ${timestampMap.size}`);

  // 6. Generate DVT XML
  console.log("\n[6/6] Generating DVT XML...");

  // Determine actual max line number across all entries.
  // Numbered pages top out at 25, but unnumbered cover pages preserve every
  // physical row so their LineNo can exceed 25.
  const actualMaxLines = parsedLines.reduce((max, l) => Math.max(max, l.lineNo), 25);

  const dvtConfig: DVTConfig = {
    shortId: "acd",
    deponentFirstName: "Jason",
    deponentLastName: "Willman",
    videoPath: VIDEO_PATH,
    videoRelativePath: VIDEO_RELATIVE_PATH,
    durationMs: VIDEO_DURATION_MS,
    fileSize: 0,
    fileDate: "",
    takenOn: "07/19/2023",
    matterNumber: "23-SCCV-095734",
    firstPageNo: summary.firstPage,
    lastPageNo: summary.lastPage,
    maxLinesPerPage: actualMaxLines,
    volume: 1,
  };

  const dvtContent = generateFullDVTv2(parsedLines, timestampMap, dvtConfig);

  const lineCount = dvtContent.split(/\r?\n/).length;
  console.log(
    `  DVT XML generated: ${dvtContent.length} characters, ${lineCount} XML lines`,
  );

  // Write output
  fs.writeFileSync(OUTPUT_FILE, dvtContent, "utf-8");
  console.log(`  Written to: ${OUTPUT_FILE}`);
  console.log(`  File size: ${fs.statSync(OUTPUT_FILE).size} bytes`);

  // ─── Sanity Checks ────────────────────────────────────────────────

  console.log("\n=== Sanity Checks ===");

  const dvtLineMatches = dvtContent.match(/<Line ID="/g);
  const dvtLineCount = dvtLineMatches ? dvtLineMatches.length : 0;
  const expectedMinLines = summary.totalPages * 25;
  console.log(
    `  DVT <Line> count: ${dvtLineCount} (expected min ${expectedMinLines} for ${summary.totalPages} pages × 25)`,
  );

  // Check timestamp monotonicity
  const timeMsMatches = dvtContent.matchAll(/<TimeMs>(\d+)<\/TimeMs>/g);
  let prevTime = -1;
  let monotonic = true;
  let timeMsCount = 0;
  let nonMonotonicCount = 0;
  for (const match of timeMsMatches) {
    const time = parseInt(match[1]);
    if (time < prevTime) {
      monotonic = false;
      nonMonotonicCount++;
    }
    prevTime = time;
    timeMsCount++;
  }
  console.log(`  Timestamped lines in DVT: ${timeMsCount}`);
  if (monotonic) {
    console.log("  ✓ Timestamp monotonicity check passed");
  } else {
    console.log(
      `  ⚠ ${nonMonotonicCount} non-monotonic timestamps (DTW interpolation artifacts)`,
    );
  }

  // First/Last page
  const firstPageMatch = dvtContent.match(/<FirstPageNo>(\d+)<\/FirstPageNo>/);
  const lastPageMatch = dvtContent.match(/<LastPageNo>(\d+)<\/LastPageNo>/);
  if (firstPageMatch && lastPageMatch) {
    console.log(
      `  FirstPageNo: ${firstPageMatch[1]}, LastPageNo: ${lastPageMatch[1]}`,
    );
  }

  // Check page 1 line 3
  console.log("\n  Page 1 verification (first 5 entries in DVT):");
  const p1Regex =
    /<Line ID="(\d+)">\r?\n\t*<(?:Stream|PageNo).*?<PageNo>1<\/PageNo>\r?\n\t*<LineNo>(\d+)<\/LineNo>.*?<\/Line>/gs;
  let p1count = 0;
  for (const m of dvtContent.matchAll(p1Regex)) {
    if (p1count < 5) {
      console.log(`    Line ID=${m[1]}, LineNo=${m[2]}`);
    }
    p1count++;
  }

  console.log("\n=== Done! Test acd.dvt in ExhibitView/DepoView ===");
}

// ─── DVT Generation (v2) ─────────────────────────────────────────────────

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Detect QA type from line text
 */
function detectQA(text: string): string {
  const trimmed = text.trim();
  if (/^Q\.\s/i.test(trimmed) || /^QUESTION:/i.test(trimmed)) return "Q";
  if (/^A\.\s/i.test(trimmed) || /^ANSWER:/i.test(trimmed)) return "A";
  if (/^(THE\s+WITNESS|THE\s+DEPONENT)/i.test(trimmed)) return "A";
  return "-";
}

function generateUUID(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `{${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}}`.toUpperCase();
}

/**
 * Generate DVT XML from parsed transcript lines and a timestamp map.
 * This version uses OriginalTranscriptLine[] directly — preserving
 * blank lines and correct page:line numbers.
 */
function generateFullDVTv2(
  lines: OriginalTranscriptLine[],
  timestampMap: Map<number, { start: number; end: number }>,
  config: DVTConfig,
): string {
  const uuid = generateUUID();

  // Each entry becomes a <Line> element
  const xmlLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i];
    const ts = timestampMap.get(i);
    const hasTimestamp = ts && ts.start > 0;
    // Use trimEnd() — leading spaces carry indentation that DepoView must render.
    // Only trailing whitespace is safe to drop.
    const text = entry.text.trimEnd();
    const qa = text.trim().length > 0 ? detectQA(text.trim()) : "-";

    xmlLines.push(`\t\t<Line ID="${i}">`);

    if (hasTimestamp) {
      xmlLines.push(`\t\t\t<Stream>0</Stream>`);
      xmlLines.push(`\t\t\t<TimeMs>${Math.round(ts!.start)}</TimeMs>`);
    }

    xmlLines.push(`\t\t\t<PageNo>${entry.pageNo}</PageNo>`);
    xmlLines.push(`\t\t\t<LineNo>${entry.lineNo}</LineNo>`);
    xmlLines.push(`\t\t\t<QA>${qa}</QA>`);

    if (text.trim().length > 0) {
      xmlLines.push(`\t\t\t<Text>${escapeXml(text)}</Text>`);
    }

    xmlLines.push(`\t\t</Line>`);
  }

  const totalLines = lines.length;

  const parts: string[] = [
    `<?xml version="1.0" encoding="ISO-8859-1"?>`,
    `<!-- Copyright (C) 2003-2013 inData Corporation.  All rights reserved. -->`,
    `<OpenDVT UUID="${uuid}" ShortID="${escapeXml(config.shortId)}" Type="Deposition" Version="1.4">`,
    `\t<Information>`,
    `\t\t<Origination>`,
    `\t\t\t<ID>${generateUUID()}</ID>`,
    `\t\t\t<AppName>SyncExpress</AppName>`,
    `\t\t\t<AppVersion>1.0</AppVersion>`,
    `\t\t\t<VendorName></VendorName>`,
    `\t\t\t<VendorPhone></VendorPhone>`,
    `\t\t\t<VendorURL></VendorURL>`,
    `\t\t</Origination>`,
    `\t\t<Case>`,
    `\t\t\t<MatterNumber>${escapeXml(config.matterNumber)}</MatterNumber>`,
    `\t\t</Case>`,
    `\t\t<Deponent>`,
    `\t\t\t<FirstName>${escapeXml(config.deponentFirstName)}</FirstName>`,
    `\t\t\t<LastName>${escapeXml(config.deponentLastName)}</LastName>`,
    `\t\t</Deponent>`,
    `\t\t<ReportingFirm>`,
    `\t\t\t<Name></Name>`,
    `\t\t</ReportingFirm>`,
    `\t\t<FirstPageNo>${config.firstPageNo}</FirstPageNo>`,
    `\t\t<LastPageNo>${config.lastPageNo}</LastPageNo>`,
    `\t\t<MaxLinesPerPage>${config.maxLinesPerPage}</MaxLinesPerPage>`,
    `\t\t<Volume>${config.volume}</Volume>`,
    `\t\t<TakenOn>${config.takenOn}</TakenOn>`,
    `\t</Information>`,
    `\t<Lines Count="${totalLines}">`,
    ...xmlLines,
    `\t</Lines>`,
    `\t<Streams Count="1">`,
    `\t\t<Stream ID="0">`,
    `\t\t\t<URI>${escapeXml(config.videoPath)}</URI>`,
    `\t\t\t<URIRelative>${escapeXml(config.videoRelativePath)}</URIRelative>`,
    `\t\t\t<VolumeID>${escapeXml(config.shortId)}</VolumeID>`,
    `\t\t\t<FileSize>${config.fileSize}</FileSize>`,
    `\t\t\t<FileDate>${config.fileDate}</FileDate>`,
    `\t\t\t<DurationMs>${config.durationMs}</DurationMs>`,
    `\t\t\t<VolumeLabel>${escapeXml(config.shortId)}</VolumeLabel>`,
    `\t\t</Stream>`,
    `\t</Streams>`,
    `</OpenDVT>`,
  ];

  return parts.join("\r\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
