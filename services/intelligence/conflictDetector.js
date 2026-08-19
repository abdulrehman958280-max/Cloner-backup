/**
 * Clone Intelligence - Conflict Detector
 * Identifies collisions between source resources and pre-existing target resources,
 * computing resolution recommendations based on configured policies.
 */

export function detectResourceConflicts(sourceAnalysis, targetAnalysis, options = {}) {
    const conflictPolicy = options.conflictPolicy || 'create'; // 'create' | 'update' | 'skip'
    const conflicts = {
        roles: [],
        categories: [],
        channels: [],
        emojis: [],
        stickers: []
    };

    if (!sourceAnalysis?.rawResources || !targetAnalysis?.rawResources) {
        return {
            totalConflicts: 0,
            hasConflicts: false,
            conflicts,
            policy: conflictPolicy
        };
    }

    const targetRolesByName = new Map();
    targetAnalysis.rawResources.roles.forEach(r => {
        if (r.name !== '@everyone') {
            targetRolesByName.set(r.name.toLowerCase(), r);
        }
    });

    const targetCategoriesByName = new Map();
    targetAnalysis.rawResources.categories.forEach(c => {
        targetCategoriesByName.set(c.name.toLowerCase(), c);
    });

    const targetChannelsByName = new Map();
    targetAnalysis.rawResources.channels.forEach(c => {
        targetChannelsByName.set(c.name.toLowerCase(), c);
    });

    const targetEmojisByName = new Map();
    targetAnalysis.rawResources.emojis.forEach(e => {
        targetEmojisByName.set(e.name.toLowerCase(), e);
    });

    const targetStickersByName = new Map();
    targetAnalysis.rawResources.stickers.forEach(s => {
        targetStickersByName.set(s.name.toLowerCase(), s);
    });

    // 1. Role Conflicts
    for (const sourceRole of sourceAnalysis.rawResources.roles) {
        if (sourceRole.name === '@everyone') continue;
        const matching = targetRolesByName.get(sourceRole.name.toLowerCase());
        if (matching) {
            conflicts.roles.push({
                sourceId: sourceRole.id,
                targetId: matching.id,
                name: sourceRole.name,
                difference: [
                    sourceRole.color !== matching.color ? 'Color' : null,
                    sourceRole.permissions !== matching.permissions ? 'Permissions' : null,
                    sourceRole.hoist !== matching.hoist ? 'Hoist' : null
                ].filter(Boolean),
                recommendation: conflictPolicy === 'skip' ? 'SKIP' : (conflictPolicy === 'update' ? 'UPDATE' : 'CREATE')
            });
        }
    }

    // 2. Category Conflicts
    for (const sourceCat of sourceAnalysis.rawResources.categories) {
        const matching = targetCategoriesByName.get(sourceCat.name.toLowerCase());
        if (matching) {
            conflicts.categories.push({
                sourceId: sourceCat.id,
                targetId: matching.id,
                name: sourceCat.name,
                recommendation: conflictPolicy === 'skip' ? 'SKIP' : 'REUSE_OR_CREATE'
            });
        }
    }

    // 3. Channel Conflicts
    for (const sourceChan of sourceAnalysis.rawResources.channels) {
        const matching = targetChannelsByName.get(sourceChan.name.toLowerCase());
        if (matching) {
            conflicts.channels.push({
                sourceId: sourceChan.id,
                targetId: matching.id,
                name: sourceChan.name,
                typeMismatch: sourceChan.type !== matching.type,
                recommendation: conflictPolicy === 'skip' ? 'SKIP' : 'CREATE'
            });
        }
    }

    // 4. Emoji Conflicts
    for (const sourceEmoji of sourceAnalysis.rawResources.emojis) {
        const matching = targetEmojisByName.get(sourceEmoji.name.toLowerCase());
        if (matching) {
            conflicts.emojis.push({
                name: sourceEmoji.name,
                sourceId: sourceEmoji.id,
                targetId: matching.id,
                recommendation: 'SKIP'
            });
        }
    }

    // 5. Sticker Conflicts
    for (const sourceSticker of sourceAnalysis.rawResources.stickers) {
        const matching = targetStickersByName.get(sourceSticker.name.toLowerCase());
        if (matching) {
            conflicts.stickers.push({
                name: sourceSticker.name,
                sourceId: sourceSticker.id,
                targetId: matching.id,
                recommendation: 'SKIP'
            });
        }
    }

    const totalConflicts = conflicts.roles.length +
        conflicts.categories.length +
        conflicts.channels.length +
        conflicts.emojis.length +
        conflicts.stickers.length;

    return {
        totalConflicts,
        hasConflicts: totalConflicts > 0,
        conflicts,
        policy: conflictPolicy
    };
}
