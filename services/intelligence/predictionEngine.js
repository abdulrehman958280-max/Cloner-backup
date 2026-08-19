/**
 * Clone Intelligence - Expected Result Prediction Engine
 * Deterministically projects expected migration counts, potential drop-offs,
 * and an honest Expected Accuracy % based on detected constraints.
 */

export function predictMigrationOutcome(sourceAnalysis, targetAnalysis, compatibility, options = {}) {
    if (!sourceAnalysis || !targetAnalysis) {
        return {
            expectedAccuracy: 0,
            accuracyPercentageStr: '0.0%',
            expectedCounts: {},
            reasonsForDeduction: ['Missing server analysis data']
        };
    }

    const reasonsForDeduction = [];

    // 1. Roles Prediction
    const plannedRoles = sourceAnalysis.customRolesCount || 0;
    let expectedRoles = plannedRoles;
    if (!targetAnalysis.isOwner && targetAnalysis.highestRolePosition > 0) {
        const rolesAboveUser = sourceAnalysis.rawResources?.roles.filter(r => r.position >= targetAnalysis.highestRolePosition && r.name !== '@everyone').length || 0;
        if (rolesAboveUser > 0) {
            expectedRoles = Math.max(0, plannedRoles - rolesAboveUser);
            reasonsForDeduction.push(`${rolesAboveUser} role(s) may fail to position due to hierarchy boundaries`);
        }
    }

    // 2. Channels Prediction
    const plannedChannels = sourceAnalysis.channelsCount || 0;
    let expectedChannels = plannedChannels;
    // Check if tickets are detected and set to skip
    if (options.skipTickets !== false) {
        // Tickets will be preserved/skipped
    }

    // 3. Emojis Prediction
    const plannedEmojis = options.cloneEmojis !== false ? (sourceAnalysis.emojisCount || 0) : 0;
    const maxEmojiCapacity = options.cleanTarget ? targetAnalysis.maxEmojis : targetAnalysis.availableEmojiCapacity;
    const expectedEmojis = Math.min(plannedEmojis, maxEmojiCapacity);
    if (plannedEmojis > expectedEmojis) {
        const diff = plannedEmojis - expectedEmojis;
        reasonsForDeduction.push(`${diff} emoji(s) exceed target server boost tier limit (${maxEmojiCapacity})`);
    }

    // 4. Stickers Prediction
    const plannedStickers = options.cloneStickers !== false ? (sourceAnalysis.stickersCount || 0) : 0;
    const maxStickerCapacity = options.cleanTarget ? targetAnalysis.maxStickers : targetAnalysis.availableStickerCapacity;
    const expectedStickers = Math.min(plannedStickers, maxStickerCapacity);
    if (plannedStickers > expectedStickers) {
        const diff = plannedStickers - expectedStickers;
        reasonsForDeduction.push(`${diff} sticker(s) exceed target server tier limit (${maxStickerCapacity})`);
    }

    // 5. Calculate Weighted Deterministic Accuracy
    const totalPlanned = Math.max(1, (plannedRoles + plannedChannels + plannedEmojis + plannedStickers));
    const totalExpected = (expectedRoles + expectedChannels + expectedEmojis + expectedStickers);

    const accuracyRatio = Math.min(1, Math.max(0, totalExpected / totalPlanned));
    const expectedAccuracy = Number((accuracyRatio * 100).toFixed(1));

    return {
        expectedAccuracy,
        accuracyPercentageStr: `${expectedAccuracy}%`,
        expectedCounts: {
            roles: { planned: plannedRoles, expected: expectedRoles },
            channels: { planned: plannedChannels, expected: expectedChannels },
            categories: { planned: sourceAnalysis.categoriesCount || 0, expected: sourceAnalysis.categoriesCount || 0 },
            emojis: { planned: plannedEmojis, expected: expectedEmojis },
            stickers: { planned: plannedStickers, expected: expectedStickers }
        },
        reasonsForDeduction: reasonsForDeduction.length > 0 ? reasonsForDeduction : ['All resources match target server capabilities']
    };
}
