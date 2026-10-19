// sanitize.js
// Sanitization utilities for all user-facing input.
// All user input that gets stored, displayed, or used in filenames should
// pass through a function here before being written to state.

/**
 * Sanitizes a score title for safe storage and use as a download filename.
 * - Strips control characters
 * - Strips characters that are invalid in filenames on Windows/Mac/Linux
 * - Trims whitespace
 * - Enforces a maximum length
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeTitle(raw) {
    return String(raw)
        .replace(/[\x00-\x1F\x7F]/g, '')   // control characters
        .replace(/[\/\\:*?"<>|]/g, '')       // filename-unsafe characters
        .trim()
        .slice(0, 100);
}

/**
 * Escapes text for insertion into HTML (element content or a quoted attribute).
 * Use for anything that came from a file or the server, such as MIDI track names.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
