/**
 * Error Taxonomy & Classification Engine for Discloner
 * Provides standardized error categories, structured error objects,
 * retryability rules, and credential-safe error serialization.
 */

import { ERROR_CODES } from '../configContract.js';
import { sanitizeText } from '../../utils/logger.js';

export const ERROR_CATEGORIES = Object.freeze({
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    ACCESS_DENIED: 'ACCESS_DENIED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    DISCORD_API_ERROR: 'DISCORD_API_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFLICT: 'CONFLICT',
    NOT_FOUND: 'NOT_FOUND',
    UNSUPPORTED_RESOURCE: 'UNSUPPORTED_RESOURCE',
    CLEANUP_ERROR: 'CLEANUP_ERROR',
    CLONE_ERROR: 'CLONE_ERROR',
    VERIFICATION_ERROR: 'VERIFICATION_ERROR',
    CANCELLED: 'CANCELLED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
});

export const ERROR_SEVERITY = Object.freeze({
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
});

export class ClassifiedError extends Error {
    constructor({
        code,
        message,
        operation = 'unknown',
        resourceType = null,
        resourceId = null,
        retryable = false,
        statusCode = null,
        retryAfterMs = null,
        isGlobalRateLimit = false,
        attempt = 1,
        maxAttempts = 1,
        originalError = null
    }) {
        super(sanitizeText(message || 'An error occurred'));
        this.name = 'ClassifiedError';
        this.code = code || ERROR_CATEGORIES.INTERNAL_ERROR;
        this.operation = operation;
        this.resourceType = resourceType;
        this.resourceId = resourceId ? sanitizeText(String(resourceId)) : null;
        this.retryable = Boolean(retryable);
        this.statusCode = statusCode;
        this.retryAfterMs = retryAfterMs;
        this.isGlobalRateLimit = Boolean(isGlobalRateLimit);
        this.attempt = attempt;
        this.maxAttempts = maxAttempts;
        this.timestamp = new Date().toISOString();
        
        // Never attach sensitive credentials from originalError
        this.originalCode = originalError?.code || null;
    }
}

/**
 * Classifies any caught exception into a structured ClassifiedError
 */
export function classifyError(err, context = {}) {
    if (err instanceof ClassifiedError) {
        return err;
    }

    const message = (err?.message || String(err || '')).trim();
    const rawCode = err?.code;
    const status = err?.status || err?.httpStatus || err?.statusCode;
    const lowerMsg = message.toLowerCase();

    let category = ERROR_CATEGORIES.INTERNAL_ERROR;
    let retryable = false;
    let retryAfterMs = null;
    let isGlobalRateLimit = false;

    // 1. Cancellation Check
    if (
        err?.name === 'AbortError' ||
        lowerMsg.includes('cancelled by user') ||
        lowerMsg.includes('cancellation signal') ||
        context.isCancelled?.()
    ) {
        return new ClassifiedError({
            code: ERROR_CATEGORIES.CANCELLED,
            message: 'Operation was cancelled by user.',
            operation: context.operationName,
            resourceType: context.resourceType,
            resourceId: context.resourceId,
            retryable: false,
            attempt: context.attempt || 1,
            maxAttempts: context.maxAttempts || 1,
            originalError: err
        });
    }

    // 2. Authentication Errors (Strictly Non-Retryable)
    if (
        status === 401 ||
        rawCode === 40001 ||
        rawCode === 0 ||
        lowerMsg.includes('an invalid token was provided') ||
        lowerMsg.includes('improper token') ||
        lowerMsg.includes('unauthorized') ||
        lowerMsg.includes('login failed')
    ) {
        category = ERROR_CATEGORIES.AUTHENTICATION_ERROR;
        retryable = false;
    }

    // 3. Permission & Access Errors (Non-Retryable)
    else if (
        status === 403 ||
        rawCode === 50013 || // Missing Permissions
        rawCode === 50001 || // Missing Access
        rawCode === 50028 || // Invalid Role
        lowerMsg.includes('missing permissions') ||
        lowerMsg.includes('missing access') ||
        lowerMsg.includes('permission denied') ||
        lowerMsg.includes('cannot edit a role that is higher')
    ) {
        category = (rawCode === 50001 || lowerMsg.includes('missing access'))
            ? ERROR_CATEGORIES.ACCESS_DENIED
            : ERROR_CATEGORIES.PERMISSION_DENIED;
        retryable = false;
    }

    // 4. Rate Limiting (429) (Strictly Retryable)
    else if (
        status === 429 ||
        rawCode === 429 ||
        err?.retryAfter !== undefined ||
        err?.retry_after !== undefined ||
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('you are being rate limited') ||
        lowerMsg.includes('too many requests')
    ) {
        category = ERROR_CATEGORIES.RATE_LIMITED;
        retryable = true;

        // Parse retry-after if available
        if (typeof err?.retryAfter === 'number') {
            retryAfterMs = err.retryAfter;
        } else if (typeof err?.retry_after === 'number') {
            retryAfterMs = err.retry_after > 100 ? err.retry_after : Math.round(err.retry_after * 1000);
        } else if (err?.data?.retry_after) {
            const val = Number(err.data.retry_after);
            retryAfterMs = val > 100 ? val : Math.round(val * 1000);
        }

        if (err?.global || err?.data?.global) {
            isGlobalRateLimit = true;
        }
    }

    // 5. Network / Connection Errors (Retryable)
    else if (
        rawCode === 'ECONNRESET' ||
        rawCode === 'ETIMEDOUT' ||
        rawCode === 'ECONNREFUSED' ||
        rawCode === 'ENOTFOUND' ||
        rawCode === 'EAI_AGAIN' ||
        rawCode === 'EPIPE' ||
        rawCode === 'UND_ERR_SOCKET' ||
        lowerMsg.includes('econnreset') ||
        lowerMsg.includes('socket hang up') ||
        lowerMsg.includes('network error') ||
        lowerMsg.includes('fetch failed') ||
        lowerMsg.includes('client network socket disconnected')
    ) {
        category = ERROR_CATEGORIES.NETWORK_ERROR;
        retryable = true;
    }

    // 6. Timeouts (Retryable within bounds)
    else if (
        rawCode === 'TIMEOUT' ||
        lowerMsg.includes('timed out') ||
        lowerMsg.includes('timeout') ||
        lowerMsg.includes('gateway connection timed out')
    ) {
        category = ERROR_CATEGORIES.TIMEOUT;
        retryable = true;
    }

    // 7. Resource Not Found (Non-Retryable unless specifically handled)
    else if (
        status === 404 ||
        rawCode === 10003 || // Unknown Channel
        rawCode === 10004 || // Unknown Guild
        rawCode === 10011 || // Unknown Role
        rawCode === 10014 || // Unknown Webhook
        rawCode === 10008 || // Unknown Message
        lowerMsg.includes('unknown channel') ||
        lowerMsg.includes('unknown guild') ||
        lowerMsg.includes('unknown role') ||
        lowerMsg.includes('unknown message') ||
        lowerMsg.includes('not found')
    ) {
        category = ERROR_CATEGORIES.NOT_FOUND;
        retryable = false;
    }

    // 8. Conflicts
    else if (
        status === 409 ||
        rawCode === 30005 || // Maximum number of guilds reached
        rawCode === 30013 || // Maximum number of channels reached
        rawCode === 30007 || // Maximum number of webhooks reached
        lowerMsg.includes('maximum number of') ||
        lowerMsg.includes('already exists') ||
        lowerMsg.includes('conflict')
    ) {
        category = ERROR_CATEGORIES.CONFLICT;
        retryable = false;
    }

    // 9. Discord 5xx Server Errors (Transient / Retryable)
    else if (status >= 500 && status < 600) {
        category = ERROR_CATEGORIES.DISCORD_API_ERROR;
        retryable = true;
    }

    // 10. Validation Errors
    else if (
        lowerMsg.includes('invalid') ||
        lowerMsg.includes('validation') ||
        lowerMsg.includes('must be a valid') ||
        rawCode === 50035 // Invalid Form Body
    ) {
        category = ERROR_CATEGORIES.VALIDATION_ERROR;
        retryable = false;
    }

    return new ClassifiedError({
        code: category,
        message: sanitizeText(message),
        operation: context.operationName || 'unknown',
        resourceType: context.resourceType || null,
        resourceId: context.resourceId || null,
        retryable,
        statusCode: status || null,
        retryAfterMs,
        isGlobalRateLimit,
        attempt: context.attempt || 1,
        maxAttempts: context.maxAttempts || 1,
        originalError: err
    });
}

/**
 * Sanitizes and strips all credential/sensitive information from error payloads
 */
export function serializeErrorSafely(err) {
    if (!err) return null;

    const classified = (err instanceof ClassifiedError) ? err : classifyError(err);

    return {
        name: classified.name,
        code: classified.code,
        message: sanitizeText(classified.message),
        operation: classified.operation,
        resourceType: classified.resourceType,
        resourceId: classified.resourceId,
        retryable: classified.retryable,
        attempt: classified.attempt,
        maxAttempts: classified.maxAttempts,
        statusCode: classified.statusCode,
        retryAfterMs: classified.retryAfterMs,
        isGlobalRateLimit: classified.isGlobalRateLimit,
        timestamp: classified.timestamp
    };
}

/**
 * Translates classified errors into clear, friendly, actionable UI copy
 */
export function getFriendlyErrorMessage(classifiedErr) {
    const code = classifiedErr?.code || ERROR_CATEGORIES.INTERNAL_ERROR;
    const resType = classifiedErr?.resourceType || 'resource';
    const resId = classifiedErr?.resourceId ? ` (${classifiedErr.resourceId})` : '';

    switch (code) {
        case ERROR_CATEGORIES.AUTHENTICATION_ERROR:
            return 'Authentication failed. Please verify your Discord authorization token.';
        case ERROR_CATEGORIES.ACCESS_DENIED:
            return 'Access denied. Please ensure your account has access to the requested server.';
        case ERROR_CATEGORIES.PERMISSION_DENIED:
            return `Permission required to update ${resType}${resId}. Ensure your account has sufficient administrative permissions.`;
        case ERROR_CATEGORIES.RATE_LIMITED:
            return `Discord temporarily rate-limited this operation. Retrying automatically...`;
        case ERROR_CATEGORIES.NETWORK_ERROR:
            return 'Temporary connection problem with Discord Gateway. Reconnecting...';
        case ERROR_CATEGORIES.TIMEOUT:
            return `Operation timed out for ${resType}${resId}. Retrying within safety budget...`;
        case ERROR_CATEGORIES.NOT_FOUND:
            return `The specified ${resType}${resId} was not found or was deleted during migration.`;
        case ERROR_CATEGORIES.CONFLICT:
            return `Resource limit or conflict reached for ${resType}${resId}.`;
        case ERROR_CATEGORIES.CANCELLED:
            return 'Migration operation was cancelled by the user.';
        case ERROR_CATEGORIES.VALIDATION_ERROR:
            return sanitizeText(classifiedErr.message || 'Invalid parameters supplied.');
        default:
            return sanitizeText(classifiedErr.message || 'An unexpected error occurred during execution.');
    }
}
