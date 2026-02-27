/**
 * Full DVT (OpenDVT / DepoView) File Generator
 *
 * Generates a DepoView-compatible .dvt file from:
 *   - MappedSentenceResult[] (timestamped lines from performSimpleLineMapping)
 *   - Video metadata (path, duration, etc.)
 *
 * Key differences from dvtGenerationUtils.ts:
 *   - Preserves ALL blank lines (25 lines per page, strict)
 *   - Uses tab indentation matching reference DVTs
 *   - Emits <Stream>0</Stream> + <TimeMs> only for timestamped lines
 *   - Uses ISO-8859-1 encoding declaration
 */

import { MappedSentenceResult } from "../types";

// ─── Interfaces ──────────────────────────────────────────────────────────

export interface DVTConfig {
  /** Short identifier for the DVT (used in ShortID, VolumeID, VolumeLabel) */
  shortId: string;
  /** Deponent first name */
  deponentFirstName: string;
  /** Deponent last name */
  deponentLastName: string;
  /** Absolute path to the video file */
  videoPath: string;
  /** Relative path to the video file (e.g. \\media\\Video.mp4) */
  videoRelativePath: string;
  /** Video duration in milliseconds */
  durationMs: number;
  /** Video file size in bytes (0 if unknown) */
  fileSize: number;
  /** Video file date (e.g. "07/19/2023 14:26:00") */
  fileDate: string;
  /** Date deposition was taken (e.g. "07/19/2023") */
  takenOn: string;
  /** Case/matter number */
  matterNumber: string;
  /** First page number in the transcript */
  firstPageNo: number;
  /** Last page number in the transcript */
  lastPageNo: number;
  /** Max lines per page (always 25) */
  maxLinesPerPage: number;
  /** Volume number (default 1) */
  volume: number;
}

// ─── Helper Functions ────────────────────────────────────────────────────

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
 * Detect QA (Question/Answer) type from line text
 * Returns 'Q' for question, 'A' for answer, '-' for neither
 */
function detectQA(text: string): string {
  const trimmed = text.trim();

  // Check for explicit Q. or A. markers
  if (/^Q\.\s/i.test(trimmed) || /^QUESTION:/i.test(trimmed)) {
    return "Q";
  }
  if (/^A\.\s/i.test(trimmed) || /^ANSWER:/i.test(trimmed)) {
    return "A";
  }

  // Check for common answer phrases (witness speaking)
  if (/^(THE\s+WITNESS|THE\s+DEPONENT)/i.test(trimmed)) {
    return "A";
  }

  return "-";
}

/**
 * Generate a UUID-like string for the DVT
 */
function generateUUID(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `{${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}}`.toUpperCase();
}

// ─── Main Generator ──────────────────────────────────────────────────────

/**
 * Generate a full OpenDVT XML file from mapped sentence results.
 *
 * This function produces a DVT matching the reference format:
 *   - Uses tab indentation
 *   - Preserves blank lines (no <Text> element for empty lines)
 *   - Emits <Stream>0</Stream> + <TimeMs> only when start > 0
 *   - 25 lines per page structure
 *   - QA detection for Q/A/- markers
 *
 * @param lines - Array of MappedSentenceResult from performSimpleLineMapping()
 * @param config - DVT configuration/metadata
 * @returns DVT XML string
 */
export function generateFullDVT(
  lines: MappedSentenceResult[],
  config: DVTConfig,
): string {
  const uuid = generateUUID();

  // Filter to only lines that have pageNumber and lineNumber (content lines)
  // These come from courtTranscriptParser via simpleLineMapping
  const contentLines = lines.filter(
    (l) =>
      l.pageNumber !== undefined &&
      l.pageNumber > 0 &&
      l.lineNumber !== undefined &&
      l.lineNumber > 0,
  );

  // Build a page→line map to ensure we have all 25 lines per page
  // Page structure: { [pageNo]: { [lineNo]: MappedSentenceResult } }
  const pageMap = new Map<number, Map<number, MappedSentenceResult[]>>();

  for (const line of contentLines) {
    const pageNo = line.pageNumber!;
    const lineNo = line.lineNumber!;

    if (!pageMap.has(pageNo)) {
      pageMap.set(pageNo, new Map());
    }
    const linemap = pageMap.get(pageNo)!;
    if (!linemap.has(lineNo)) {
      linemap.set(lineNo, []);
    }
    linemap.get(lineNo)!.push(line);
  }

  // Determine page range
  const allPages = Array.from(pageMap.keys()).sort((a, b) => a - b);
  const firstPage = allPages.length > 0 ? allPages[0] : config.firstPageNo;
  const lastPage =
    allPages.length > 0 ? allPages[allPages.length - 1] : config.lastPageNo;

  // Build all lines in order with a global line ID counter
  let lineId = 0;
  const xmlLines: string[] = [];

  for (let pageNo = firstPage; pageNo <= lastPage; pageNo++) {
    const pageLinesMap = pageMap.get(pageNo);

    for (let lineNo = 1; lineNo <= config.maxLinesPerPage; lineNo++) {
      const mappedLines = pageLinesMap?.get(lineNo);

      if (mappedLines && mappedLines.length > 0) {
        // There may be multiple entries for the same page/line
        // (reference DVTs show this for wrapped lines). Emit each one.
        for (const mapped of mappedLines) {
          const text = (mapped.text || "").trim();
          const hasTimestamp = mapped.start > 0;
          const qa = text.length > 0 ? detectQA(text) : "-";

          xmlLines.push(`\t\t<Line ID="${lineId}">`);

          if (hasTimestamp) {
            xmlLines.push(`\t\t\t<Stream>0</Stream>`);
            xmlLines.push(`\t\t\t<TimeMs>${Math.round(mapped.start)}</TimeMs>`);
          }

          xmlLines.push(`\t\t\t<PageNo>${pageNo}</PageNo>`);
          xmlLines.push(`\t\t\t<LineNo>${lineNo}</LineNo>`);
          xmlLines.push(`\t\t\t<QA>${qa}</QA>`);

          if (text.length > 0) {
            xmlLines.push(`\t\t\t<Text>${escapeXml(text)}</Text>`);
          }

          xmlLines.push(`\t\t</Line>`);
          lineId++;
        }
      } else {
        // Empty line — still emit the Line element (blank)
        xmlLines.push(`\t\t<Line ID="${lineId}">`);
        xmlLines.push(`\t\t\t<PageNo>${pageNo}</PageNo>`);
        xmlLines.push(`\t\t\t<LineNo>${lineNo}</LineNo>`);
        xmlLines.push(`\t\t\t<QA>-</QA>`);
        xmlLines.push(`\t\t</Line>`);
        lineId++;
      }
    }
  }

  const totalLines = lineId;

  // Build the full XML document
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
    `\t\t<FirstPageNo>${firstPage}</FirstPageNo>`,
    `\t\t<LastPageNo>${lastPage}</LastPageNo>`,
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
