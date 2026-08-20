/**
 * Clone Intelligence - Before / After Diff Engine
 * Produces structured visual and statistical delta reports between
 * target guild state before migration and post-migration result.
 */

export function computeTargetDelta(targetBeforeAnalysis, targetAfterGuild, verificationReport, options = {}) {
    const beforeRoles = targetBeforeAnalysis?.rawResources?.roles?.length || 0;
    const beforeChannels = targetBeforeAnalysis?.totalChannels || 0;
    const beforeEmojis = targetBeforeAnalysis?.emojisCount || 0;
    const beforeStickers = targetBeforeAnalysis?.stickersCount || 0;

    const afterRoles = targetAfterGuild?.roles?.cache?.size || 0;
    const afterChannels = targetAfterGuild?.channels?.cache?.size || 0;
    const afterEmojis = targetAfterGuild?.emojis?.cache?.size || 0;
    const afterStickers = targetAfterGuild?.stickers?.cache?.size || 0;

    const delta = {
        roles: {
            before: beforeRoles,
            after: afterRoles,
            diff: afterRoles - beforeRoles
        },
        channels: {
            before: beforeChannels,
            after: afterChannels,
            diff: afterChannels - beforeChannels
        },
        emojis: {
            before: beforeEmojis,
            after: afterEmojis,
            diff: afterEmojis - beforeEmojis
        },
        stickers: {
            before: beforeStickers,
            after: afterStickers,
            diff: afterStickers - beforeStickers
        }
    };

    const summary = {
        created: (verificationReport?.summary?.verified || 0) + (verificationReport?.summary?.partial || 0),
        deleted: targetBeforeAnalysis?.rawResources?.channels?.length || 0,
        skipped: verificationReport?.summary?.skipped || 0,
        failed: verificationReport?.summary?.failed || 0,
        preserved: (targetBeforeAnalysis?.protectedChannelIds?.length || 0) + (targetBeforeAnalysis?.protectedRoleIds?.length || 0)
    };

    return {
        delta,
        summary
    };
}

export const generateBeforeAfterDiff = computeTargetDelta;
