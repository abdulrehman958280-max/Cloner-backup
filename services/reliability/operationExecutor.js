/**
 * Central Discord Operation Executor
 * Manages retry classification, rate-limit backoff, cancellation interrupts,
 * retry budgets, deadlines, and safe error emission.
 */

import { classifyError, ClassifiedError, ERROR_CATEGORIES } from './errorTaxonomy.js';
import { parseRetryAfter, calculateBackoff, globalRateLimiter } from './rateLimiter.js';
import { withTimeout } from './timeout.js';

export const OPERATION_POLICIES = Object.freeze({
    READ: Object.freeze({
        name: 'READ',
        maxAttempts: 3,
        baseDelayMs: 400,
        maxDelayMs: 5000,
        maxTotalRetryTimeMs: 35000,
        operationTimeoutMs: 15000,
        jitterFactor: 0.2
    }),
    CREATE: Object.freeze({
        name: 'CREATE',
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 6000,
        maxTotalRetryTimeMs: 40000,
        operationTimeoutMs: 15000,
        jitterFactor: 0.2
    }),
    UPDATE: Object.freeze({
        name: 'UPDATE',
        maxAttempts: 3,
        baseDelayMs: 400,
        maxDelayMs: 5000,
        maxTotalRetryTimeMs: 30000,
        operationTimeoutMs: 12000,
        jitterFactor: 0.2
    }),
    DELETE: Object.freeze({
        name: 'DELETE',
        maxAttempts: 3,
        baseDelayMs: 400,
        maxDelayMs: 5000,
        maxTotalRetryTimeMs: 30000,
        operationTimeoutMs: 12000,
        jitterFactor: 0.2
    }),
    MESSAGE: Object.freeze({
        name: 'MESSAGE',
        maxAttempts: 2,
        baseDelayMs: 400,
        maxDelayMs: 4000,
        maxTotalRetryTimeMs: 20000,
        operationTimeoutMs: 10000,
        jitterFactor: 0.2
    }),
    VERIFICATION: Object.freeze({
        name: 'VERIFICATION',
        maxAttempts: 2,
        baseDelayMs: 400,
        maxDelayMs: 4000,
        maxTotalRetryTimeMs: 20000,
        operationTimeoutMs: 15000,
        jitterFactor: 0.15
    })
});

/**
 * Sleeps for ms with random humanized jitter to prevent Cloudflare/Discord bot detection
 */
export function jitteredSleep(baseMs, isCancelled = () => false, jitterFactor = 0.2, signal = null) {
    const safeBase = Math.max(0, baseMs);
    if (safeBase === 0) return Promise.resolve();
    const jitter = (Math.random() * 2 - 1) * jitterFactor * safeBase;
    const finalMs = Math.max(10, Math.round(safeBase + jitter));
    return cancellableSleep(finalMs, isCancelled, signal);
}

/**
 * Sleeps for ms, but aborts immediately if cancelled or aborted
 */
export function cancellableSleep(ms, isCancelled = () => false, signal = null) {
    return new Promise((resolve, reject) => {
        if (isCancelled() || signal?.aborted) {
            return reject(new ClassifiedError({
                code: ERROR_CATEGORIES.CANCELLED,
                message: 'Operation was cancelled during wait.',
                retryable: false
            }));
        }

        const safeMs = Math.max(0, ms);
        if (safeMs === 0) return resolve();

        const timeout = setTimeout(() => {
            cleanup();
            resolve();
        }, safeMs);

        const onAbort = () => {
            cleanup();
            reject(new ClassifiedError({
                code: ERROR_CATEGORIES.CANCELLED,
                message: 'Operation was cancelled during wait.',
                retryable: false
            }));
        };

        const interval = setInterval(() => {
            if (isCancelled()) {
                cleanup();
                reject(new ClassifiedError({
                    code: ERROR_CATEGORIES.CANCELLED,
                    message: 'Operation was cancelled during wait.',
                    retryable: false
                }));
            }
        }, 50);

        function cleanup() {
            clearTimeout(timeout);
            clearInterval(interval);
            if (signal) {
                signal.removeEventListener('abort', onAbort);
            }
        }

        if (signal) {
            signal.addEventListener('abort', onAbort);
        }
    });
}

/**
 * Executes an arbitrary Discord operation with full reliability wrapper,
 * strict per-operation timeouts, idempotency boundaries, rate-limit deadlines,
 * and guaranteed settling (SUCCESS | FAILED | TIMEOUT | CANCELLED).
 */
export async function executeDiscordOperation({
    operationName = 'discord_operation',
    resourceType = null,
    resourceId = null,
    execute,
    policy = OPERATION_POLICIES.CREATE,
    retryPolicy = null,
    operationTimeoutMs = null,
    rateLimiter = globalRateLimiter,
    signal = null,
    isCancelled = () => false,
    checkIdempotency = null,
    onRetry = () => {},
    onRateLimit = () => {},
    context = {}
}) {
    if (typeof execute !== 'function') {
        throw new Error(`executeDiscordOperation requires an execute function`);
    }

    const mergedPolicy = {
        ...(policy || OPERATION_POLICIES.CREATE),
        ...(retryPolicy || {})
    };

    const maxAttempts = Math.max(1, Math.min(5, mergedPolicy.maxAttempts || 3));
    const baseDelayMs = Math.max(100, mergedPolicy.baseDelayMs || 500);
    const maxDelayMs = Math.max(baseDelayMs, mergedPolicy.maxDelayMs || 6000);
    const maxTotalRetryTimeMs = mergedPolicy.maxTotalRetryTimeMs || 45000;
    const singleOpTimeoutMs = Math.max(20, operationTimeoutMs ?? mergedPolicy.operationTimeoutMs ?? 15000);
    const jitterFactor = mergedPolicy.jitterFactor ?? 0.2;

    const opStartTime = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < maxAttempts) {
        // 1. Check Cancellation before starting attempt
        if (isCancelled() || signal?.aborted) {
            throw new ClassifiedError({
                code: ERROR_CATEGORIES.CANCELLED,
                message: 'Operation was cancelled by user.',
                operation: operationName,
                resourceType,
                resourceId,
                retryable: false,
                attempt,
                maxAttempts
            });
        }

        const elapsedSoFar = Date.now() - opStartTime;
        if (elapsedSoFar >= maxTotalRetryTimeMs) {
            rateLimiter.recordExhausted();
            throw new ClassifiedError({
                code: ERROR_CATEGORIES.TIMEOUT,
                message: `Operation "${operationName}" exceeded maximum retry deadline (${maxTotalRetryTimeMs}ms).`,
                operation: operationName,
                resourceType,
                resourceId,
                retryable: false,
                attempt,
                maxAttempts,
                originalError: lastError
            });
        }

        attempt++;

        // 2. Check route / global rate limiter backpressure
        const routeKey = `${operationName}:${resourceType || 'global'}`;
        const proactiveWait = rateLimiter.getRemainingWaitMs(routeKey);
        if (proactiveWait > 0) {
            const safeProactiveWait = Math.min(15000, proactiveWait);
            rateLimiter.recordDelayed();
            onRateLimit({
                operation: operationName,
                resourceType,
                resourceId,
                retryAfterMs: safeProactiveWait,
                attempt,
                maxAttempts
            });
            // Safely wait out the rate-limit
            await cancellableSleep(safeProactiveWait, isCancelled, signal);
        }

        try {
            // 3. Optional Idempotency Check (read-before-create to prevent duplicates)
            if (typeof checkIdempotency === 'function') {
                const idempotencyTimeout = Math.min(4000, singleOpTimeoutMs);
                try {
                    const existing = await withTimeout(
                        checkIdempotency,
                        idempotencyTimeout,
                        { operationName: `${operationName}_idempotency_check`, resourceType, resourceId, isCancelled, signal }
                    );
                    if (existing) {
                        return existing;
                    }
                } catch (idempErr) {
                    // Non-fatal idempotency check failure; proceed to execute
                }
            }

            // 4. Perform actual Discord operation with hard timeout boundary
            const remainingForThisAttempt = Math.min(singleOpTimeoutMs, Math.max(20, maxTotalRetryTimeMs - elapsedSoFar));
            
            const result = await withTimeout(
                () => execute({ attempt }),
                remainingForThisAttempt,
                {
                    operationName,
                    resourceType,
                    resourceId,
                    isCancelled,
                    signal,
                    customMessage: `Discord operation "${operationName}" timed out after ${remainingForThisAttempt}ms.`
                }
            );

            if (typeof rateLimiter.recordSuccess === 'function') {
                rateLimiter.recordSuccess();
            }

            return result;

        } catch (rawErr) {
            const classified = classifyError(rawErr, {
                operationName,
                resourceType,
                resourceId,
                attempt,
                maxAttempts,
                isCancelled
            });

            lastError = classified;

            // 5. If Cancelled, throw immediately
            if (classified.code === ERROR_CATEGORIES.CANCELLED || isCancelled() || signal?.aborted) {
                throw classified;
            }

            // 6. Non-retryable error -> Stop immediately
            if (!classified.retryable) {
                throw classified;
            }

            // 7. Check if retry budget exhausted
            if (attempt >= maxAttempts) {
                rateLimiter.recordExhausted();
                throw classified;
            }

            // 8. Calculate Delay (Priority: Server Retry-After -> Exponential Backoff)
            let waitMs = 0;
            const parsedRetryAfter = parseRetryAfter(rawErr) || classified.retryAfterMs;

            if (parsedRetryAfter) {
                waitMs = parsedRetryAfter;
                rateLimiter.recordRateLimit(routeKey, waitMs, classified.isGlobalRateLimit);
                onRateLimit({
                    operation: operationName,
                    resourceType,
                    resourceId,
                    retryAfterMs: waitMs,
                    attempt,
                    maxAttempts
                });
            } else {
                waitMs = calculateBackoff({
                    attempt,
                    baseDelayMs,
                    maxDelayMs,
                    jitterFactor
                });
            }

            rateLimiter.recordRetry(attempt);

            onRetry({
                operation: operationName,
                resourceType,
                resourceId,
                attempt,
                maxAttempts,
                waitMs,
                error: classified
            });

            await cancellableSleep(waitMs, isCancelled, signal);
        }
    }

    throw lastError || new ClassifiedError({
        code: ERROR_CATEGORIES.INTERNAL_ERROR,
        message: `Operation "${operationName}" failed after ${maxAttempts} attempts.`,
        operation: operationName,
        resourceType,
        resourceId,
        attempt: maxAttempts,
        maxAttempts
    });
}
