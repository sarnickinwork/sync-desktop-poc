import { SimpleTranscriptDto, FinalTranscriptResponse } from './types';
import { splitIntoSentences, sanitizeSentences, extractWords } from './textProcessingUtils';
import { alignWithDTW, fixSentenceTimestamps } from './dtwAlignmentUtils';

/**
 * Perform text mapping between human transcript and AI transcript using DTW alignment
 * @param humanTranscript - Human transcript text
 * @param aiTranscript - AI transcript DTO with words and timestamps
 * @returns FinalTranscriptResponse with mapped sentences
 */
export function performTextMapping(
    humanTranscript: string,
    aiTranscript: SimpleTranscriptDto
): FinalTranscriptResponse {
    if (!humanTranscript || !humanTranscript.trim()) {
        throw new Error("Human transcript is empty");
    }

    if (!aiTranscript?.words || aiTranscript.words.length === 0) {
        throw new Error("AI transcript words are empty");
    }

    // Split human transcript into sentences
    const humanSentences = splitIntoSentences(humanTranscript);
    const sanitizedHumanSentences = sanitizeSentences(humanSentences);
    const humanWords = extractWords(sanitizedHumanSentences);

    // Perform DTW alignment
    let sentenceResults = alignWithDTW(humanWords, aiTranscript.words);

    // Fix any remaining sentences with zero timestamps
    sentenceResults = fixSentenceTimestamps(sentenceResults);

    return {
        success: true,
        totalSentences: sentenceResults.length,
        sentences: sentenceResults
    };
}
