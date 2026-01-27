import { DVTMetadata } from './types';

/**
 * Format milliseconds to seconds with decimal precision for DVT timecodes
 * @param ms - Milliseconds
 * @returns Seconds as decimal string
 */
function formatDVTTimecode(ms: number): string {
    return (ms / 1000).toFixed(3);
}

/**
 * Escape XML special characters while preserving whitespace
 * @param text: Text to escape
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
 * Generate OpenDVT (DepoView-compatible) XML content
 * @param metadata - DVT metadata including video info and synchronized sentences
 * @returns XML-formatted DVT content matching OpenDVT 2.0 specification
 */
export function generateDVT(metadata: DVTMetadata): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="ISO-8859-1"?>',
        '<!-- Copyright (C) 2013-2018 ExhibitView LLC.  All rights reserved. -->',
        '<OpenDVT UUID="{C475858E-138F-47C9-8775-536BCE1C9C94}" ShortID="XXXXXXX" Type="Deposition" Version="2.0">',
        '  <Information>',
        '    <Origination>',
        '      <ID>{726017C0-3402-4DCE-9834-7748390ABAD1}</ID>',
        '      <AppName>SyncExpress</AppName>',
        '      <AppVersion>1.0</AppVersion>',
        '      <VendorName>SyncExpress</VendorName>',
        '      <VendorPhone></VendorPhone>',
        '      <VendorURL></VendorURL>',
        '    </Origination>',
        '    <Case>',
        '      <MatterNumber></MatterNumber>',
        '    </Case>',
        '    <Witness>',
        `      <FirstName>${escapeXml(metadata.title)}</FirstName>`,
        '      <LastName></LastName>',
        '    </Witness>',
        '    <ReportingFirm>',
        '      <Name></Name>',
        '    </ReportingFirm>',
        '    <FirstPageNo>1</FirstPageNo>',
        '    <LastPageNo>0</LastPageNo>',
        '    <MaxLinesPerPage>25</MaxLinesPerPage>',
        '    <Volume>1</Volume>',
        `    <TakenOn>${metadata.createdDate}</TakenOn>`,
        '  </Information>',
        `  <Lines Count="${metadata.sentences.length}">`
    ];

    // Add each sentence as a Line element
    for (let i = 0; i < metadata.sentences.length; i++) {
        const sentence = metadata.sentences[i];
        // Use clean text (without line numbers) if available, otherwise use sentence
        const cleanText = sentence.text || sentence.sentence;
        const escapedText = escapeXml(cleanText);

        lines.push(`    <Line ID="${i}">`);
        lines.push(`      <PageNo>${sentence.pageNumber || 1}</PageNo>`);
        lines.push(`      <LineNo>${sentence.lineNumber || (i + 1)}</LineNo>`);
        
        // Only include timestamps if they exist (> 0)
        if (sentence.start > 0) {
            const startTime = formatDVTTimecode(sentence.start);
            const endTime = formatDVTTimecode(sentence.end);
            lines.push(`      <StartTime>${startTime}</StartTime>`);
            lines.push(`      <EndTime>${endTime}</EndTime>`);
        }
        
        lines.push(`      <Text>${escapedText}</Text>`);
        lines.push('    </Line>');
    }

    lines.push('  </Lines>');
    lines.push('  <Streams Count="1">');
    lines.push('    <Stream ID="0">');
    lines.push(`      <URI>${escapeXml(metadata.videoPath)}</URI>`);
    lines.push(`      <URIRelative>\\media\\${escapeXml(metadata.videoPath.split(/[/\\]/).pop() || 'video.mp4')}</URIRelative>`);
    lines.push('      <VolumeID></VolumeID>');
    lines.push('      <FileSize>0</FileSize>');
    lines.push(`      <FileDate>${metadata.createdDate}</FileDate>`);
    lines.push(`      <DurationMs>${Math.floor(metadata.duration)}</DurationMs>`);
    lines.push('      <VolumeLabel></VolumeLabel>');
    lines.push('    </Stream>');
    lines.push('  </Streams>');
    lines.push('</OpenDVT>');

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
