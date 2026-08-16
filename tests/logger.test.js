import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeText, createLogEntry, formatTimestamp } from '../utils/logger.js';

test('sanitizeText redacts sensitive Discord token formats', () => {
    const raw = 'Attempting login with token MTA5Mjg0NzU2MTgyOTQwMQ.GxyzAb.sampleTokenHashValueHere1234567890';
    const sanitized = sanitizeText(raw);
    assert.equal(sanitized.includes('MTA5Mjg0NzU2MTgyOTQwMQ'), false);
    assert.match(sanitized, /\[REDACTED_TOKEN\]/);
});

test('createLogEntry creates structured log items with unique IDs', () => {
    const log1 = createLogEntry('success', 'Role cloned', 'Admin Role', 'cloning_roles');
    assert.equal(log1.type, 'success');
    assert.equal(log1.message, 'Role cloned');
    assert.equal(log1.detail, 'Admin Role');
    assert.equal(log1.stage, 'cloning_roles');
    assert.ok(log1.id.startsWith('log_'));
    assert.ok(typeof log1.timestamp === 'string');

    const log2 = createLogEntry('invalid_type', 'System notice');
    assert.equal(log2.type, 'info'); // fallback to info
});

test('formatTimestamp returns valid HH:MM:SS format', () => {
    const ts = formatTimestamp(new Date('2026-08-15T12:30:45Z'));
    assert.match(ts, /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/);
});
