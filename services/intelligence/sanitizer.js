/**
 * Clone Intelligence - Context Sanitizer
 * Strips user tokens, authorization headers, passwords, and sensitive identifiers
 * before telemetry logging, AI model ingestion, or client broadcasts.
 */

// Regular expressions matching Discord user tokens, bot tokens, and Bearer headers
const TOKEN_REGEXES = [
    /mfa\.[a-z0-9_-]{20,}/gi,
    /[a-z0-9_-]{23,28}\.[a-z0-9_-]{6,7}\.[a-z0-9_-]{27,}/gi,
    /bot\s+[a-z0-9_.-]{40,}/gi,
    /bearer\s+[a-z0-9_.-]{20,}/gi
];

/**
 * Redacts any sensitive token strings from raw text
 * @param {string} text 
 * @returns {string} Sanitized text
 */
export function sanitizeSensitiveText(text) {
    if (!text || typeof text !== 'string') return text || '';
    let result = text;
    for (const regex of TOKEN_REGEXES) {
        result = result.replace(regex, '[REDACTED_TOKEN]');
    }
    return result;
}

/**
 * Creates a sanitized context payload safe for AI ingestion
 * @param {Object} context Raw migration context
 * @returns {Object} Cleaned structured payload with no credentials
 */
export function sanitizeAiContext(context) {
    if (!context || typeof context !== 'object') return {};

    const safeCopy = {
        sourceSummary: context.sourceSummary ? {
            name: sanitizeSensitiveText(context.sourceSummary.name || 'Source Guild'),
            rolesCount: context.sourceSummary.rolesCount || 0,
            channelsCount: context.sourceSummary.channelsCount || 0,
            categoriesCount: context.sourceSummary.categoriesCount || 0,
            emojisCount: context.sourceSummary.emojisCount || 0,
            stickersCount: context.sourceSummary.stickersCount || 0,
            webhooksCount: context.sourceSummary.webhooksCount || 0,
            channelBreakdown: context.sourceSummary.channelBreakdown || {}
        } : null,
        targetSummary: context.targetSummary ? {
            name: sanitizeSensitiveText(context.targetSummary.name || 'Target Guild'),
            rolesCount: context.targetSummary.rolesCount || 0,
            channelsCount: context.targetSummary.channelsCount || 0,
            emojisCount: context.targetSummary.emojisCount || 0,
            stickersCount: context.targetSummary.stickersCount || 0,
            availableEmojiCapacity: context.targetSummary.availableEmojiCapacity ?? 50,
            availableStickerCapacity: context.targetSummary.availableStickerCapacity ?? 5,
            userPermissions: context.targetSummary.userPermissions || []
        } : null,
        compatibility: context.compatibility ? {
            status: context.compatibility.status,
            reasons: (context.compatibility.reasons || []).map(r => sanitizeSensitiveText(r)),
            warnings: (context.compatibility.warnings || []).map(w => sanitizeSensitiveText(w))
        } : null,
        cleanupPlan: context.cleanupPlan ? {
            removableRoles: context.cleanupPlan.removableRoles || 0,
            protectedRoles: context.cleanupPlan.protectedRoles || 0,
            removableChannels: context.cleanupPlan.removableChannels || 0,
            protectedChannels: context.cleanupPlan.protectedChannels || 0,
            ticketChannelsPreserved: context.cleanupPlan.ticketChannelsPreserved || 0,
            removableEmojis: context.cleanupPlan.removableEmojis || 0,
            removableWebhooks: context.cleanupPlan.removableWebhooks || 0
        } : null,
        migrationState: context.migrationState ? {
            jobId: context.migrationState.jobId,
            status: context.migrationState.status,
            stage: context.migrationState.stage,
            progress: context.migrationState.progress,
            statCounters: context.migrationState.statCounters || {},
            error: context.migrationState.error ? sanitizeSensitiveText(context.migrationState.error) : null,
            rateLimitStatus: context.migrationState.rateLimitStatus || 'OPTIMAL'
        } : null,
        verification: context.verification ? {
            status: context.verification.status,
            score: context.verification.score,
            dimensionalScores: context.verification.dimensionalScores || {},
            mismatchesCount: context.verification.mismatches?.length || 0
        } : null,
        errors: (context.errors || []).map(err => ({
            code: err.code || 'UNKNOWN',
            message: sanitizeSensitiveText(err.message || ''),
            resourceType: err.resourceType || null
        }))
    };

    return safeCopy;
}
