import test from 'node:test';
import assert from 'node:assert/strict';
import {
    executeDiscordOperation,
    OPERATION_POLICIES,
    AdaptiveRateLimiter,
    ERROR_CATEGORIES
} from '../services/reliability/index.js';

test('executeDiscordOperation succeeds on initial attempt', async () => {
    let callCount = 0;
    const result = await executeDiscordOperation({
        operationName: 'test_success',
        execute: async () => {
            callCount++;
            return { id: 'role_123', name: 'Admin' };
        }
    });

    assert.equal(callCount, 1);
    assert.equal(result.id, 'role_123');
});

test('executeDiscordOperation retries on transient network failure and succeeds', async () => {
    let callCount = 0;
    const retriesRecorded = [];

    const result = await executeDiscordOperation({
        operationName: 'test_retry',
        policy: { maxAttempts: 3, baseDelayMs: 20, maxDelayMs: 100 },
        execute: async ({ attempt }) => {
            callCount++;
            if (attempt === 1) {
                const netErr = new Error('Client network socket disconnected');
                netErr.code = 'ECONNRESET';
                throw netErr;
            }
            return { status: 'success' };
        },
        onRetry: (info) => {
            retriesRecorded.push(info);
        }
    });

    assert.equal(callCount, 2);
    assert.equal(retriesRecorded.length, 1);
    assert.equal(result.status, 'success');
});

test('executeDiscordOperation stops immediately on non-retryable permission error', async () => {
    let callCount = 0;

    await assert.rejects(
        async () => {
            await executeDiscordOperation({
                operationName: 'test_perm_fail',
                policy: { maxAttempts: 3, baseDelayMs: 20 },
                execute: async () => {
                    callCount++;
                    const permErr = new Error('Missing Permissions');
                    permErr.code = 50013;
                    permErr.status = 403;
                    throw permErr;
                }
            });
        },
        (err) => {
            assert.equal(err.code, ERROR_CATEGORIES.PERMISSION_DENIED);
            assert.equal(err.retryable, false);
            return true;
        }
    );

    assert.equal(callCount, 1);
});

test('executeDiscordOperation respects cancellation signal immediately', async () => {
    let isCancelled = false;
    let callCount = 0;

    const opPromise = executeDiscordOperation({
        operationName: 'test_cancel',
        policy: { maxAttempts: 3, baseDelayMs: 500 },
        isCancelled: () => isCancelled,
        execute: async () => {
            callCount++;
            const netErr = new Error('Network timeout');
            netErr.code = 'ETIMEDOUT';
            // Trigger cancel during retry wait
            setTimeout(() => { isCancelled = true; }, 30);
            throw netErr;
        }
    });

    await assert.rejects(
        opPromise,
        (err) => {
            assert.equal(err.code, ERROR_CATEGORIES.CANCELLED);
            return true;
        }
    );
});
