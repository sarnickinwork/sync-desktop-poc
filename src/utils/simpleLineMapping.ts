import { parseCourtTranscript } from './courtTranscriptParser';
import { SimpleTranscriptDto, MappedSentenceResult } from './types';
import { extractWords } from './textProcessingUtils';
import { getChunkedWordAlignments, fixSentenceTimestamps } from './dtwAlignmentUtils';

/**
 * Perform mapping between AI transcript words and original transcript lines.
 * Returns ALL lines from the transcript, with timestamps only applied after startLine.
 * 
 * @param manualTranscript - The raw text of the uploaded transcript file
 * @param aiTranscript - The AI result containing words with timestamps
 * @param startLine - The absolute line number to start timestamping from
 * @returns Array of ALL transcript lines, with timestamps starting from startLine
 */
export function performSimpleLineMapping(
    manualTranscript: string,
    aiTranscript: SimpleTranscriptDto,
    startLine: number = 0
): MappedSentenceResult[] {

    // 1. Parse original transcript structure (ALL lines)
    const annotatedLines = parseCourtTranscript(manualTranscript);

    // 2. Extract words from content lines for alignment
    const humanWords: string[] = [];
    const lineWordMapping: Map<number, { start: number; count: number }> = new Map();

    for (let i = 0; i < annotatedLines.length; i++) {
        const line = annotatedLines[i];
        if (line.metadata) {
            const startIdx = humanWords.length;
            // Use metadata.text (cleaned text without line numbers)
            const words = extractWords([line.metadata.text]);
            humanWords.push(...words);
            lineWordMapping.set(i, { start: startIdx, count: words.length });
        }
    }

    console.log(`Simple Mapping (Start Line ${startLine}): ${humanWords.length} human words vs ${aiTranscript.words.length} AI words`);

    // 3. Align the words using DTW
    const aiWords = aiTranscript.words;
    const alignmentResults = getChunkedWordAlignments(humanWords, aiWords);

    // 4. Map timestamps back to lines
    const lineTimestamps: Map<number, { start: number; end: number; confidences: number[] }> = new Map();

    for (let lineIdx = 0; lineIdx < annotatedLines.length; lineIdx++) {
        const wordInfo = lineWordMapping.get(lineIdx);
        if (!wordInfo) continue;

        const { start: startWordIdx, count: wordCount } = wordInfo;
        const endWordIdx = startWordIdx + wordCount;

        const relevantAlignments = alignmentResults.filter(
            a => a.humanIndex >= startWordIdx && a.humanIndex < endWordIdx && a.isMatched
        );

        if (relevantAlignments.length > 0) {
            const firstAlignment = relevantAlignments[0];
            const lastAlignment = relevantAlignments[relevantAlignments.length - 1];

            lineTimestamps.set(lineIdx, {
                start: firstAlignment.start,
                end: lastAlignment.end,
                confidences: relevantAlignments.map((a) => a.confidence)
            });
        }
    }

    // 5. Construct Result List - Include ALL lines
    const results: MappedSentenceResult[] = [];

    for (let i = 0; i < annotatedLines.length; i++) {
        const line = annotatedLines[i];

        // For content lines with metadata
        if (line.metadata) {
            const ts = lineTimestamps.get(i);
            const hasStarted = line.metadata.absoluteLineNumber >= startLine;

            // Calculate average confidence
            const avgConf = ts && hasStarted
                ? ts.confidences.reduce((a, b) => a + b, 0) / ts.confidences.length
                : 0;

            results.push({
                sentence: line.originalText,  // For display (preserves original formatting)
                text: line.metadata.text,      // For DVT/SYN (clean text without line numbers)
                start: ts && hasStarted ? ts.start : 0,  // Only add timestamps after startLine
                end: ts && hasStarted ? ts.end : 0,
                confidence: avgConf,
                pageNumber: line.metadata.pageNumber,
                lineNumber: line.metadata.lineNumber
            });
        } else {
            // For non-content lines (page headers, empty lines)
            results.push({
                sentence: line.originalText,
                text: line.originalText,
                start: 0,
                end: 0,
                confidence: 0
            });
        }
    }

    // 6. Fix zero timestamps (interpolation) - only for lines that should have timestamps
    return fixSentenceTimestamps(results);
}
