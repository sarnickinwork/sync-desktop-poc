/**
 * Transcript Processing Utilities
 * 
 * This module exports all utility functions for transcript processing,
 * DTW alignment, and AssemblyAI integration.
 */

// Types
export * from './types';

// Time utilities
export { formatMs, parseMs } from './timeUtils';

// Text processing utilities
export {
    splitIntoSentences,
    mergeHonorificSentences,
    sanitizeSentences,
    extractWords,
    normalizeWord,
    isSalutation,
    extractHumanTranscriptFromContent
} from './textProcessingUtils';

// Transcript merge utilities
export { mergeTranscripts } from './transcriptMergeUtils';

// DTW alignment utilities
export {
    alignWithDTW,
    calculateWordDistance,
    backtrackDTW,
    interpolateUnmatchedWords,
    calculateInterpolatedConfidence,
    buildSentenceResults,
    mergeEllipsis,
    createSentenceResult,
    fixSentenceTimestamps
} from './dtwAlignmentUtils';

// Text mapping utilities
export { performTextMapping } from './textMappingUtils';

// SMI generation utilities
export { generateSMI, downloadSMI, generateAndDownloadSMI } from './smiGenerationUtils';
export { parseSMI } from './smiParsingUtils';

// DVT generation utilities
export { generateDVT, downloadDVT, generateAndDownloadDVT } from './dvtGenerationUtils';

// SYN generation utilities
export { generateSYN, downloadSYN, generateAndDownloadSYN } from './synGenerationUtils';
export { parseSYN } from './synParsingUtils';

// Export all types
export type { DVTMetadata, SYNMetadata } from './types';

