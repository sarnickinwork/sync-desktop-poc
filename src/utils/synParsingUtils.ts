/**
 * Utility for parsing SYN (proprietary) files
 */

// Import shared types to ensure consistency (optional, but good practice if we can)
import { SimpleTranscriptDto } from './types';

export interface SynSentence {
    text: string;
    start: number;
    end: number;
    confidence: number;
}

export interface SynData {
    version: string;
    video: {
        filename: string;
        path: string;
        duration: number;
    };
    subtitle?: {
        filename: string;
        path: string;
        format: string;
    };
    transcript?: {
        filename: string;
        path: string;
        startLine: number;
        sanitizedText?: string | null;
    };
    rawResponse?: Partial<SimpleTranscriptDto> | null;
    stats?: {
        apiElapsedTime?: number;
    };
    processingState?: {
        isApiComplete: boolean;
        isSanitizationComplete: boolean;
        isMappingComplete: boolean;
    };
    synchronization: {
        sentences: SynSentence[];
    };
}

/**
 * Parses raw SYN JSON content
 */
export function parseSYN(content: string): SynData {
    try {
        const data = JSON.parse(content);

        // Basic validation
        if (!data.synchronization || !Array.isArray(data.synchronization.sentences)) {
            throw new Error("Invalid SYN file format: missing synchronization data");
        }

        return data as SynData;
    } catch (err) {
        throw new Error(`Failed to parse SYN file: ${err}`);
    }
}
