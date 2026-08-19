/**
 * Concurrency & Task Queue Manager for Discloner
 * Provides bounded parallel execution, worker pools, backpressure,
 * and stage-specific concurrency control.
 */

export const CONCURRENCY_LIMITS = Object.freeze({
    GLOBAL_MAX_JOBS: 3,
    ROLES: 2,
    CATEGORIES: 2,
    CHANNELS: 2,
    PERMISSIONS: 2,
    MESSAGES: 1, // Safe sequential message piping
    CLEANER: 2,  // Safe deletion concurrency
    CLEANER_ROLE_CONCURRENCY: 2, // Safe role deletion concurrency
    CLEANER_CHANNEL_CONCURRENCY: 2, // Safe channel deletion concurrency
    READ: 4
});

/**
 * Creates a concurrency-limiting queue runner (similar to p-limit)
 * @param {number} concurrency
 * @returns {Function} limiter function
 */
export function createConcurrencyLimiter(concurrency = 3) {
    const limit = Math.max(1, Math.min(20, concurrency));
    let activeCount = 0;
    const queue = [];

    const next = () => {
        if (activeCount < limit && queue.length > 0) {
            activeCount++;
            const { fn, resolve, reject } = queue.shift();
            
            Promise.resolve()
                .then(fn)
                .then(
                    (val) => {
                        activeCount--;
                        resolve(val);
                        next();
                    },
                    (err) => {
                        activeCount--;
                        reject(err);
                        next();
                    }
                );
        }
    };

    return function run(fn) {
        return new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            next();
        });
    };
}

/**
 * Maps an array of items through an async iterator with bounded concurrency,
 * cancellation checks, and error isolation.
 */
export async function mapWithConcurrency(items, concurrencyLimit, iteratorFn, {
    isCancelled = () => false,
    signal = null,
    onProgress = null,
    continueOnError = true
} = {}) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const results = new Array(items.length);
    let completedCount = 0;
    const total = items.length;
    const limiter = createConcurrencyLimiter(concurrencyLimit);

    const promises = items.map((item, index) => {
        return limiter(async () => {
            if (isCancelled() || signal?.aborted) {
                const cancelErr = new Error('Operation was cancelled.');
                cancelErr.code = 'CANCELLED';
                throw cancelErr;
            }

            try {
                const res = await iteratorFn(item, index);
                results[index] = { status: 'fulfilled', value: res };
                return res;
            } catch (err) {
                results[index] = { status: 'rejected', reason: err };
                if (!continueOnError) {
                    throw err;
                }
                return null;
            } finally {
                completedCount++;
                if (typeof onProgress === 'function') {
                    onProgress(completedCount, total, item);
                }
            }
        });
    });

    if (continueOnError) {
        await Promise.allSettled(promises);
    } else {
        await Promise.all(promises);
    }

    return results;
}
