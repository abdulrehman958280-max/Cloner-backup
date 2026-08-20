/**
 * Structured Logging & Sanitization Utility
 */

const TOKEN_PATTERN = /([a-zA-Z0-9_-]{18,}\.[a-zA-Z0-9_-]{4,}\.[a-zA-Z0-9_-]{20,})/g;
const GENERIC_TOKEN_PATTERN = /(mfa\.[a-zA-Z0-9_-]{20,})/g;

// Global memory buffer to hold the last 150 system events for Copilot "God Mode"
const systemLogBuffer = [];

export function getSystemMemory() {
    return systemLogBuffer;
}

export function pushToSystemMemory(entry) {
    systemLogBuffer.unshift(entry);
    if (systemLogBuffer.length > 150) {
        systemLogBuffer.pop();
    }
}

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
    const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        type: ['info', 'success', 'warning', 'error', 'stage'].includes(type) ? type : 'info',
        message: sanitizeText(message),
        detail: detail ? sanitizeText(detail) : null,
        stage: stage || null,
        timestamp: formatTimestamp()
    };
    
    // Automatically push to real-time copilot memory
    pushToSystemMemory(entry);
    return entry;
}
