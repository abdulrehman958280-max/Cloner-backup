/**
 * Unified Timeout & Cancellation Guard for Asynchronous Operations
 * Ensures that hanging promises, frozen REST calls, and stalled sockets
 * strictly settle within configurable bounded deadlines without blocking the pipeline.
 */

import { ClassifiedError, ERROR_CATEGORIES } from './errorTaxonomy.js';

/**
 * Wraps a promise or async executor function with a hard deadline and cancellation listener.
 *
 * @param {Promise|Function} promiseOrFn - The async promise or function to execute
 * @param {number} timeoutMs - Max execution time in milliseconds before timing out
 * @param {Object} options - Metadata for error classification & telemetry
 * @returns {Promise<any>} Result of the promise if resolved within timeout
 */
export async function withTimeout(promiseOrFn, timeoutMs = 30000, options = {}) {
    const {
        operationName = 'operation',
        resourceType = null,
        resourceId = null,
        isCancelled = () => false,
        signal = null,
        customMessage = null
    } = options;

    if (isCancelled() || signal?.aborted) {
        throw new ClassifiedError({
            code: ERROR_CATEGORIES.CANCELLED,
            message: 'Operation was cancelled by user.',
            operation: operationName,
            resourceType,
            resourceId,
            retryable: false
        });
    }

    let timer = null;
    let abortListener = null;
    let cancelInterval = null;

    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new ClassifiedError({
                code: ERROR_CATEGORIES.TIMEOUT,
                message: customMessage || `Operation "${operationName}" timed out after ${timeoutMs}ms.`,
                operation: operationName,
                resourceType,
                resourceId,
                retryable: true
            }));
        }, Math.max(10, timeoutMs));

        if (signal) {
            abortListener = () => {
                reject(new ClassifiedError({
                    code: ERROR_CATEGORIES.CANCELLED,
                    message: 'Operation was aborted by signal.',
                    operation: operationName,
                    resourceType,
                    resourceId,
                    retryable: false
                }));
            };
            signal.addEventListener('abort', abortListener, { once: true });
        }

        cancelInterval = setInterval(() => {
            if (isCancelled()) {
                reject(new ClassifiedError({
                    code: ERROR_CATEGORIES.CANCELLED,
                    message: 'Operation was cancelled by user.',
                    operation: operationName,
                    resourceType,
                    resourceId,
                    retryable: false
                }));
            }
        }, 50);
    });

    try {
        const rawPromise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
        return await Promise.race([rawPromise, timeoutPromise]);
    } finally {
        if (timer) clearTimeout(timer);
        if (cancelInterval) clearInterval(cancelInterval);
        if (signal && abortListener) {
            signal.removeEventListener('abort', abortListener);
        }
    }
}
