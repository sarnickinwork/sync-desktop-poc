import { SimpleTranscriptDto } from './types';
import { formatMs, parseMs } from './timeUtils';

/**
 * Merge multiple transcripts into a single transcript with adjusted timestamps
 * @param transcripts - Array of transcripts to merge
 * @returns Merged transcript DTO
 */
export function mergeTranscripts(transcripts: SimpleTranscriptDto[]): SimpleTranscriptDto {
    const finalDto: SimpleTranscriptDto = {
        fullText: "",
        sentences: [],
        words: []
    };
    let currentOffsetMs = 0;

    for (const t of transcripts) {
        finalDto.fullText += (finalDto.fullText ? " " : "") + t.fullText;

        for (const s of t.sentences) {
            const sStart = parseMs(s.start) + currentOffsetMs;
            const sEnd = parseMs(s.end) + currentOffsetMs;

            finalDto.sentences.push({
                text: s.text,
                confidence: s.confidence,
                start: formatMs(sStart),
                end: formatMs(sEnd)
            });
        }

        let lastWordEnd = 0;
        for (const w of t.words) {
            const newWord = {
                text: w.text,
                confidence: w.confidence,
                start: w.start + currentOffsetMs,
                end: w.end + currentOffsetMs
            };
            finalDto.words.push(newWord);
            if (w.end > lastWordEnd) lastWordEnd = w.end;
        }

        currentOffsetMs += lastWordEnd;
    }

    return finalDto;
}
