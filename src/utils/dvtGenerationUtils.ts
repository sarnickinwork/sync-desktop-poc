import { DVTMetadata } from './types';

/**
 * Format milliseconds to HH:MM:SS.mmm timecode format
 * @param ms - Milliseconds
 * @returns Formatted timecode string
 */
function formatTimecode(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor(ms % 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Escape XML special characters
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate DVT (DepoView-compatible) XML content
 * @param metadata - DVT metadata including video info and synchronized sentences
 * @returns XML-formatted DVT content
 */
export function generateDVT(metadata: DVTMetadata): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<DepositionVideo>',
        '  <Metadata>',
        `    <Title>${escapeXml(metadata.title)}</Title>`,
        `    <VideoFile>${escapeXml(metadata.videoPath)}</VideoFile>`,
        `    <Duration>${metadata.duration.toFixed(3)}</Duration>`,
        `    <CreatedDate>${metadata.createdDate}</CreatedDate>`,
        `    <TotalLines>${metadata.sentences.length}</TotalLines>`,
        '  </Metadata>',
        '  <Transcript>'
    ];

    // Add each synchronized sentence as a transcript line
    for (const sentence of metadata.sentences) {
        const startTimecode = formatTimecode(sentence.start);
        const endTimecode = formatTimecode(sentence.end);
        const escapedText = escapeXml(sentence.sentence);

        lines.push(`    <Line timecode="${startTimecode}" end="${endTimecode}" confidence="${sentence.confidence.toFixed(4)}">`);
        lines.push(`      <Text>${escapedText}</Text>`);
        lines.push('    </Line>');
    }

    lines.push('  </Transcript>');
    lines.push('</DepositionVideo>');

    return lines.join('\r\n');
}

/**
 * Download DVT content as a file
 * @param dvtContent - DVT XML formatted string content
 * @param filename - Optional filename (defaults to 'deposition.dvt')
 */
export function downloadDVT(dvtContent: string, filename: string = 'deposition.dvt'): void {
    const blob = new Blob([dvtContent], { type: 'application/xml' });
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
 * Generate and download DVT file in one step
 * @param metadata - DVT metadata
 * @param filename - Optional filename (defaults to 'deposition.dvt')
 */
export function generateAndDownloadDVT(metadata: DVTMetadata, filename?: string): void {
    const dvtContent = generateDVT(metadata);
    downloadDVT(dvtContent, filename);
}
