// --- Interfaces / DTOs ---

export interface SimpleTranscriptDto {
    fullText: string;
    sentences: SentenceDTO[];
    words: WordDTO[];
}

export interface SentenceDTO {
    text: string;
    start: string;
    end: string;
    confidence: string;
}

export interface WordDTO {
    text: string;
    start: number;
    end: number;
    confidence: number;
}

export interface FinalTranscriptResponse {
    success: boolean;
    totalSentences: number;
    sentences: MappedSentenceResult[];
}

export interface MappedSentenceResult {
    sentence: string;
    start: number;
    end: number;
    confidence: number;
}

// Internal helper for DTW
export interface FinalTranscriptWordAlignment {
    word: string;
    start: number;
    end: number;
    confidence: number;
    isMatched: boolean;
    humanIndex: number;
    aiIndex: number;
}

// Mimicking Multer/IFormFile structure
export interface UploadedFile {
    originalname: string;
    buffer: Uint8Array;
    mimetype: string;
    size: number;
}
