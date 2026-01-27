/**
 * Utility functions for parsing court transcript documents
 * Handles formal court transcript format with page numbers and line numbers
 */

export interface TranscriptLine {
  pageNumber: number;
  lineNumber: number;
  text: string;
  absoluteLineNumber: number;
}

export interface AnnotatedTranscriptLine {
  originalText: string;
  metadata: TranscriptLine | null;
}

/**
 * Parses court transcript text and maps metadata to original lines
 * Preserves the exact structure of the file for display
 */
export function parseCourtTranscript(transcript: string): AnnotatedTranscriptLine[] {
  const lines = transcript.split(/\r?\n/);
  const result: AnnotatedTranscriptLine[] = [];

  let currentPage = 1;
  let absoluteLineCounter = 0;

  let currentLineOnPage = 0;
  let foundExplicitPageStart = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Default: No metadata
    const annotatedLine: AnnotatedTranscriptLine = {
      originalText: line,
      metadata: null
    };

    const normalizedLine = line.replace(/\u00A0/g, ' ');
    const trimmedLine = normalizedLine.trim();

    // If empty, just push and continue
    if (!trimmedLine) {
      result.push(annotatedLine);
      continue;
    }

    // PAGE NUMBER DETECTION
    const pageMatch = /^[\s\t]*(\d{1,4})[\s\t]*$/.exec(normalizedLine);
    if (pageMatch) {
      const potentialPageNum = parseInt(pageMatch[1]);

      if (potentialPageNum === 1 && !foundExplicitPageStart) {
        currentPage = 1;
        currentLineOnPage = 0;
        foundExplicitPageStart = true;
      } else if (potentialPageNum > currentPage && potentialPageNum < currentPage + 5) {
        currentPage = potentialPageNum;
        currentLineOnPage = 0;
        foundExplicitPageStart = true;
      }

      // This line is a page header, no transcript metadata needed
      result.push(annotatedLine);
      continue;
    }

    // LINE NUMBER DETECTION
    const lineMatch = /^[\s\t]*(\d{1,2})(?:[\s\t]+|$)(.*)/.exec(normalizedLine);

    if (lineMatch) {
      const explicitLineNumber = parseInt(lineMatch[1]);
      const content = lineMatch[2] ? lineMatch[2].trim() : "";

      if (explicitLineNumber >= 1 && explicitLineNumber <= 35) {
        if (explicitLineNumber === 1 && currentLineOnPage > 5) {
          // Check end of file heuristic
          const linesRemaining = lines.length - i;
          if (linesRemaining > 2 && !foundExplicitPageStart) {
            currentPage++;
            currentLineOnPage = 0;
          }
          foundExplicitPageStart = false;
        }

        currentLineOnPage = explicitLineNumber;
        absoluteLineCounter++;

        // Attach metadata!
        annotatedLine.metadata = {
          pageNumber: currentPage,
          lineNumber: explicitLineNumber,
          text: content,
          absoluteLineNumber: absoluteLineCounter
        };

        result.push(annotatedLine);
        continue;
      }
    }

    // FALLBACK: Non-Numbered Line but has content
    // Treat as a line if it's text (and we are inside a page)
    currentLineOnPage++;
    absoluteLineCounter++;
    annotatedLine.metadata = {
      pageNumber: currentPage,
      lineNumber: currentLineOnPage,
      text: trimmedLine,
      absoluteLineNumber: absoluteLineCounter
    };
    result.push(annotatedLine);
  }

  return result;
}

export function getTranscriptSummary(annotatedLines: AnnotatedTranscriptLine[]) {
  // Filter to only lines with metadata for summary
  const validLines = annotatedLines
    .filter(l => l.metadata)
    .map(l => l.metadata!);

  if (validLines.length === 0) {
    return {
      totalLines: 0,
      totalPages: 0,
      firstPage: 0,
      lastPage: 0
    };
  }

  const pages = new Set(validLines.map(line => line.pageNumber));

  return {
    totalLines: validLines.length,
    totalPages: pages.size,
    firstPage: Math.min(...pages),
    lastPage: Math.max(...pages)
  };
}
