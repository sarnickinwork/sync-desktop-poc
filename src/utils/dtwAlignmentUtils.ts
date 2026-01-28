import * as fuzz from 'fuzzball';
import { WordDTO, MappedSentenceResult, FinalTranscriptWordAlignment } from './types';
import { normalizeWord, isSalutation } from './textProcessingUtils';

/**
 * Perform chunked DTW alignment for large transcripts to prevent memory crashes
 * Processes the transcript in overlapping chunks
 * @param humanWords - Array of words from human transcript
 * @param aiWords - Array of word DTOs from AI transcript
 * @param chunkSize - Size of each chunk (default: 1500)
 * @param overlapSize - Size of overlap between chunks (default: 150)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of mapped sentence results
 */
/**
 * Perform chunked DTW alignment and return raw word alignments
 * @param humanWords - Array of words from human transcript
 * @param aiWords - Array of word DTOs from AI transcript
 * @param chunkSize - Size of each chunk (default: 1500)
 * @param overlapSize - Size of overlap between chunks (default: 150)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of word alignments
 */
export function getChunkedWordAlignments(
    humanWords: string[],
    aiWords: WordDTO[],
    chunkSize: number = 1500,
    overlapSize: number = 150,
    onProgress?: (current: number, total: number) => void
): FinalTranscriptWordAlignment[] {
    const totalHumanWords = humanWords.length;
    const totalAiWords = aiWords.length;

    // If small enough, use original DTW
    if (totalHumanWords <= chunkSize * 2 && totalAiWords <= chunkSize * 2) {
        return alignWithDTW(humanWords, aiWords);
    }

    console.log(`Using chunked DTW: ${totalHumanWords} human words, ${totalAiWords} AI words`);

    const allAlignments: FinalTranscriptWordAlignment[] = [];
    let humanStart = 0;
    let chunkIndex = 0;
    const estimatedChunks = Math.ceil(totalHumanWords / chunkSize);

    while (humanStart < totalHumanWords) {
        const humanEnd = Math.min(humanStart + chunkSize + overlapSize, totalHumanWords);
        const humanChunk = humanWords.slice(humanStart, humanEnd);

        // Estimate AI chunk size proportionally
        const progressRatio = humanStart / totalHumanWords;
        const estimatedAiStart = Math.floor(progressRatio * totalAiWords);
        const aiChunkSize = Math.floor((humanChunk.length / totalHumanWords) * totalAiWords * 1.2); // 20% buffer
        const aiEnd = Math.min(estimatedAiStart + aiChunkSize + overlapSize, totalAiWords);
        const aiChunk = aiWords.slice(estimatedAiStart, aiEnd);

        console.log(`Processing chunk ${chunkIndex + 1}/${estimatedChunks}: Human[${humanStart}:${humanEnd}], AI[${estimatedAiStart}:${aiEnd}]`);

        if (onProgress) {
            onProgress(chunkIndex + 1, estimatedChunks);
        }

        // Process this chunk
        const chunkAlignments = alignWithDTW(humanChunk, aiChunk);

        // Adjust indices to global positions
        for (const alignment of chunkAlignments) {
            alignment.humanIndex = humanStart + alignment.humanIndex;
            if (alignment.aiIndex >= 0) {
                alignment.aiIndex = estimatedAiStart + alignment.aiIndex;
            }
        }

        // For first chunk, add all
        if (chunkIndex === 0) {
            allAlignments.push(...chunkAlignments);
        } else {
            // For subsequent chunks, skip the overlap portion (first 'overlapSize' human words)
            const skipCount = Math.min(overlapSize, chunkAlignments.length);
            allAlignments.push(...chunkAlignments.slice(skipCount));
        }

        humanStart += chunkSize;
        chunkIndex++;
    }

    console.log(`Chunked DTW complete: ${allAlignments.length} total alignments`);
    return allAlignments;
}

/**
 * Perform chunked DTW alignment for large transcripts to prevent memory crashes
 * Processes the transcript in overlapping chunks
 * @param humanWords - Array of words from human transcript
 * @param aiWords - Array of word DTOs from AI transcript
 * @param chunkSize - Size of each chunk (default: 1500)
 * @param overlapSize - Size of overlap between chunks (default: 150)
 * @param onProgress - Optional callback for progress updates
 * @returns Array of mapped sentence results
 */
export function alignWithChunkedDTW(
    humanWords: string[],
    aiWords: WordDTO[],
    chunkSize: number = 1500,
    overlapSize: number = 150,
    onProgress?: (current: number, total: number) => void
): MappedSentenceResult[] {
    const alignments = getChunkedWordAlignments(humanWords, aiWords, chunkSize, overlapSize, onProgress);
    return buildSentenceResults(alignments);
}

/**
 * Perform DTW (Dynamic Time Warping) alignment between human words and AI words
 * @param humanWords - Array of words from human transcript
 * @param aiWords - Array of word DTOs from AI transcript
 * @returns Array of word alignments (not sentences)
 */
export function alignWithDTW(humanWords: string[], aiWords: WordDTO[]): FinalTranscriptWordAlignment[] {
    const m = humanWords.length;
    const n = aiWords.length;

    // Initialize 2D array with Infinity
    const dtw: number[][] = Array.from({ length: m + 1 }, () =>
        Array(n + 1).fill(Number.MAX_VALUE)
    );

    dtw[0][0] = 0;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = calculateWordDistance(humanWords[i - 1], aiWords[j - 1].text);
            dtw[i][j] = cost + Math.min(
                dtw[i - 1][j],     // insertion
                dtw[i][j - 1],     // deletion
                dtw[i - 1][j - 1]  // match
            );
        }
    }

    const alignments = backtrackDTW(dtw, humanWords, aiWords);
    return alignments;
}

/**
 * Calculate the distance between two words using fuzzy matching
 * @param humanWord - Word from human transcript
 * @param aiWord - Word from AI transcript
 * @returns Distance score (0 = perfect match, 100 = no match)
 */
export function calculateWordDistance(humanWord: string, aiWord: string): number {
    const humanNorm = normalizeWord(humanWord);
    const aiNorm = normalizeWord(aiWord);

    if (!humanNorm || !aiNorm) return 100.0;
    if (humanNorm === aiNorm) return 0.0;

    // Using fuzzball ratio (0-100)
    const ratio = fuzz.ratio(humanNorm, aiNorm);
    return 100.0 - ratio;
}

/**
 * Backtrack through the DTW matrix to find the optimal alignment path
 * @param dtw - DTW cost matrix
 * @param humanWords - Array of human words
 * @param aiWords - Array of AI word DTOs
 * @returns Array of word alignments
 */
export function backtrackDTW(
    dtw: number[][],
    humanWords: string[],
    aiWords: WordDTO[]
): FinalTranscriptWordAlignment[] {
    const alignments: FinalTranscriptWordAlignment[] = [];
    let i = humanWords.length;
    let j = aiWords.length;

    while (i > 0 && j > 0) {
        const diagonal = dtw[i - 1][j - 1];
        const left = dtw[i][j - 1];
        const up = dtw[i - 1][j];

        if (diagonal <= left && diagonal <= up) {
            alignments.push({
                word: humanWords[i - 1],
                start: aiWords[j - 1].start,
                end: aiWords[j - 1].end,
                confidence: aiWords[j - 1].confidence * 100,
                isMatched: true,
                humanIndex: i - 1,
                aiIndex: j - 1
            });
            i--; j--;
        } else if (left <= up) {
            j--;
        } else {
            alignments.push({
                word: humanWords[i - 1],
                start: -1,
                end: -1,
                confidence: 0,
                isMatched: false,
                humanIndex: i - 1,
                aiIndex: -1
            });
            i--;
        }
    }

    while (i > 0) {
        alignments.push({
            word: humanWords[i - 1],
            start: -1,
            end: -1,
            confidence: 0,
            isMatched: false,
            humanIndex: i - 1,
            aiIndex: -1
        });
        i--;
    }

    alignments.reverse();
    interpolateUnmatchedWords(alignments);
    return alignments;
}

/**
 * Interpolate timestamps for unmatched words based on surrounding matched words
 * @param alignments - Array of word alignments (modified in place)
 */
export function interpolateUnmatchedWords(alignments: FinalTranscriptWordAlignment[]): void {
    for (let i = 0; i < alignments.length; i++) {
        if (!alignments[i].isMatched || alignments[i].start < 0) {
            let prevIdx = -1, nextIdx = -1;

            for (let j = i - 1; j >= 0; j--) {
                if (alignments[j].isMatched && alignments[j].start >= 0) { prevIdx = j; break; }
            }

            for (let j = i + 1; j < alignments.length; j++) {
                if (alignments[j].isMatched && alignments[j].start >= 0) { nextIdx = j; break; }
            }

            if (prevIdx >= 0 && nextIdx >= 0) {
                const prevEnd = alignments[prevIdx].end;
                const nextStart = alignments[nextIdx].start;
                const gapCount = nextIdx - prevIdx;

                if (nextStart > prevEnd && gapCount > 0) {
                    const timePerWord = (nextStart - prevEnd) / gapCount;
                    const offset = i - prevIdx;
                    alignments[i].start = prevEnd + (timePerWord * offset);
                    alignments[i].end = alignments[i].start + timePerWord;
                    alignments[i].confidence = calculateInterpolatedConfidence(
                        gapCount, alignments[prevIdx].confidence, alignments[nextIdx].confidence, nextStart - prevEnd);
                }
            } else if (prevIdx >= 0) {
                alignments[i].start = alignments[prevIdx].end;
                alignments[i].end = alignments[i].start + 300;
                alignments[i].confidence = Math.max(20, alignments[prevIdx].confidence * 0.4);
            } else if (nextIdx >= 0) {
                alignments[i].end = alignments[nextIdx].start;
                alignments[i].start = Math.max(0, alignments[i].end - 300);
                alignments[i].confidence = Math.max(20, alignments[nextIdx].confidence * 0.4);
            } else {
                alignments[i].start = i * 300.0;
                alignments[i].end = (i + 1) * 300.0;
                alignments[i].confidence = 10;
            }
        }
    }
}

/**
 * Calculate confidence score for interpolated words
 * @param gapCount - Number of gaps between matched words
 * @param prevConf - Confidence of previous matched word
 * @param nextConf - Confidence of next matched word
 * @param timeGap - Time gap between matched words
 * @returns Interpolated confidence score
 */
export function calculateInterpolatedConfidence(
    gapCount: number,
    prevConf: number,
    nextConf: number,
    timeGap: number
): number {
    const avgConf = (prevConf + nextConf) / 2;
    const gapPenalty = gapCount <= 2 ? 0.9 : gapCount <= 5 ? 0.7 : gapCount <= 10 ? 0.5 : 0.3;
    let timePenalty = 1.0;
    const expectedTime = gapCount * 400;

    if (timeGap > expectedTime * 2) timePenalty = 0.7;
    else if (timeGap > expectedTime * 1.5) timePenalty = 0.85;

    return Math.max(30, Math.min(95, avgConf * gapPenalty * timePenalty));
}

/**
 * Build sentence results from word alignments
 * @param alignments - Array of word alignments
 * @returns Array of mapped sentence results
 */
export function buildSentenceResults(alignments: FinalTranscriptWordAlignment[]): MappedSentenceResult[] {
    alignments = mergeEllipsis(alignments);
    const sentences: MappedSentenceResult[] = [];
    let currentSentence: FinalTranscriptWordAlignment[] = [];

    for (let i = 0; i < alignments.length; i++) {
        const alignment = alignments[i];
        currentSentence.push(alignment);

        if (/[.!?]$/.test(alignment.word)) {
            const isSalutationWord = isSalutation(alignment.word);
            let nextIsCapitalized = false;

            if (i + 1 < alignments.length) {
                const nextWord = alignments[i + 1].word;
                nextIsCapitalized = !!nextWord && /^[A-Z]/.test(nextWord);
            }

            if (isSalutationWord && nextIsCapitalized) {
                continue;
            }

            if (currentSentence.length > 0) {
                sentences.push(createSentenceResult(currentSentence));
                currentSentence = [];
            }
        }
    }

    if (currentSentence.length > 0) {
        sentences.push(createSentenceResult(currentSentence));
    }

    return sentences;
}

/**
 * Merge consecutive dots into ellipsis
 * @param alignments - Array of word alignments
 * @returns Array with merged ellipsis
 */
export function mergeEllipsis(alignments: FinalTranscriptWordAlignment[]): FinalTranscriptWordAlignment[] {
    const merged: FinalTranscriptWordAlignment[] = [];
    for (let i = 0; i < alignments.length; i++) {
        const current = alignments[i];
        if (current.word === "." && i + 2 < alignments.length &&
            alignments[i + 1].word === "." && alignments[i + 2].word === ".") {

            merged.push({
                word: "...",
                start: current.start,
                end: alignments[i + 2].end,
                confidence: (current.confidence + alignments[i + 1].confidence + alignments[i + 2].confidence) / 3,
                isMatched: current.isMatched && alignments[i + 1].isMatched && alignments[i + 2].isMatched,
                humanIndex: current.humanIndex,
                aiIndex: current.aiIndex
            });
            i += 2;
        } else {
            merged.push(current);
        }
    }
    return merged;
}

/**
 * Create a single sentence result from word alignments
 * @param words - Array of word alignments for the sentence
 * @returns MappedSentenceResult
 */
export function createSentenceResult(words: FinalTranscriptWordAlignment[]): MappedSentenceResult {
    const validWords = words.filter(w => w.start >= 0 && w.end >= 0);

    let sentenceStart = 0;
    let sentenceEnd = 0;
    let confidenceAverage = 0;

    if (validWords.length > 0) {
        sentenceStart = Math.min(...validWords.map(w => w.start));
        sentenceEnd = Math.max(...validWords.map(w => w.end));

        const totalConf = validWords.reduce((sum, w) => sum + w.confidence, 0);
        confidenceAverage = totalConf / validWords.length;
    }

    return {
        sentence: words.map(w => w.word).join(" "),
        start: Number(sentenceStart.toFixed(2)),
        end: Number(sentenceEnd.toFixed(2)),
        confidence: Number(confidenceAverage.toFixed(2))
    };
}

/**
 * Fix sentences with zero timestamps by interpolating from neighboring sentences
 * @param sentences - Array of sentence results
 * @returns Fixed sentence array
 */
export function fixSentenceTimestamps(sentences: MappedSentenceResult[], startIndex: number = 0): MappedSentenceResult[] {
    if (!sentences || sentences.length === 0) return sentences;

    for (let i = startIndex; i < sentences.length; i++) {
        // Find a block of sentences with missing timestamps (start=0, end=0)
        if (sentences[i].start === 0 && sentences[i].end === 0) {
            let rangeStart = i;
            let rangeEnd = i;

            while (rangeEnd < sentences.length && sentences[rangeEnd].start === 0 && sentences[rangeEnd].end === 0) {
                rangeEnd++;
            }
            rangeEnd--; // Point to the last zero-timestamp sentence

            // Find valid previous boundary
            let prevIdx = rangeStart - 1;
            while (prevIdx >= startIndex && (sentences[prevIdx].start === 0 && sentences[prevIdx].end === 0)) {
                prevIdx--;
            }
            if (prevIdx < startIndex) prevIdx = -1;

            // Find valid next boundary
            let nextIdx = rangeEnd + 1;
            while (nextIdx < sentences.length && (sentences[nextIdx].start === 0 && sentences[nextIdx].end === 0)) {
                nextIdx++;
            }
            // Adjust nextIdx if it went out of bounds
            if (nextIdx >= sentences.length) nextIdx = -1;
            // Adjust prevIdx if it went of out bounds (less than 0)
            if (prevIdx < 0) prevIdx = -1;


            if (prevIdx !== -1 && nextIdx !== -1) {
                // CASE 1: Gap enclosed by valid timestamps
                let startTime = sentences[prevIdx].end;
                let endTime = sentences[nextIdx].start;
                const gapCount = rangeEnd - rangeStart + 1;

                // Handle illogical timestamps (e.g. overlaps) or extremely small gaps
                // Enforce at least 500ms per line to avoid "stacking" timestamps
                const minDuration = gapCount * 500;
                if (endTime - startTime < minDuration) {
                    endTime = startTime + minDuration;
                    // Note: This effectively overlaps into the 'next' segment, but ensures readability
                }

                const duration = endTime - startTime;
                const timePerSentence = duration / gapCount;

                for (let j = rangeStart; j <= rangeEnd; j++) {
                    const offset = j - rangeStart;
                    sentences[j].start = Number((startTime + (timePerSentence * offset)).toFixed(0));
                    sentences[j].end = Number((startTime + (timePerSentence * (offset + 1))).toFixed(0));
                    
                    // Derive confidence from neighbors (penalized)
                    const combinedConf = (sentences[prevIdx].confidence + sentences[nextIdx].confidence) / 2 * 0.6;
                    sentences[j].confidence = Number(combinedConf.toFixed(2));
                }

            } else if (prevIdx !== -1) {
                // CASE 2: End of file gap (Extrapolate forward)
                const startTime = sentences[prevIdx].end;
                const timePerSentence = 2500; // Assume 2.5s per line for extrapolation
                
                for (let j = rangeStart; j <= rangeEnd; j++) {
                    const offset = j - rangeStart;
                    sentences[j].start = Number((startTime + (timePerSentence * offset)).toFixed(0));
                    sentences[j].end = Number((startTime + (timePerSentence * (offset + 1))).toFixed(0));
                    sentences[j].confidence = 30; // Low confidence for extrapolation
                }

            } else if (nextIdx !== -1) {
                // CASE 3: Start of file gap (Extrapolate backward)
                const endTime = sentences[nextIdx].start;
                const timePerSentence = 2500;
                const gapCount = rangeEnd - rangeStart + 1;
                
                // Calculate start time, ensuring it doesn't go below 0
                const startTime = Math.max(0, endTime - (gapCount * timePerSentence));
                // Recalculate duration based on clamped start
                const duration = endTime - startTime;
                const actualTimePerSentence = duration / gapCount;

                for (let j = rangeStart; j <= rangeEnd; j++) {
                    const offset = j - rangeStart;
                    sentences[j].start = Number((startTime + (actualTimePerSentence * offset)).toFixed(0));
                    sentences[j].end = Number((startTime + (actualTimePerSentence * (offset + 1))).toFixed(0));
                    sentences[j].confidence = 30;
                }
            } else {
                 // CASE 4: No valid timestamps at all in the file (Fallback)
                 let startTime = 0;
                 const timePerSentence = 3000;
                 for (let j = rangeStart; j <= rangeEnd; j++) {
                     sentences[j].start = startTime;
                     sentences[j].end = startTime + timePerSentence;
                     sentences[j].confidence = 0;
                     startTime += timePerSentence;
                 }
            }

            i = rangeEnd; // Skip processed block
        }
    }
    return sentences;
}
