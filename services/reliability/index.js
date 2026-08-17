/**
 * Centralized Reliability Layer Exports
 */

export {
    ERROR_CATEGORIES,
    ERROR_SEVERITY,
    ClassifiedError,
    classifyError,
    serializeErrorSafely,
    getFriendlyErrorMessage
} from './errorTaxonomy.js';

export {
    parseRetryAfter,
    calculateBackoff,
    AdaptiveRateLimiter,
    globalRateLimiter
} from './rateLimiter.js';

export {
    OPERATION_POLICIES,
    cancellableSleep,
    executeDiscordOperation
} from './operationExecutor.js';

export {
    withTimeout,
    TimeoutError
} from './timeout.js';


export {
    CONCURRENCY_LIMITS,
    createConcurrencyLimiter,
    mapWithConcurrency
} from './concurrencyManager.js';
