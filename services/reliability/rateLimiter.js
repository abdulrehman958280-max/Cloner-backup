/**
 * Rate Limit & Backoff Engine for Discloner
 * Handles retry-after parsing, exponential backoff with bounded jitter,
 * route-aware rate limiting, and adaptive concurrency throttling.
 */

import { DEFAULT_CONFIG } from '../configContract.js';

/**
 * Normalizes retry-after information from various Discord error payloads
 * @param {Error|Object} err
 * @returns {number|null} delay in milliseconds (bounded)
 */
export function parseRetryAfter(err) {
    if (!err) return null;

    let ms = null;

    // 1. Direct ms property (e.g., discord.js RateLimitError retryAfter)
    if (typeof err.retryAfter === 'number' && !isNaN(err.retryAfter) && err.retryAfter > 0) {
        ms = err.retryAfter;
    } 
    // 2. Snake_case property
    else if (typeof err.retry_after === 'number' && !isNaN(err.retry_after) && err.retry_after > 0) {
        // If < 100, Discord API probably gave seconds -> convert to ms
        ms = err.retry_after > 100 ? err.retry_after : Math.round(err.retry_after * 1000);
    }
    // 3. Nested data object (REST error response data)
    else if (err.data && typeof err.data === 'object') {
        const raw = err.data.retry_after ?? err.data.retryAfter;
        if (raw !== undefined && raw !== null) {
            const num = Number(raw);
            if (!isNaN(num) && num > 0) {
                ms = num > 100 ? num : Math.round(num * 1000);
            }
        }
    }
    // 4. HTTP Headers (e.g. 'retry-after')
    else if (err.headers) {
        const headerVal = typeof err.headers.get === 'function'
            ? err.headers.get('retry-after')
            : (err.headers['retry-after'] || err.headers['Retry-After']);
        if (headerVal) {
            const num = Number(headerVal);
            if (!isNaN(num) && num > 0) {
                // HTTP standard retry-after header is in seconds (or date)
                ms = num > 100 ? num : Math.round(num * 1000);
            }
        }
    }

    if (ms === null || isNaN(ms)) return null;

    // Safety bounds: minimum 50ms, maximum 60,000ms
    return Math.max(50, Math.min(60000, Math.round(ms)));
}

/**
 * Calculates exponential backoff with bounded pseudo-random jitter
 * delay = min(maxDelay, baseDelay * 2^(attempt - 1)) + jitter
 */
export function calculateBackoff({
    attempt = 1,
    baseDelayMs = 500,
    maxDelayMs = 10000,
    jitterFactor = 0.25
}) {
    const safeAttempt = Math.max(1, Math.min(20, attempt));
    const safeBase = Math.max(10, baseDelayMs);
    const safeMax = Math.max(safeBase, maxDelayMs);

    // Exponential calculation
    const exponential = safeBase * Math.pow(2, safeAttempt - 1);
    const bounded = Math.min(safeMax, exponential);

    // Bounded jitter: +/- jitterFactor * bounded
    const jitterRange = bounded * Math.max(0, Math.min(1, jitterFactor));
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.max(50, Math.round(bounded + jitter));
}

/**
 * Adaptive Rate Limiter: tracks global and route/operation-level rate-limit states
 * Provides dynamic pacing calculation, event subscriptions, and real-time telemetry.
 */
export class AdaptiveRateLimiter {
    constructor() {
        this.globalBlockedUntil = 0;
        this.routeBlockedUntil = new Map();
        this.listeners = new Set();
        this.consecutiveSuccesses = 0;
        this.stats = {
            rateLimitEvents: 0,
            totalRateLimitWaitMs: 0,
            operationsDelayed: 0,
            retryCount: 0,
            maxRetryCount: 0,
            operationsFailedAfterRetry: 0,
            successfulOperations: 0
        };
    }

    /**
     * Subscribe to real-time rate limiter changes
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        }
        return () => {};
    }

    notifyListeners() {
        if (this.listeners.size === 0) return;
        const snapshot = this.getCapacitySnapshot();
        for (const cb of this.listeners) {
            try { cb(snapshot); } catch {}
        }
    }

    /**
     * Records a rate-limit event and adjusts backpressure
     */
    recordRateLimit(routeKey, retryAfterMs, isGlobal = false) {
        const duration = Math.max(100, retryAfterMs || 1500);
        const until = Date.now() + duration;

        this.stats.rateLimitEvents++;
        this.stats.totalRateLimitWaitMs += duration;
        this.consecutiveSuccesses = 0;

        if (isGlobal) {
            this.globalBlockedUntil = Math.max(this.globalBlockedUntil, until);
        } else if (routeKey) {
            const current = this.routeBlockedUntil.get(routeKey) || 0;
            this.routeBlockedUntil.set(routeKey, Math.max(current, until));
        }

        this.notifyListeners();
        return duration;
    }

    /**
     * Checks if a route or global channel is currently rate-limited
     * @returns {number} remaining wait time in ms (0 if ready)
     */
    getRemainingWaitMs(routeKey = null) {
        const now = Date.now();
        let wait = 0;

        if (this.globalBlockedUntil > now) {
            wait = Math.max(wait, this.globalBlockedUntil - now);
        }

        if (routeKey && this.routeBlockedUntil.has(routeKey)) {
            const routeUntil = this.routeBlockedUntil.get(routeKey);
            if (routeUntil > now) {
                wait = Math.max(wait, routeUntil - now);
            } else {
                this.routeBlockedUntil.delete(routeKey);
            }
        }

        return wait;
    }

    /**
     * Records a successful operation to gradually heal and restore capacity
     */
    recordSuccess() {
        this.stats.successfulOperations++;
        this.consecutiveSuccesses++;
        if (this.consecutiveSuccesses % 5 === 0) {
            this.notifyListeners();
        }
    }

    recordRetry(attempt) {
        this.stats.retryCount++;
        this.stats.maxRetryCount = Math.max(this.stats.maxRetryCount, attempt);
        this.consecutiveSuccesses = 0;
        this.notifyListeners();
    }

    recordDelayed() {
        this.stats.operationsDelayed++;
        this.notifyListeners();
    }

    recordExhausted() {
        this.stats.operationsFailedAfterRetry++;
        this.notifyListeners();
    }

    getStats() {
        return { ...this.stats };
    }

    /**
     * Dynamically calculates optimized delay between operations based on current capacity
     */
    getAdaptivePacingDelay(baseMs = 200) {
        const activeWait = this.getRemainingWaitMs();
        if (activeWait > 0) {
            return activeWait;
        }

        const snapshot = this.getCapacitySnapshot();
        const cap = snapshot.capacityPercent;

        if (cap >= 95) {
            return Math.max(80, baseMs);
        } else if (cap >= 75) {
            return Math.max(150, Math.round(baseMs * 1.35));
        } else if (cap >= 50) {
            return Math.max(250, Math.round(baseMs * 1.8));
        } else {
            return Math.max(450, Math.round(baseMs * 2.5));
        }
    }

    /**
     * Computes high-precision real-time rate limit capacity & backpressure health snapshot
     */
    getCapacitySnapshot() {
        const now = Date.now();
        const activeWaitMs = this.getRemainingWaitMs();
        const isBlocked = activeWaitMs > 0;

        let capacityPercent = 100;
        let status = 'OPTIMAL';
        let statusLabel = 'OPTIMAL (100%)';
        let pacingState = 'Clear';
        let healthLabel = 'Safe';

        if (isBlocked) {
            // Currently in active 429 backoff cooldown
            capacityPercent = Math.max(0, Math.min(40, Math.round((1 - (activeWaitMs / 10000)) * 40)));
            status = 'BACKOFF';
            statusLabel = `COOLDOWN (${(activeWaitMs / 1000).toFixed(1)}s)`;
            pacingState = 'Rate Limited';
            healthLabel = 'Backing Off';
        } else {
            // Calculate penalty with recovery based on consecutive successes
            const recentPenalty = Math.max(0, (this.stats.rateLimitEvents * 8) + (this.stats.operationsDelayed * 2) - Math.floor(this.consecutiveSuccesses / 4));
            const boundedPenalty = Math.min(55, recentPenalty);

            if (boundedPenalty > 0) {
                capacityPercent = Math.max(45, 100 - boundedPenalty);
                status = 'PULSING';
                statusLabel = `PACING (${capacityPercent}%)`;
                pacingState = 'Adaptive Delay';
                healthLabel = 'Adaptive Pacing';
            } else {
                capacityPercent = 100;
                status = 'OPTIMAL';
                statusLabel = 'OPTIMAL (100%)';
                pacingState = 'Zero Delay';
                healthLabel = 'Optimal';
            }
        }

        return {
            capacityPercent,
            status,
            statusLabel,
            pacingState,
            healthLabel,
            activeWaitMs: Math.max(0, activeWaitMs),
            rateLimitEvents: this.stats.rateLimitEvents,
            operationsDelayed: this.stats.operationsDelayed,
            retryCount: this.stats.retryCount,
            successfulOperations: this.stats.successfulOperations,
            totalWaitMs: this.stats.totalRateLimitWaitMs,
            timestamp: now
        };
    }

    reset() {
        this.globalBlockedUntil = 0;
        this.routeBlockedUntil.clear();
        this.consecutiveSuccesses = 0;
        this.stats = {
            rateLimitEvents: 0,
            totalRateLimitWaitMs: 0,
            operationsDelayed: 0,
            retryCount: 0,
            maxRetryCount: 0,
            operationsFailedAfterRetry: 0,
            successfulOperations: 0
        };
        this.notifyListeners();
    }
}

export const globalRateLimiter = new AdaptiveRateLimiter();
