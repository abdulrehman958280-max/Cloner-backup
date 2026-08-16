import test from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyError,
    serializeErrorSafely,
    getFriendlyErrorMessage,
    ERROR_CATEGORIES
} from '../services/reliability/index.js';

test('Error Classifier correctly categorizes Discord authentication failures as non-retryable', () => {
    const authErr = new Error('An invalid token was provided.');
    authErr.code = 0;
    const classified = classifyError(authErr);

    assert.equal(classified.code, ERROR_CATEGORIES.AUTHENTICATION_ERROR);
    assert.equal(classified.retryable, false);
});

test('Error Classifier correctly categorizes permission errors as non-retryable', () => {
    const permErr = new Error('Missing Permissions');
    permErr.code = 50013;
    permErr.status = 403;
    const classified = classifyError(permErr);

    assert.equal(classified.code, ERROR_CATEGORIES.PERMISSION_DENIED);
    assert.equal(classified.retryable, false);
});

test('Error Classifier correctly categorizes access denied errors', () => {
    const accessErr = new Error('Missing Access');
    accessErr.code = 50001;
    const classified = classifyError(accessErr);

    assert.equal(classified.code, ERROR_CATEGORIES.ACCESS_DENIED);
    assert.equal(classified.retryable, false);
});

test('Error Classifier correctly identifies 429 rate limits as retryable with retry-after', () => {
    const rateErr = new Error('You are being rate limited.');
    rateErr.status = 429;
    rateErr.retryAfter = 1250;
    rateErr.global = false;
    const classified = classifyError(rateErr);

    assert.equal(classified.code, ERROR_CATEGORIES.RATE_LIMITED);
    assert.equal(classified.retryable, true);
    assert.equal(classified.retryAfterMs, 1250);
});

test('Error Classifier identifies transient network disconnects as retryable', () => {
    const netErr = new Error('Client network socket disconnected before secure TLS connection was established');
    netErr.code = 'ECONNRESET';
    const classified = classifyError(netErr);

    assert.equal(classified.code, ERROR_CATEGORIES.NETWORK_ERROR);
    assert.equal(classified.retryable, true);
});

test('Error Classifier identifies cancellation immediately', () => {
    const cancelErr = new Error('Operation was cancelled by user.');
    cancelErr.name = 'AbortError';
    const classified = classifyError(cancelErr);

    assert.equal(classified.code, ERROR_CATEGORIES.CANCELLED);
    assert.equal(classified.retryable, false);
});

test('serializeErrorSafely strips potential tokens and returns safe structured object', () => {
    const secretToken = 'OTk5OTk5OTk5OTk5OTk5OTk5.Gz_abc.XYZ1234567890abcdefghijklmnopqrstuv';
    const rawErr = new Error(`Failed to authenticate with token ${secretToken}`);
    rawErr.code = 0;

    const safe = serializeErrorSafely(rawErr);
    assert.equal(safe.code, ERROR_CATEGORIES.AUTHENTICATION_ERROR);
    assert.ok(!safe.message.includes('XYZ1234567890'));
    assert.ok(safe.message.includes('[REDACTED_TOKEN]'));
});

test('getFriendlyErrorMessage produces user-actionable text', () => {
    const authClassified = classifyError(new Error('Invalid token'));
    const friendly = getFriendlyErrorMessage(authClassified);
    assert.ok(friendly.toLowerCase().includes('token'));
});
