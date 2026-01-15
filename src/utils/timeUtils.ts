/**
 * Time utility functions for formatting and parsing milliseconds
 */

/**
 * Format milliseconds to MM:SS.mmm string
 * @param ms - Milliseconds to format
 * @returns Formatted time string (e.g., "01:30.500")
 */
export function formatMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    const mmm = milliseconds.toString().padStart(3, '0');

    return `${mm}:${ss}.${mmm}`;
}

/**
 * Parse MM:SS.mmm time string to milliseconds
 * @param timeStr - Time string in MM:SS.mmm format
 * @returns Milliseconds
 */
export function parseMs(timeStr: string): number {
    if (!timeStr) return 0;
    
    // Expected format MM:SS.mmm
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;

    const minutes = parseInt(parts[0], 10);
    const secondsParts = parts[1].split('.');
    
    const seconds = parseInt(secondsParts[0], 10);
    const milliseconds = secondsParts.length > 1 ? parseInt(secondsParts[1], 10) : 0;

    return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
}
