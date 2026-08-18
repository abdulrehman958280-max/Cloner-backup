/**
 * Centralized Configuration Contract & Default Settings
 * Single source of truth for Discloner (frontend, backend, validation, presets, tests)
 */

export const DEFAULT_CONFIG = Object.freeze({
    // Core structural cloning
    cloneRoles: true,
    cloneChannels: true,
    clonePermissions: true,
    cloneProfile: true,

    // Message history & attachments (Explicitly OFF by default)
    cloneMessages: false,
    cloneAttachments: false,

    // Destructive cleanup (Default ON)
    cleanTarget: true,
    cleanupMode: 'full', // 'none' | 'managed' | 'matching' | 'full'

    // Message tuning defaults
    msgLimit: 15,
    msgDelay: 250, // 250ms fast responsive default pacing

    // Role Reliability options
    continueOnRoleError: true,
    reuseExistingRoles: true,
    roleOperationTimeoutMs: 30000,

    // Range constraints
    limits: Object.freeze({
        minMsgLimit: 1,
        maxMsgLimit: 1000,
        defaultMsgLimit: 1000,
        minMsgDelay: 0,
        maxMsgDelay: 5000,
        defaultMsgDelay: 250
    }),

    // Safety policies
    mentionPolicy: 'sanitize', // 'sanitize' (neutralizes @everyone and @here) | 'allow'
    conflictPolicy: 'create' // 'create' | 'update' | 'skip'
});

export const CLEANUP_MODES = Object.freeze({
    NONE: 'none',
    MANAGED: 'managed',
    MATCHING: 'matching',
    FULL: 'full'
});

export const ERROR_CODES = Object.freeze({
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
    CLEANUP_FAILURE: 'CLEANUP_FAILURE',
    CLEANUP_ERROR: 'CLEANUP_ERROR',
    CLONE_FAILURE: 'CLONE_FAILURE',
    CLONE_ERROR: 'CLONE_ERROR',
    VERIFICATION_FAILURE: 'VERIFICATION_FAILURE',
    VERIFICATION_ERROR: 'VERIFICATION_ERROR',
    CANCELLED: 'CANCELLED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
});

export const RELIABILITY_CONFIG = Object.freeze({
    retry: Object.freeze({
        enabled: true,
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 10000,
        jitter: true,
        maxTotalRetryTimeMs: 30000
    }),
    rateLimit: Object.freeze({
        respectRetryAfter: true,
        maxWaitMs: 60000,
        concurrencyReduction: true
    }),
    timeouts: Object.freeze({
        operationTimeoutMs: 15000,
        authTimeoutMs: 30000
    }),
    concurrency: Object.freeze({
        maxJobs: 50,
        maxOperations: 50,
        maxMessages: 20,
        maxCleaner: 20
    })
});

export const VERIFICATION_STATUSES = Object.freeze({
    VERIFIED: 'VERIFIED',
    VERIFIED_WITH_WARNINGS: 'VERIFIED_WITH_WARNINGS',
    PARTIAL: 'PARTIAL',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
});
