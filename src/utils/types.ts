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
    sentence: string;          // Original line with formatting (for display)
    text?: string;             // Clean text without line numbers (for DVT/SYN)
    start: number;
    end: number;
    confidence: number;
    pageNumber?: number;       // Optional page number from court transcript
    lineNumber?: number;       // Optional line number from court transcript
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

// DVT (DepoView) metadata structure
export interface DVTMetadata {
    title: string;
    videoFilename: string;
    videoPath: string;
    duration: number;
    createdDate: string;
    sentences: MappedSentenceResult[];
}

// SYN (proprietary) metadata structure
export interface SYNMetadata {
    videoFilename: string;
    videoPath: string;
    videoDuration: number;
    subtitleFilename: string;
    subtitlePath: string;
    transcriptFilename: string;
    transcriptPath: string;
    startLine: number;
    sentences: MappedSentenceResult[];
    // Resumable workflow fields
    rawTranscript?: SimpleTranscriptDto;
    sanitizedTranscript?: string;
    apiElapsedTime?: number;
    processingState?: {
        isApiComplete: boolean;
        isSanitizationComplete: boolean;
        isMappingComplete: boolean;
    };
}


export interface VideoItem {
    id: string; // Unique ID for dnd-kit
    path: string;
    name: string;
}

// --- PROJECT MANAGEMENT TYPES ---

export interface ProjectMetadata {
    id: string;
    name: string;
    savePath: string; // The user-selected output directory
    createdAt: string;
    lastModified: string;
    status: 'active' | 'completed';
}

export interface ProjectState {
    projectId: string;
    step: number;
    videos: VideoItem[];
    transcriptText: string | null;
    transcriptFileName: string | null;
    transcriptPath: string | null;
    startLine: string;
    syncedLines: any[];
    mappedResult: MappedSentenceResult[] | null;
    editedSubtitles: any[];
    splitPoints: number[];
    isProcessing: boolean; // Maybe we don't persist 'processing' state fully, but good to know
    hasAutoExported?: boolean;
}
