import { MappedSentenceResult, SimpleTranscriptDto } from './types';

/**
 * Generate SMI (SAMI) subtitle content from mapped sentence results
 * @param sentences - Array of mapped sentence results with timestamps
 * @returns SMI formatted string
 */
export function generateSMI(sentences: MappedSentenceResult[]): string {
    const lines: string[] = [
        '<SAMI>',
        '<Head>',
        '<Title>Subtitle</Title>',
        '<Style type="text/css">',
        '<!--',
        'P { margin-left: 8pt; margin-right: 8pt; margin-bottom: 2pt; margin-top: 2pt;',
        '    text-align: center; font-size: 20pt; font-family: Arial, Sans-Serif;',
        '    font-weight: normal; color: white; }',
        '.ENCC { Name: English; lang: en-US; }',
        '-->',
        '</Style>',
        '</Head>',
        '<Body>',
        '<Sync Start=0><P Class=ENCC>&nbsp;'
    ];

    for (const sentence of sentences) {
        // Convert milliseconds to integer for SMI format
        const startMs = Math.round(sentence.start);
        const endMs = Math.round(sentence.end);
        
        // Escape special HTML characters in the sentence
        // Use cleaned text if available to avoid speaker labels in subtitles
        const escapedText = escapeHtml(sentence.text || sentence.sentence);
        
        // Add the subtitle entry
        lines.push(`<Sync Start=${startMs}><P Class=ENCC>${escapedText}`);
        
        // Add blank entry at end time to clear the subtitle
        lines.push(`<Sync Start=${endMs}><P Class=ENCC>&nbsp;`);
    }

    lines.push('</Body>');
    lines.push('</SAMI>');

    return lines.join('\r\n');
}

/**
 * Escape special HTML characters
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Download SMI content as a file
 * @param smiContent - SMI formatted string content
 * @param filename - Optional filename (defaults to 'subtitle.smi')
 */
export function downloadSMI(smiContent: string, filename: string = 'subtitle.smi'): void {
    const blob = new Blob([smiContent], { type: 'application/x-sami' });
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
 * Generate and download SMI file in one step
 * @param sentences - Array of mapped sentence results
 * @param filename - Optional filename (defaults to 'subtitle.smi')
 */
export function generateAndDownloadSMI(sentences: MappedSentenceResult[], filename?: string): void {
    const smiContent = generateSMI(sentences);
    downloadSMI(smiContent, filename);
}

/**
 * Generate SMI subtitles directly from AI transcription
 * Groups words into subtitle chunks for readable display
 * @param aiTranscript - AI transcript with word-level timestamps
 * @param maxWordsPerSubtitle - Maximum words per subtitle (default: 10)
 * @param maxDurationMs - Maximum duration per subtitle in ms (default: 3000)
 * @returns SMI formatted string
 */
export function generateSMIFromAI(
    aiTranscript: SimpleTranscriptDto,
    maxWordsPerSubtitle: number = 10,
    maxDurationMs: number = 3000
): string {
    const lines: string[] = [
        '<SAMI>',
        '<Head>',
        '<Title>AI Subtitles</Title>',
        '<Style type="text/css">',
        '<!--',
        'P { margin-left: 8pt; margin-right: 8pt; margin-bottom: 2pt; margin-top: 2pt;',
        '    text-align: center; font-size: 20pt; font-family: Arial, Sans-Serif;',
        '    font-weight: normal; color: white; }',
        '.ENCC { Name: English; lang: en-US; }',
        '-->',
        '</Style>',
        '</Head>',
        '<Body>',
        '<Sync Start=0><P Class=ENCC>&nbsp;'
    ];

    // Group words into subtitle chunks
    const words = aiTranscript.words;
    let currentChunk: string[] = [];
    let chunkStartMs = 0;
    let chunkEndMs = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Start new chunk if empty
        if (currentChunk.length === 0) {
            chunkStartMs = word.start;
        }
        
        currentChunk.push(word.text);
        chunkEndMs = word.end;
        
        // Determine if we should end this chunk
        const shouldEndChunk = 
            currentChunk.length >= maxWordsPerSubtitle ||
            (chunkEndMs - chunkStartMs) >= maxDurationMs ||
            i === words.length - 1;
        
        if (shouldEndChunk) {
            const text = currentChunk.join(' ');
            const escapedText = escapeHtml(text);
            
            lines.push(`<Sync Start=${Math.round(chunkStartMs)}><P Class=ENCC>${escapedText}`);
            lines.push(`<Sync Start=${Math.round(chunkEndMs)}><P Class=ENCC>&nbsp;`);
            
            currentChunk = [];
        }
    }

    lines.push('</Body>');
    lines.push('</SAMI>');

    return lines.join('\r\n');
}
