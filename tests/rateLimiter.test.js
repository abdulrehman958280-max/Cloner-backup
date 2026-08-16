import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseRetryAfter,
    calculateBackoff,
    AdaptiveRateLimiter
} from '../services/reliability/index.js';

test('parseRetryAfter correctly parses millisecond values', () => {
    const err = { retryAfter: 1500 };
    assert.equal(parseRetryAfter(err), 1500);
});

test('parseRetryAfter converts second-based values to milliseconds', () => {
    const err = { retry_after: 2.5 };
    assert.equal(parseRetryAfter(err), 2500);
});

test('parseRetryAfter parses nested data and headers', () => {
    const errWithData = { data: { retry_after: 3 } };
    assert.equal(parseRetryAfter(errWithData), 3000);

    const errWithHeader = { headers: { 'retry-after': '4' } };
    assert.equal(parseRetryAfter(errWithHeader), 4000);
});

test('calculateBackoff produces values within valid exponential bounds', () => {
    const b1 = calculateBackoff({ attempt: 1, baseDelayMs: 500, maxDelayMs: 5000, jitterFactor: 0.1 });
    const b2 = calculateBackoff({ attempt: 2, baseDelayMs: 500, maxDelayMs: 5000, jitterFactor: 0.1 });
    const b3 = calculateBackoff({ attempt: 3, baseDelayMs: 500, maxDelayMs: 5000, jitterFactor: 0.1 });

    assert.ok(b1 >= 400 && b1 <= 600);
    assert.ok(b2 >= 800 && b2 <= 1200);
    assert.ok(b3 >= 1600 && b3 <= 2400);
});

test('AdaptiveRateLimiter tracks rate limits and computes remaining delay', () => {
    const limiter = new AdaptiveRateLimiter();
    assert.equal(limiter.getRemainingWaitMs('create_role'), 0);

    limiter.recordRateLimit('create_role', 500);
    const wait = limiter.getRemainingWaitMs('create_role');
    assert.ok(wait > 0 && wait <= 550);

    const stats = limiter.getStats();
    assert.equal(stats.rateLimitEvents, 1);
});
