import { SYNMetadata } from './types';

/**
 * Generate SYN (proprietary) JSON content for SyncExpress app
 * @param metadata - SYN metadata including video, subtitle, and synchronization data
 * @returns JSON-formatted SYN content
 */
export function generateSYN(metadata: SYNMetadata): string {
    const synData = {
        version: '1.0',
        appSignature: 'SyncExpress-POC',
        createdAt: new Date().toISOString(),
        video: {
            filename: metadata.videoFilename,
            path: metadata.videoPath,
            duration: metadata.videoDuration
        },
        subtitle: {
            filename: metadata.subtitleFilename,
            path: metadata.subtitlePath,
            format: 'SAMI'
        },
        transcript: {
            filename: metadata.transcriptFilename,
            path: metadata.transcriptPath,
            startLine: metadata.startLine
        },
        synchronization: {
            totalSentences: metadata.sentences.length,
            sentences: metadata.sentences.map((s: { sentence: string; start: number; end: number; confidence: number }) => ({
                text: s.sentence,
                start: s.start,
                end: s.end,
                confidence: s.confidence
            }))
        }
    };

    return JSON.stringify(synData, null, 2);
}

/**
 * Download SYN content as a file
 * @param synContent - SYN JSON formatted string content
 * @param filename - Optional filename (defaults to 'sync.syn')
 */
export function downloadSYN(synContent: string, filename: string = 'sync.syn'): void {
    const blob = new Blob([synContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
}

/**
 * Generate and download SYN file in one step
 * @param metadata - SYN metadata
 * @param filename - Optional filename (defaults to 'sync.syn')
 */
export function generateAndDownloadSYN(metadata: SYNMetadata, filename?: string): void {
    const synContent = generateSYN(metadata);
    downloadSYN(synContent, filename);
}
