/**
 * Utility for parsing text content from SMI files
 */

export interface SmiSubtitle {
  start: number;
  end?: number; // Optional, can be calculated from next start
  text: string;
  confidence?: number;
}

/**
 * Parses raw SMI content string into structured subtitle objects
 * @param content The raw SMI file content
 * @returns Array of subtitles with start time (ms) and text
 */
export function parseSMI(content: string): SmiSubtitle[] {
  const subtitles: SmiSubtitle[] = [];

  // Regex to capture Sync Start time and the content inside P tag
  // <Sync Start=1234><P Class=ENCC>Hello world
  // Note: SMI is often loose with closing tags, so we often just look for the next Sync or end.
  // However, usually it's line-based.

  // Clean up newlines for easier regex matching if needed, 
  // but iterating line by line might be safer for basic SMI.

  const syncRegex = /<Sync Start=(\d+)>/i;
  const textRegex = /<P[^>]*>(.*)/i;
  // Simple check for end tag or just ignoring parsing beyond what we need

  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const syncMatch = line.match(syncRegex);
    if (syncMatch) {
      const start = parseInt(syncMatch[1], 10);

      const textMatch = line.match(textRegex);
      if (textMatch) {
        let text = textMatch[1].trim();

        // Remove closing tags if present on the same line (e.g. </P>, </Sync>)
        text = text.replace(/<\/?[^>]+(>|$)/g, "").trim();

        // specific cleanup for &nbsp; which means clear
        if (text === "&nbsp;" || !text) {
          continue;
        }

        // Basic HTML entity decoding (expand as needed)
        text = text
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        subtitles.push({ start, text });
      }
    }
  }

  return subtitles;
}
