/**
 * Structured Logging & Sanitization Utility
 */

const TOKEN_PATTERN = /([a-zA-Z0-9_-]{18,}\.[a-zA-Z0-9_-]{4,}\.[a-zA-Z0-9_-]{20,})/g;
const GENERIC_TOKEN_PATTERN = /(mfa\.[a-zA-Z0-9_-]{20,})/g;

export function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(TOKEN_PATTERN, '[REDACTED_TOKEN]')
        .replace(GENERIC_TOKEN_PATTERN, '[REDACTED_TOKEN]');
}

export function formatTimestamp(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

export function createLogEntry(type, message, detail = null, stage = null) {
    return {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        type: ['info', 'success', 'warning', 'error', 'stage'].includes(type) ? type : 'info',
        message: sanitizeText(message),
        detail: detail ? sanitizeText(detail) : null,
        stage: stage || null,
        timestamp: formatTimestamp()
    };
}
