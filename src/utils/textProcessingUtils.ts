/**
 * Text processing utility functions for transcript handling
 */

/**
 * Split text into sentences using punctuation marks
 * @param text - Input text to split
 * @returns Array of sentence strings
 */
export function splitIntoSentences(text: string): string[] {
    // Regex lookbehind support depends on environment (Node 9+ supports it)
    const roughSplit = text.split(/(?<=[.!?])\s+/)
        .filter(s => s && s.trim().length > 0);
    return mergeHonorificSentences(roughSplit);
}

/**
 * Merge sentences that were incorrectly split after honorifics (Mr., Mrs., Dr., etc.)
 * @param parts - Array of sentence parts
 * @returns Merged sentence array
 */
export function mergeHonorificSentences(parts: string[]): string[] {
    const honorificRegex = /^(Mr|Ms|Mrs|Dr|Prof|Hon|Judge|Justice|Sr|Jr|Esq)\.$/i;
    const merged: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const current = parts[i].trim();
        if (honorificRegex.test(current) && i + 1 < parts.length) {
            merged.push(`${current} ${parts[i + 1].trim()}`);
            i++;
        } else {
            merged.push(current);
        }
    }
    return merged;
}

/**
 * Sanitize sentences by removing speaker labels and Q/A prefixes
 * @param sentences - Array of sentences to sanitize
 * @returns Sanitized sentence array
 */
export function sanitizeSentences(sentences: string[]): string[] {
    const sanitized: string[] = [];
    // Speaker regex: Starts with capital, some uppercase/dots/spaces, then colon
    const speakerRegex = /^[A-Z][A-Z\.\s]+:\s*/;
    // Q/A regex
    const qaRegex = /^(Q|A)\.\s*/i;

    for (const sentence of sentences) {
        if (!sentence || !sentence.trim()) continue;

        let cleaned = sentence;
        cleaned = cleaned.replace(speakerRegex, '');
        cleaned = cleaned.replace(qaRegex, '');
        cleaned = cleaned.trim();

        if (cleaned) {
            sanitized.push(cleaned);
        }
    }
    return sanitized;
}

/**
 * Extract individual words from an array of sentences
 * @param sentences - Array of sentences
 * @returns Array of words
 */
export function extractWords(sentences: string[]): string[] {
    const words: string[] = [];
    for (const sentence of sentences) {
        const sentenceWords = sentence.split(/\s+/)
            .filter(w => w && w.trim().length > 0);
        words.push(...sentenceWords);
    }
    return words;
}

/**
 * Normalize a word by removing punctuation and converting to lowercase
 * @param word - Word to normalize
 * @returns Normalized word
 */
export function normalizeWord(word: string): string {
    return word.replace(/[^\w\s]/g, "").toLowerCase().trim();
}

/**
 * Check if a word is a salutation/title (Mr., Dr., etc.)
 * @param word - Word to check
 * @returns True if the word is a salutation
 */
export function isSalutation(word: string): boolean {
    const cleaned = word.replace(/[.!?]+$/, '').toLowerCase();
    const salutations = new Set([
        "mr", "mrs", "ms", "miss", "dr", "prof", "professor",
        "hon", "honorable", "judge", "justice", "sen", "senator",
        "rep", "representative", "gov", "governor", "pres", "president",
        "sr", "jr", "esq", "rev", "reverend", "fr", "father",
        "st", "saint", "col", "colonel", "gen", "general",
        "maj", "major", "capt", "captain", "lt", "lieutenant",
        "sgt", "sergeant", "cpl", "corporal", "pvt", "private"
    ]);
    return salutations.has(cleaned);
}

/**
 * Extract human transcript from a text file starting at a specific line
 * @param content - Text file content as string
 * @param lineNumber - Line number to start from (0-indexed)
 * @returns Extracted human transcript
 */
export function extractHumanTranscriptFromContent(content: string, lineNumber: number): string {
    const dialogues: string[] = [];

    // Regex: Number followed by whitespace, then capture group
    const regex = /^\d+\s+(.+)$/;

    // Split by newline
    const lines = content.split(/\r?\n/);

    for (let i = lineNumber; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        if (!trimmedLine) continue;

        const match = regex.exec(trimmedLine);
        if (match) {
            const dialogue = match[1].trim();
            dialogues.push(dialogue);
        }
    }

    return dialogues.join(" ");
}
