/**
 * Clone Intelligence - Error Classification & Diagnostics Engine
 * Classifies Discord API errors, network exceptions, and permission faults,
 * providing structured diagnostics, retryability strategies, and fallback paths.
 */

import { ERROR_CODES } from '../configContract.js';

export const ERROR_CATEGORIES = Object.freeze({
    RETRYABLE: 'RETRYABLE',
    RATE_LIMIT: 'RATE_LIMIT',
    NETWORK: 'NETWORK',
    TIMEOUT: 'TIMEOUT',
    PERMISSION: 'PERMISSION',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    UNSUPPORTED: 'UNSUPPORTED',
    CAPACITY: 'CAPACITY',
    FATAL: 'FATAL',
    UNKNOWN: 'UNKNOWN'
});

/**
 * Classifies an error into a standardized intelligence error diagnostic
 * @param {Error|Object} error The thrown exception or error object
 * @param {Object} context Additional context (resourceType, resourceName, phase)
 * @returns {Object} Diagnostic report
 */
export function classifyError(error, context = {}) {
    const message = String(error?.message || error || '').toLowerCase();
    const code = error?.code || error?.status || null;
    const resourceType = context.resourceType || 'RESOURCE';
    const resourceName = context.resourceName || 'item';

    // 1. Rate Limit
    if (code === 429 || message.includes('rate limit') || message.includes('429') || message.includes('you are being rate limited')) {
        const retryAfter = error?.retryAfter || error?.data?.retry_after || 1.5;
        return {
            category: ERROR_CATEGORIES.RATE_LIMIT,
            code: ERROR_CODES.RATE_LIMITED,
            retryable: true,
            maxRetries: 5,
            backoffMs: Math.ceil(retryAfter * 1000) + 200,
            allowFallback: false,
            shouldAbortJob: false,
            userMessage: `Discord rate limit encountered while processing ${resourceType} "${resourceName}". Backing off safely for ${retryAfter}s.`,
            actionRecommendation: 'The rate limiter will automatically wait and resume without data loss.'
        };
    }

    // 2. Permission Denied
    if (code === 50013 || code === 403 || message.includes('missing permissions') || message.includes('privilege') || message.includes('unauthorized') || message.includes('forbidden')) {
        return {
            category: ERROR_CATEGORIES.PERMISSION,
            code: ERROR_CODES.PERMISSION_DENIED,
            retryable: false,
            maxRetries: 0,
            backoffMs: 0,
            allowFallback: true,
            shouldAbortJob: false,
            userMessage: `Missing permission to manage ${resourceType} "${resourceName}".`,
            actionRecommendation: `Ensure the user account has Administrator or Manage ${resourceType}s role positioned above target items.`
        };
    }

    // 3. Network / Connection Reset
    if (message.includes('econnreset') || message.includes('etimedout') || message.includes('socket hang up') || message.includes('fetch failed') || message.includes('network')) {
        return {
            category: ERROR_CATEGORIES.NETWORK,
            code: ERROR_CODES.NETWORK_ERROR,
            retryable: true,
            maxRetries: 4,
            backoffMs: 1000,
            allowFallback: false,
            shouldAbortJob: false,
            userMessage: `Network interruption while synchronizing ${resourceType} "${resourceName}". Retrying with exponential backoff.`,
            actionRecommendation: 'Self-healing connection recovery active.'
        };
    }

    // 4. Timeout
    if (message.includes('timeout') || message.includes('timed out') || code === 'ETIMEDOUT') {
        return {
            category: ERROR_CATEGORIES.TIMEOUT,
            code: ERROR_CODES.TIMEOUT,
            retryable: true,
            maxRetries: 3,
            backoffMs: 1500,
            allowFallback: false,
            shouldAbortJob: false,
            userMessage: `Discord gateway took too long to respond for ${resourceType} "${resourceName}".`,
            actionRecommendation: 'Retrying operation with an extended timeout window.'
        };
    }

    // 5. Maximum Guild Resources Reached (Capacity)
    if (code === 30005 || code === 30013 || message.includes('maximum number of') || message.includes('limit reached')) {
        return {
            category: ERROR_CATEGORIES.CAPACITY,
            code: ERROR_CODES.UNSUPPORTED_RESOURCE,
            retryable: false,
            maxRetries: 0,
            backoffMs: 0,
            allowFallback: false,
            shouldAbortJob: false,
            userMessage: `Target server has reached the maximum allowed limit for ${resourceType}s.`,
            actionRecommendation: 'Clean unused items or boost the server to unlock higher capacity.'
        };
    }

    // 6. Unsupported Channel Type or Feature
    if (code === 50024 || message.includes('cannot execute on this channel type') || message.includes('unsupported')) {
        return {
            category: ERROR_CATEGORIES.UNSUPPORTED,
            code: ERROR_CODES.UNSUPPORTED_RESOURCE,
            retryable: false,
            maxRetries: 0,
            backoffMs: 0,
            allowFallback: true,
            fallbackType: 'GUILD_TEXT',
            shouldAbortJob: false,
            userMessage: `Unsupported channel type for "${resourceName}". Gracefully degrading to standard text channel.`,
            actionRecommendation: 'Fallback channel created to preserve messages and structure.'
        };
    }

    // 7. Not Found
    if (code === 10003 || code === 10011 || code === 404 || message.includes('unknown channel') || message.includes('unknown role')) {
        return {
            category: ERROR_CATEGORIES.NOT_FOUND,
            code: ERROR_CODES.NOT_FOUND,
            retryable: false,
            maxRetries: 0,
            backoffMs: 0,
            allowFallback: false,
            shouldAbortJob: false,
            userMessage: `Resource ${resourceType} "${resourceName}" was deleted or not found on Discord.`,
            actionRecommendation: 'Skipping nonexistent reference.'
        };
    }

    // Default Unknown Error
    return {
        category: ERROR_CATEGORIES.UNKNOWN,
        code: ERROR_CODES.INTERNAL_ERROR,
        retryable: true,
        maxRetries: 2,
        backoffMs: 800,
        allowFallback: false,
        shouldAbortJob: false,
        userMessage: `Error processing ${resourceType} "${resourceName}": ${message}`,
        actionRecommendation: 'Retrying with jitter backoff.'
    };
}
