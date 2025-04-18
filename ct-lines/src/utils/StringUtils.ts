// ANSI escape code for color sequences
const ANSI_REGEX = new RegExp('\x1B' + '\\[\\d+m', 'g');

/**
 * Strips ANSI color codes from a string
 */
export function stripAnsi(str: string): string {
    return str.replace(ANSI_REGEX, '');
}

/**
 * Gets the visible length of a string (excluding ANSI color codes)
 */
export function getVisibleLength(str: string): number {
    return stripAnsi(str).length;
}

/**
 * Pads a string to a specific length, taking into account ANSI color codes
 */
export function padString(str: string, length: number, char: string = ' '): string {
    const visibleLength = getVisibleLength(str);
    return str + char.repeat(Math.max(0, length - visibleLength));
}

/**
 * Centers a string in a field of given width, taking into account ANSI color codes
 */
export function centerString(str: string, width: number): string {
    const visibleLength = getVisibleLength(str);
    const leftPad = Math.floor((width - visibleLength) / 2);
    const rightPad = width - visibleLength - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
} 