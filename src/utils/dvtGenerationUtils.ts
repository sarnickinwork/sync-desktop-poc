import { DVTMetadata } from './types';

/**
 * Escape XML special characters while preserving whitespace
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
 * Replace regular spaces with non-breaking spaces for DVT format
 * @param text - Text to process
 * @returns Text with \xa0 instead of spaces
 */
function replaceSpaces(text: string): string {
    return text.replace(/ /g, '\xa0');
}

/**
 * Detect QA (Question/Answer) type from line text
 * @param text - Line text to analyze
 * @returns 'Q' for question, 'A' for answer, '-' for neither
 */
function detectQA(text: string): string {
    const trimmed = text.trim();
    
    // Check for explicit Q. or A. markers
    if (/^Q\.\s/i.test(trimmed) || /^QUESTION:/i.test(trimmed)) {
        return 'Q';
    }
    if (/^A\.\s/i.test(trimmed) || /^ANSWER:/i.test(trimmed)) {
        return 'A';
    }
    
    // Check for common answer phrases
    if (/^(THE\s+WITNESS|MR\.|MS\.|MRS\.|DR\.)/i.test(trimmed)) {
        return 'A';
    }
    
    // Default to no Q/A marker
    return '-';
}

/**
 * Check if a line is a page header (just a page number centered)
 * @param text - Line text
 * @returns true if this is a page header line
 */
function isPageHeader(text: string): boolean {
    const trimmed = text.trim();
    // Page headers are typically just numbers, possibly with some whitespace
    return /^\d{1,4}$/.test(trimmed);
}

/**
 * Generate OpenDVT (DepoView-compatible) XML content
 * @param metadata - DVT metadata including video info and synchronized sentences
 * @returns XML-formatted DVT content matching OpenDVT 2.0 specification
 */
export function generateDVT(metadata: DVTMetadata): string {
    // Filter out empty lines and page headers
    const validLines = metadata.sentences.filter(s => {
        const cleanText = (s.text || s.sentence).trim();
        return cleanText.length > 0 && !isPageHeader(cleanText);
    });

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
        '    <Case>',
        `      <FirstName>${escapeXml(metadata.title)}</FirstName>`,
        '      <LastName></LastName>',
        '    </Case>',
        '    <ReportingFirm>',
        '      <Name></Name>',
        '    </ReportingFirm>',
        '    <FirstPageNo>1</FirstPageNo>',
        '    <LastPageNo>0</LastPageNo>',
        '    <MaxLinesPerPage>25</MaxLinesPerPage>',
        '    <Volume>1</Volume>',
        `    <TakenOn>${metadata.createdDate}</TakenOn>`,
        '  </Information>',
        `  <Lines Count="${validLines.length}">`
    ];

    // Add each valid line
    for (let i = 0; i < validLines.length; i++) {
        const sentence = validLines[i];
        // Use clean text (without line numbers) if available
        const cleanText = sentence.text || sentence.sentence;
        // Replace spaces with \xa0 and escape XML
        const formattedText = replaceSpaces(cleanText);
        const escapedText = escapeXml(formattedText);
        
        // Detect Q/A type
        const qaType = detectQA(cleanText);

        lines.push(`    <Line ID="${i}">`);
        
        // Add Stream and TimeMs if timestamp exists
        if (sentence.start > 0) {
            lines.push('      <Stream>0</Stream>');
            lines.push(`      <TimeMs>${Math.round(sentence.start)}</TimeMs>`);
        }
        
        lines.push(`      <PageNo>${sentence.pageNumber || 1}</PageNo>`);
        lines.push(`      <LineNo>${sentence.lineNumber || (i + 1)}</LineNo>`);
        lines.push(`      <QA>${qaType}</QA>`);
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
