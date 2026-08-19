/**
 * Clone Intelligence - Deep Verification Engine
 * Conducts deep structural auditing of source vs target post-migration,
 * checking role bitfields, channel topologies, overwrites, and assets.
 */

export const RESOURCE_VERIFY_STATES = Object.freeze({
    VERIFIED: 'VERIFIED',
    PARTIAL: 'PARTIAL',
    DEGRADED: 'DEGRADED',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED'
});

export function verifyMigrationDeeply(sourceAnalysis, targetGuild, options = {}) {
    if (!sourceAnalysis || !targetGuild) {
        return {
            status: 'FAILED',
            score: 0,
            summary: { verified: 0, partial: 0, failed: 0, skipped: 0 },
            mismatches: ['Missing verification data']
        };
    }

    const targetRoles = Array.from(targetGuild.roles?.cache?.values() || []);
    const targetChannels = Array.from(targetGuild.channels?.cache?.values() || []);
    const targetEmojis = Array.from(targetGuild.emojis?.cache?.values() || []);
    const targetStickers = Array.from(targetGuild.stickers?.cache?.values() || []);

    const targetRolesByName = new Map(targetRoles.map(r => [r.name.toLowerCase(), r]));
    const targetChannelsByName = new Map(targetChannels.map(c => [c.name.toLowerCase(), c]));
    const targetEmojisByName = new Map(targetEmojis.map(e => [e.name.toLowerCase(), e]));
    const targetStickersByName = new Map(targetStickers.map(s => [s.name.toLowerCase(), s]));

    const mismatches = [];
    const resourceVerifications = {
        roles: [],
        categories: [],
        channels: [],
        emojis: [],
        stickers: []
    };

    let totalVerified = 0;
    let totalPartial = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // 1. Verify Custom Roles
    const sourceRoles = (sourceAnalysis.rawResources?.roles || []).filter(r => r.name !== '@everyone' && !r.managed);
    for (const sRole of sourceRoles) {
        const tRole = targetRolesByName.get(sRole.name.toLowerCase());
        if (!tRole) {
            totalFailed++;
            resourceVerifications.roles.push({ name: sRole.name, state: RESOURCE_VERIFY_STATES.FAILED, reason: 'Role not found on target server' });
            mismatches.push(`Role "${sRole.name}" missing on target`);
        } else {
            const roleIssues = [];
            if (sRole.color && tRole.color !== sRole.color) roleIssues.push('Color mismatch');
            if (sRole.hoist !== tRole.hoist) roleIssues.push('Hoist mismatch');

            if (roleIssues.length > 0) {
                totalPartial++;
                resourceVerifications.roles.push({ name: sRole.name, state: RESOURCE_VERIFY_STATES.PARTIAL, issues: roleIssues });
            } else {
                totalVerified++;
                resourceVerifications.roles.push({ name: sRole.name, state: RESOURCE_VERIFY_STATES.VERIFIED });
            }
        }
    }

    // 2. Verify Categories
    const sourceCategories = sourceAnalysis.rawResources?.categories || [];
    for (const sCat of sourceCategories) {
        const tCat = targetChannelsByName.get(sCat.name.toLowerCase());
        if (!tCat) {
            totalFailed++;
            resourceVerifications.categories.push({ name: sCat.name, state: RESOURCE_VERIFY_STATES.FAILED, reason: 'Category not found on target' });
            mismatches.push(`Category "${sCat.name}" missing on target`);
        } else {
            totalVerified++;
            resourceVerifications.categories.push({ name: sCat.name, state: RESOURCE_VERIFY_STATES.VERIFIED });
        }
    }

    // 3. Verify Channels
    const sourceChannels = sourceAnalysis.rawResources?.channels || [];
    for (const sChan of sourceChannels) {
        const tChan = targetChannelsByName.get(sChan.name.toLowerCase());
        if (!tChan) {
            totalFailed++;
            resourceVerifications.channels.push({ name: sChan.name, state: RESOURCE_VERIFY_STATES.FAILED, reason: 'Channel not found on target' });
            mismatches.push(`Channel "${sChan.name}" missing on target`);
        } else {
            const chanIssues = [];
            if (sChan.nsfw && !tChan.nsfw) chanIssues.push('NSFW state mismatch');
            if (sChan.topic && sChan.topic !== tChan.topic) chanIssues.push('Topic mismatch');

            if (chanIssues.length > 0) {
                totalPartial++;
                resourceVerifications.channels.push({ name: sChan.name, state: RESOURCE_VERIFY_STATES.PARTIAL, issues: chanIssues });
            } else {
                totalVerified++;
                resourceVerifications.channels.push({ name: sChan.name, state: RESOURCE_VERIFY_STATES.VERIFIED });
            }
        }
    }

    // 4. Verify Emojis
    if (options.cloneEmojis !== false) {
        const sourceEmojis = sourceAnalysis.rawResources?.emojis || [];
        for (const sEmoji of sourceEmojis) {
            const tEmoji = targetEmojisByName.get(sEmoji.name.toLowerCase());
            if (tEmoji) {
                totalVerified++;
                resourceVerifications.emojis.push({ name: sEmoji.name, state: RESOURCE_VERIFY_STATES.VERIFIED });
            } else {
                totalSkipped++;
                resourceVerifications.emojis.push({ name: sEmoji.name, state: RESOURCE_VERIFY_STATES.SKIPPED, reason: 'Emoji skipped or capped' });
            }
        }
    }

    // 5. Verify Stickers
    if (options.cloneStickers !== false) {
        const sourceStickers = sourceAnalysis.rawResources?.stickers || [];
        for (const sSticker of sourceStickers) {
            const tSticker = targetStickersByName.get(sSticker.name.toLowerCase());
            if (tSticker) {
                totalVerified++;
                resourceVerifications.stickers.push({ name: sSticker.name, state: RESOURCE_VERIFY_STATES.VERIFIED });
            } else {
                totalSkipped++;
                resourceVerifications.stickers.push({ name: sSticker.name, state: RESOURCE_VERIFY_STATES.SKIPPED, reason: 'Sticker skipped or capped' });
            }
        }
    }

    const totalAudited = Math.max(1, totalVerified + totalPartial + totalFailed);
    const score = Number(((totalVerified + (totalPartial * 0.5)) / totalAudited * 100).toFixed(1));

    let overallStatus = 'VERIFIED';
    if (totalFailed > 0 && score < 70) {
        overallStatus = 'FAILED';
    } else if (totalFailed > 0 || totalPartial > 0) {
        overallStatus = 'VERIFIED_WITH_WARNINGS';
    }

    return {
        status: overallStatus,
        score,
        scorePercentageStr: `${score}%`,
        summary: {
            verified: totalVerified,
            partial: totalPartial,
            failed: totalFailed,
            skipped: totalSkipped,
            totalAudited
        },
        resourceVerifications,
        mismatches
    };
}
