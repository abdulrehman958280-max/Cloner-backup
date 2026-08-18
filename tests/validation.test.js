import test from 'node:test';
import assert from 'node:assert/strict';
import { 
    validateSnowflake, 
    validateToken, 
    normalizeCloneOptions, 
    validateClonePayload 
} from '../services/validationService.js';

test('validateSnowflake rejects empty or non-numeric ids', () => {
    assert.equal(validateSnowflake('').valid, false);
    assert.equal(validateSnowflake('abc').valid, false);
    assert.equal(validateSnowflake('12345').valid, false); // too short
    assert.equal(validateSnowflake(null).valid, false);
});

test('validateSnowflake accepts valid Discord snowflake', () => {
    const res = validateSnowflake('110293847561829401');
    assert.equal(res.valid, true);
    assert.equal(res.value, '110293847561829401');
});

test('validateToken checks token presence and length', () => {
    assert.equal(validateToken('').valid, false);
    assert.equal(validateToken('short').valid, false);
    assert.equal(validateToken(null).valid, false);
    assert.equal(validateToken('sample-valid-looking-discord-token-value-1234567890').valid, true);
});

test('normalizeCloneOptions sets sane defaults and clamps limits', () => {
    const opts = normalizeCloneOptions({});
    assert.equal(opts.cloneRoles, true);
    assert.equal(opts.cloneChannels, true);
    assert.equal(opts.clonePermissions, true);
    assert.equal(opts.cloneProfile, true);
    assert.equal(opts.cloneMessages, false); // Default OFF
    assert.equal(opts.cloneAttachments, false); // Default OFF when messages OFF
    assert.equal(opts.cleanTarget, true); // Default ON
    assert.equal(opts.msgLimit, 15);
    assert.equal(opts.msgDelay, 250);

    const withMessages = normalizeCloneOptions({ cloneMessages: true, cloneAttachments: true });
    assert.equal(withMessages.cloneMessages, true);
    assert.equal(withMessages.cloneAttachments, true);

    const clampedOpts = normalizeCloneOptions({ msgLimit: 1500, msgDelay: -10 });
    assert.equal(clampedOpts.msgLimit, 1000);
    assert.equal(clampedOpts.msgDelay, 0);
});

test('validateClonePayload validates complete request payload', () => {
    const invalidPayload = validateClonePayload({});
    assert.equal(invalidPayload.valid, false);

    const identicalServers = validateClonePayload({
        userToken: 'sample-valid-looking-discord-token-value-1234567890',
        sourceId: '110293847561829401',
        targetId: '110293847561829401'
    });
    assert.equal(identicalServers.valid, false);
    assert.match(identicalServers.error, /cannot be identical/i);

    const validPayload = validateClonePayload({
        userToken: 'sample-valid-looking-discord-token-value-1234567890',
        sourceId: '110293847561829401',
        targetId: '129384756102938475',
        options: { msgLimit: 25 }
    });
    assert.equal(validPayload.valid, true);
    assert.equal(validPayload.sourceId, '110293847561829401');
    assert.equal(validPayload.targetId, '129384756102938475');
    assert.equal(validPayload.options.msgLimit, 25);
});
