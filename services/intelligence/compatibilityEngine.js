/**
 * Clone Intelligence - Guild Compatibility Engine
 * Evaluates architectural compatibility between source and target guilds,
 * identifying capacity bottlenecks, permission deficits, and unsupported features.
 */

export const COMPATIBILITY_STATUSES = Object.freeze({
    COMPATIBLE: 'COMPATIBLE',
    PARTIALLY_COMPATIBLE: 'PARTIALLY_COMPATIBLE',
    INCOMPATIBLE: 'INCOMPATIBLE'
});

/**
 * Assesses compatibility between source analysis and target analysis
 * @param {Object} sourceAnalysis Result from analyzeSourceGuild
 * @param {Object} targetAnalysis Result from analyzeTargetGuild
 * @param {Object} options Clone configuration options
 * @returns {Object} Compatibility assessment with status, reasons, warnings, and recommendations
 */
export function checkGuildCompatibility(sourceAnalysis, targetAnalysis, options = {}) {
    const reasons = [];
    const warnings = [];
    const recommendations = [];

    if (!sourceAnalysis || !targetAnalysis) {
        return {
            status: COMPATIBILITY_STATUSES.INCOMPATIBLE,
            reasons: ['Missing source or target analysis data'],
            warnings: [],
            recommendations: ['Perform a deep scan before checking compatibility']
        };
    }

    let isFatal = false;

    // 1. Check User Administrative Permissions on Target
    if (targetAnalysis.missingPermissions && targetAnalysis.missingPermissions.length > 0) {
        const missingStr = targetAnalysis.missingPermissions.join(', ');
        reasons.push(`Missing critical permissions on target server: ${missingStr}`);
        isFatal = true;
        recommendations.push(`Grant the user or their highest role the following permissions on the target server: ${missingStr}`);
    }

    // 2. Check Discord API Global Capacity Limits
    const MAX_DISCORD_CHANNELS = 500;
    const MAX_DISCORD_ROLES = 250;

    const projectedChannels = (options.cleanTarget ? 0 : targetAnalysis.totalChannels) + sourceAnalysis.totalChannels;
    if (projectedChannels > MAX_DISCORD_CHANNELS) {
        reasons.push(`Projected channel count (${projectedChannels}) exceeds Discord maximum server limit of ${MAX_DISCORD_CHANNELS}`);
        isFatal = true;
        recommendations.push('Enable "Clean Target Server" or reduce the number of channels on the source server');
    }

    const projectedRoles = (options.cleanTarget ? 1 : targetAnalysis.rolesCount) + sourceAnalysis.customRolesCount;
    if (projectedRoles > MAX_DISCORD_ROLES) {
        reasons.push(`Projected role count (${projectedRoles}) exceeds Discord maximum server limit of ${MAX_DISCORD_ROLES}`);
        isFatal = true;
        recommendations.push('Enable "Clean Target Server" or prune unused roles on the source server');
    }

    // 3. Check Emoji Capacity Limits
    if (options.cloneEmojis !== false && sourceAnalysis.emojisCount > 0) {
        const availableEmojiSpace = options.cleanTarget
            ? targetAnalysis.maxEmojis
            : targetAnalysis.availableEmojiCapacity;

        if (sourceAnalysis.emojisCount > availableEmojiSpace) {
            const deficit = sourceAnalysis.emojisCount - availableEmojiSpace;
            warnings.push(`Source has ${sourceAnalysis.emojisCount} emojis, but target only has capacity for ${availableEmojiSpace} (${deficit} will be skipped or capped by Boost Tier)`);
            recommendations.push(`Boost the target server to unlock higher emoji slots or clean existing target emojis`);
        }
    }

    // 4. Check Sticker Capacity Limits
    if (options.cloneStickers !== false && sourceAnalysis.stickersCount > 0) {
        const availableStickerSpace = options.cleanTarget
            ? targetAnalysis.maxStickers
            : targetAnalysis.availableStickerCapacity;

        if (sourceAnalysis.stickersCount > availableStickerSpace) {
            const deficit = sourceAnalysis.stickersCount - availableStickerSpace;
            warnings.push(`Source has ${sourceAnalysis.stickersCount} stickers, but target only has capacity for ${availableStickerSpace} (${deficit} will be skipped)`);
            recommendations.push(`Boost target server to Tier 1/2/3 to increase sticker slots`);
        }
    }

    // 5. Check Community Channel Types (Forum / Stage)
    const hasCommunityFeatures = targetAnalysis.rawResources ? Boolean(
        targetAnalysis.systemChannels?.rulesChannelId ||
        (targetAnalysis.features && targetAnalysis.features.includes('COMMUNITY'))
    ) : true;

    if (!hasCommunityFeatures) {
        if (sourceAnalysis.channelBreakdown?.forum > 0) {
            warnings.push(`Source contains ${sourceAnalysis.channelBreakdown.forum} Forum channel(s). If target server is not a Community Server, they will be converted or degraded to text channels.`);
            recommendations.push('Enable Community in Target Server Settings to support native Forum channels');
        }
        if (sourceAnalysis.channelBreakdown?.stage > 0) {
            warnings.push(`Source contains ${sourceAnalysis.channelBreakdown.stage} Stage channel(s). If target server is not a Community Server, they will be converted to voice channels.`);
            recommendations.push('Enable Community in Target Server Settings to support Stage channels');
        }
    }

    // 6. Check Role Hierarchy Constraints
    if (!targetAnalysis.isOwner && targetAnalysis.highestRolePosition > 0) {
        warnings.push(`User is not target server owner. The cloner can only manage roles below position ${targetAnalysis.highestRolePosition}.`);
    }

    // Determine Final Status
    let status = COMPATIBILITY_STATUSES.COMPATIBLE;
    if (isFatal) {
        status = COMPATIBILITY_STATUSES.INCOMPATIBLE;
    } else if (warnings.length > 0) {
        status = COMPATIBILITY_STATUSES.PARTIALLY_COMPATIBLE;
    }

    return {
        status,
        isCompatible: status === COMPATIBILITY_STATUSES.COMPATIBLE || status === COMPATIBILITY_STATUSES.PARTIALLY_COMPATIBLE,
        reasons,
        warnings,
        recommendations,
        projectedChannels,
        projectedRoles,
        availableEmojiCapacity: targetAnalysis.availableEmojiCapacity,
        availableStickerCapacity: targetAnalysis.availableStickerCapacity
    };
}
