/**
 * Input Validation & Normalization Service
 */

import { DEFAULT_CONFIG, CLEANUP_MODES, ERROR_CODES } from './configContract.js';

const SNOWFLAKE_REGEX = /^[0-9]{17,20}$/;

export function validateSnowflake(id, fieldName = 'ID') {
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
        return { 
            valid: false, 
            code: ERROR_CODES.VALIDATION_ERROR,
            error: `${fieldName} is required.` 
        };
    }
    const cleanId = String(id).trim();
    if (!SNOWFLAKE_REGEX.test(cleanId)) {
        return { 
            valid: false, 
            code: ERROR_CODES.VALIDATION_ERROR,
            error: `${fieldName} must be a valid 17-20 digit Discord Snowflake ID.` 
        };
    }
    return { valid: true, value: cleanId };
}

export function validateToken(token) {
    if (!token || typeof token !== 'string') {
        return { 
            valid: false, 
            code: ERROR_CODES.AUTHENTICATION_ERROR,
            error: 'Discord authentication token is required.' 
        };
    }
    const cleanToken = token.trim();
    if (cleanToken.length < 20) {
        return { 
            valid: false, 
            code: ERROR_CODES.AUTHENTICATION_ERROR,
            error: 'The provided token appears too short or invalid.' 
        };
    }
    return { valid: true, value: cleanToken };
}

export function normalizeCloneOptions(options = {}) {
    const rawLimit = parseInt(options.msgLimit, 10);
    const msgLimit = isNaN(rawLimit) 
        ? DEFAULT_CONFIG.msgLimit 
        : Math.max(DEFAULT_CONFIG.limits.minMsgLimit, Math.min(DEFAULT_CONFIG.limits.maxMsgLimit, rawLimit));

    const rawDelay = parseInt(options.msgDelay, 10);
    const msgDelay = isNaN(rawDelay) 
        ? DEFAULT_CONFIG.msgDelay 
        : Math.max(DEFAULT_CONFIG.limits.minMsgDelay, Math.min(DEFAULT_CONFIG.limits.maxMsgDelay, rawDelay));

    // Message History is explicitly OFF by default
    const cloneMessages = options.cloneMessages === true;
    const cloneAttachments = cloneMessages ? (options.cloneAttachments === true) : false;

    // Destructive Clean Target is ON by default
    const cleanTarget = options.cleanTarget !== false;
    const cleanupMode = Object.values(CLEANUP_MODES).includes(options.cleanupMode) 
        ? options.cleanupMode 
        : (cleanTarget ? CLEANUP_MODES.FULL : CLEANUP_MODES.NONE);

    return {
        cloneRoles: options.cloneRoles !== false,
        cloneChannels: options.cloneChannels !== false,
        clonePermissions: options.clonePermissions !== false,
        cloneProfile: options.cloneProfile !== false,
        cloneEmojis: options.cloneEmojis === true,
        cloneStickers: options.cloneStickers === true,
        cloneWebhooks: options.cloneWebhooks === true,
        cloneMessages,
        cloneAttachments,
        cleanTarget,
        cleanupMode,
        msgLimit,
        msgDelay,
        stripInvites: options.stripInvites === true,
        customFind: typeof options.customFind === 'string' ? options.customFind.slice(0, 100) : '',
        customReplace: typeof options.customReplace === 'string' ? options.customReplace.slice(0, 100) : '',
        mentionPolicy: options.mentionPolicy === 'allow' ? 'allow' : DEFAULT_CONFIG.mentionPolicy,
        conflictPolicy: ['skip', 'update', 'create'].includes(options.conflictPolicy) 
            ? options.conflictPolicy 
            : DEFAULT_CONFIG.conflictPolicy
    };
}

export function validateClonePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { 
            valid: false, 
            code: ERROR_CODES.VALIDATION_ERROR,
            error: 'Invalid request payload.' 
        };
    }

    const tokenRes = validateToken(payload.userToken);
    if (!tokenRes.valid) return tokenRes;

    const sourceRes = validateSnowflake(payload.sourceId, 'Source Server ID');
    if (!sourceRes.valid) return sourceRes;

    const targetRes = validateSnowflake(payload.targetId, 'Target Server ID');
    if (!targetRes.valid) return targetRes;

    if (sourceRes.value === targetRes.value) {
        return { 
            valid: false, 
            code: ERROR_CODES.VALIDATION_ERROR,
            error: 'Source and Target Server IDs cannot be identical.' 
        };
    }

    return {
        valid: true,
        userToken: tokenRes.value,
        sourceId: sourceRes.value,
        targetId: targetRes.value,
        options: normalizeCloneOptions(payload.options)
    };
}
