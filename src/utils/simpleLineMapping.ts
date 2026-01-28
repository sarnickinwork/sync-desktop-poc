import { parseCourtTranscript } from './courtTranscriptParser';
import { SimpleTranscriptDto, MappedSentenceResult } from './types';
import { extractWords } from './textProcessingUtils';
import { getChunkedWordAlignments, fixSentenceTimestamps } from './dtwAlignmentUtils';
import { sanitizeLineForAlignment } from './textSanitization';

/**
 * Perform mapping between AI transcript words and original transcript lines.
 * Returns ALL lines from the transcript, with timestamps only applied after startLine.
 * Uses sanitized text (removing speaker labels, parentheticals) for alignment accuracy.
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
    // Use SANITIZED text to remove speaker labels and non-spoken artifacts
    const humanWords: string[] = [];
    const lineWordMapping: Map<number, { start: number; count: number }> = new Map();

    for (let i = 0; i < annotatedLines.length; i++) {
        const line = annotatedLines[i];
        if (line.metadata) {
            // CRITICAL FIX: Only extract words from lines at or after startLine for alignment
            // This ensures alignment starts from the correct video position
            if (line.metadata.absoluteLineNumber < startLine) {
                continue; // Skip lines before the selected start
            }
            
            const startIdx = humanWords.length;
            
            // SANITIZE: Remove speaker labels, parentheticals, Q/A markers for alignment
            const sanitizedText = sanitizeLineForAlignment(line.metadata.text);
            
            // Debug logging for troubleshooting
            if (line.metadata.absoluteLineNumber >= startLine && line.metadata.absoluteLineNumber < startLine + 3) {
                console.log(`[DEBUG] Line ${line.metadata.absoluteLineNumber} (Page ${line.metadata.pageNumber}, Line ${line.metadata.lineNumber}):`);
                console.log(`  Original: "${line.metadata.text}"`);
                console.log(`  Sanitized: "${sanitizedText}"`);
            }
            
            // Only extract words if there's actual spoken content
            if (sanitizedText.trim().length > 0) {
                const words = extractWords([sanitizedText]);
                humanWords.push(...words);
                lineWordMapping.set(i, { start: startIdx, count: words.length });
                
                if (line.metadata.absoluteLineNumber >= startLine && line.metadata.absoluteLineNumber < startLine + 3) {
                    console.log(`  Words (${words.length}): [${words.slice(0, 10).join(', ')}${words.length > 10 ? '...' : ''}]`);
                }
            }
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

        // Get all alignments for this line that are MATCHED
        const relevantAlignments = alignmentResults.filter(
            a => a.humanIndex >= startWordIdx && a.humanIndex < endWordIdx && a.isMatched
        );

        if (relevantAlignments.length > 0) {
            const firstAlignment = relevantAlignments[0];
            const lastAlignment = relevantAlignments[relevantAlignments.length - 1];

            // IMPROVED CONFIDENCE: Only use high-quality matches (confidence > 0.4)
            // This filters out poor alignments that drag down the average
            const highQualityMatches = relevantAlignments.filter(a => a.confidence > 0.4);
            
            // Use high-quality matches if available, otherwise use all matches
            const confidencesToUse = highQualityMatches.length > 0 
                ? highQualityMatches.map(a => a.confidence)
                : relevantAlignments.map(a => a.confidence);

            lineTimestamps.set(lineIdx, {
                start: firstAlignment.start,
                end: lastAlignment.end,
                confidences: confidencesToUse
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

            // Calculate average confidence from high-quality matches
            let avgConf = ts && hasStarted
                ? ts.confidences.reduce((a, b) => a + b, 0) / ts.confidences.length
                : 0;

            // BOOST CONFIDENCE: Since we're using sanitized text (speaker labels removed),
            // the matches are more reliable than raw text alignment would suggest.
            // Apply a normalization boost to account for this.
            if (avgConf > 0) {
                avgConf = Math.min(100, avgConf * 1.2); // 20% boost, capped at 100%
            }

            // Debug timestamp assignment
            if (line.metadata.absoluteLineNumber >= startLine && line.metadata.absoluteLineNumber < startLine + 3) {
                console.log(`[DEBUG] Assigning timestamps to line ${line.metadata.absoluteLineNumber}:`);
                console.log(`  hasStarted: ${hasStarted}, ts: ${ts ? 'exists' : 'null'}`);
                if (ts) {
                    console.log(`  ts.start: ${ts.start}, ts.end: ${ts.end}, confidences: ${ts.confidences.length}`);
                }
                console.log(`  Final: start=${ts && hasStarted ? ts.start : 0}, end=${ts && hasStarted ? ts.end : 0}`);
            }

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

    // 6. Fix zero timestamps (interpolation) - strictly starting from user-selected line
    // Find the array index corresponding to the startLine
    let startIndexForFixing = 0;
    for (let i = 0; i < results.length; i++) {
        const lineMetadata = annotatedLines[i]?.metadata;
        if (lineMetadata && lineMetadata.absoluteLineNumber >= startLine) {
            startIndexForFixing = i;
            break;
        }
    }

    return fixSentenceTimestamps(results, startIndexForFixing);
}
