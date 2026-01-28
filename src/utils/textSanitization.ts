/**
 * Text Sanitization Utilities for Transcript Alignment
 * 
 * Removes non-spoken artifacts from transcript text to improve
 * alignment accuracy with AI-generated video transcripts.
 */

/**
 * Common speaker label patterns found in court transcripts
 */
const SPEAKER_PATTERNS = [
    // Direct speaker labels
    /^THE\s+VIDEOGRAPHER:\s*/i,
    /^THE\s+WITNESS:\s*/i,
    /^THE\s+COURT\s+REPORTER:\s*/i,
    /^THE\s+COURT:\s*/i,
    /^THE\s+DEPONENT:\s*/i,
    /^VIDEOGRAPHER:\s*/i,
    /^WITNESS:\s*/i,
    /^REPORTER:\s*/i,

    // Formal titles with names
    /^(MR|MS|MRS|DR|MISS)\.\s+[A-Z][A-Za-z]+:\s*/,

    // Question/Answer prefixes (keep the content after)
    /^Q\.\s+/i,
    /^A\.\s+/i,
    /^QUESTION:\s*/i,
    /^ANSWER:\s*/i,

    // Parenthetical non-spoken content
    /^\([^)]*\)\s*/,  // Remove entire parenthetical at start
];

/**
 * Inline parenthetical patterns (timestamps, actions, etc.)
 */
const INLINE_PARENTHETICAL_PATTERN = /\([^)]*\)/g;

/**
 * Sanitize a single line of transcript text for alignment purposes
 * Removes speaker labels and non-spoken artifacts while preserving actual spoken content
 * 
 * @param text - Original transcript line text
 * @returns Sanitized text containing only spoken words
 */
export function sanitizeLineForAlignment(text: string): string {
    if (!text) return '';

    let sanitized = text;

    // Step 1: Remove speaker labels from the beginning
    for (const pattern of SPEAKER_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }

    // Step 2: Remove inline parenthetical content (timestamps, actions, etc.)
    // Examples: "(Whereupon, the witness was duly sworn.)", "(Pause in proceedings.)"
    sanitized = sanitized.replace(INLINE_PARENTHETICAL_PATTERN, ' ');

    // Step 3: Clean up extra whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
}

/**
 * Sanitize multiple lines and combine them into a continuous text stream
 * Useful for sentence reconstruction across page boundaries
 * 
 * @param lines - Array of transcript line texts
 * @returns Single sanitized text string with all spoken content
 */
export function sanitizeLines(lines: string[]): string {
    const sanitizedLines = lines
        .map(line => sanitizeLineForAlignment(line))
        .filter(line => line.length > 0);

    return sanitizedLines.join(' ');
}

/**
 * Check if a line is purely non-spoken content
 * (e.g., page headers, blank lines, standalone parentheticals)
 * 
 * @param text - Line text to check
 * @returns true if line contains no spoken content
 */
export function isNonSpokenLine(text: string): boolean {
    const sanitized = sanitizeLineForAlignment(text);
    return sanitized.length === 0;
}

/**
 * Extract spoken content ratio from a line
 * Useful for determining alignment confidence adjustments
 * 
 * @param originalText - Original line text
 * @returns Ratio of spoken content (0.0 to 1.0)
 */
export function getSpokenContentRatio(originalText: string): number {
    if (!originalText || originalText.trim().length === 0) return 0;

    const sanitized = sanitizeLineForAlignment(originalText);
    const originalLength = originalText.trim().length;
    const sanitizedLength = sanitized.length;

    return sanitizedLength / originalLength;
}

/**
 * Reconstruct sentences across page boundaries
 * Groups lines into logical sentences based on punctuation
 * 
 * @param lines - Array of line texts
 * @returns Array of reconstructed sentences
 */
export function reconstructSentences(lines: string[]): string[] {
    const sentences: string[] = [];
    let currentSentence = '';

    for (const line of lines) {
        const sanitized = sanitizeLineForAlignment(line);
        if (!sanitized) continue;

        currentSentence += (currentSentence ? ' ' : '') + sanitized;

        // Check if sentence ends with terminal punctuation
        if (/[.!?]$/.test(currentSentence.trim())) {
            sentences.push(currentSentence.trim());
            currentSentence = '';
        }
    }

    // Add any remaining content as final sentence
    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim());
    }

    return sentences;
}

/**
 * Detect if a line is a speaker label only (no actual content)
 * 
 * @param text - Line text
 * @returns true if line is just a speaker label
 */
export function isSpeakerLabelOnly(text: string): boolean {
    if (!text) return false;

    const trimmed = text.trim();

    // Check if entire line matches a speaker pattern
    for (const pattern of SPEAKER_PATTERNS) {
        if (pattern.test(trimmed)) {
            const afterRemoval = trimmed.replace(pattern, '').trim();
            if (afterRemoval.length === 0) return true;
        }
    }

    return false;
}
