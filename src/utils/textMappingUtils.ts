import { SimpleTranscriptDto, FinalTranscriptResponse } from './types';
import { splitIntoSentences, sanitizeSentences, extractWords } from './textProcessingUtils';
import { alignWithChunkedDTW, fixSentenceTimestamps } from './dtwAlignmentUtils';

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

    console.log(`Text mapping: ${humanWords.length} human words, ${aiTranscript.words.length} AI words`);

    // Use chunked DTW for large transcripts (>3000 words)
    const useChunked = humanWords.length > 3000 || aiTranscript.words.length > 3000;
    
    if (useChunked) {
        console.log("Using chunked DTW for large transcript...");
    }

    // Perform DTW alignment (chunked for large files)
    let sentenceResults = alignWithChunkedDTW(humanWords, aiTranscript.words, 1500, 150, (current, total) => {
        console.log(`Processing chunk ${current}/${total}...`);
    });

    // Fix any remaining sentences with zero timestamps
    sentenceResults = fixSentenceTimestamps(sentenceResults);

    return {
        success: true,
        totalSentences: sentenceResults.length,
        sentences: sentenceResults
    };
}
