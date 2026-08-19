/**
 * Clone Intelligence - Migration Planner
 * Generates an optimized, dependency-respecting execution graph across
 * all 10 migration phases with time estimates and safety preconditions.
 */

export function buildMigrationPlan(sourceAnalysis, options = {}) {
    const isClean = options.cleanTarget !== false;
    const isCloneRoles = options.cloneRoles !== false;
    const isCloneChannels = options.cloneChannels !== false;
    const isClonePermissions = options.clonePermissions !== false;
    const isCloneEmojis = options.cloneEmojis !== false;
    const isCloneStickers = options.cloneStickers !== false;
    const isCloneWebhooks = options.cloneWebhooks !== false;
    const isCloneMessages = Boolean(options.cloneMessages);

    const phases = [];

    // Phase 0: Cleanup (if enabled)
    if (isClean) {
        phases.push({
            id: 'cleanup',
            phaseNumber: 0,
            name: 'Target Cleanup & Safety Purge',
            description: 'Safely prune unprotected target channels and roles while preserving bot integrations and system channels',
            dependencies: [],
            estimatedTimeSeconds: 4,
            enabled: true
        });
    }

    // Phase 1: Roles
    phases.push({
        id: 'roles',
        phaseNumber: 1,
        name: 'Role Creation & Property Mirroring',
        description: 'Replicate custom roles, colors, hoist states, and base permission bitfields',
        dependencies: isClean ? ['cleanup'] : [],
        estimatedTimeSeconds: Math.max(2, Math.ceil((sourceAnalysis?.customRolesCount || 10) * 0.3)),
        enabled: isCloneRoles
    });

    // Phase 2: Role Hierarchy
    phases.push({
        id: 'role_hierarchy',
        phaseNumber: 2,
        name: 'Role Hierarchy Synchronization',
        description: 'Sort and position newly created roles according to the source server hierarchy',
        dependencies: ['roles'],
        estimatedTimeSeconds: 2,
        enabled: isCloneRoles
    });

    // Phase 3: Categories
    phases.push({
        id: 'categories',
        phaseNumber: 3,
        name: 'Category Tree Construction',
        description: 'Create category containers to establish channel groupings',
        dependencies: ['roles'],
        estimatedTimeSeconds: Math.max(1, Math.ceil((sourceAnalysis?.categoriesCount || 4) * 0.3)),
        enabled: isCloneChannels
    });

    // Phase 4: Channels
    phases.push({
        id: 'channels',
        phaseNumber: 4,
        name: 'Channel Topology Replication',
        description: 'Mirror text, voice, announcement, forum, and stage channels inside respective categories',
        dependencies: ['categories'],
        estimatedTimeSeconds: Math.max(3, Math.ceil((sourceAnalysis?.channelsCount || 20) * 0.35)),
        enabled: isCloneChannels
    });

    // Phase 5: Permission Overwrites
    phases.push({
        id: 'permissions',
        phaseNumber: 5,
        name: 'Permission Overwrites & Privacy ACLs',
        description: 'Apply channel-specific role allowances, denials, and hidden room locks',
        dependencies: ['roles', 'channels'],
        estimatedTimeSeconds: Math.max(2, Math.ceil((sourceAnalysis?.totalPermissionOverwrites || 15) * 0.2)),
        enabled: isClonePermissions && isCloneRoles && isCloneChannels
    });

    // Phase 6: Emojis
    phases.push({
        id: 'emojis',
        phaseNumber: 6,
        name: 'Custom Emoji Migration',
        description: 'Upload static and animated emojis with adaptive rate-limit backpressure',
        dependencies: ['channels'],
        estimatedTimeSeconds: Math.max(2, Math.ceil((sourceAnalysis?.emojisCount || 10) * 0.4)),
        enabled: isCloneEmojis && (sourceAnalysis?.emojisCount || 0) > 0
    });

    // Phase 7: Stickers
    phases.push({
        id: 'stickers',
        phaseNumber: 7,
        name: 'Custom Sticker Migration',
        description: 'Upload custom guild stickers with buffer validation',
        dependencies: ['emojis'],
        estimatedTimeSeconds: Math.max(2, Math.ceil((sourceAnalysis?.stickersCount || 5) * 0.4)),
        enabled: isCloneStickers && (sourceAnalysis?.stickersCount || 0) > 0
    });

    // Phase 8: Webhooks
    phases.push({
        id: 'webhooks',
        phaseNumber: 8,
        name: 'Webhook Infrastructure Provisioning',
        description: 'Provision channel webhooks for integrations or message history replication',
        dependencies: ['channels'],
        estimatedTimeSeconds: 2,
        enabled: isCloneWebhooks || isCloneMessages
    });

    // Phase 9: Messages (if enabled)
    if (isCloneMessages) {
        phases.push({
            id: 'messages',
            phaseNumber: 9,
            name: 'Historical Message & Attachment Sync',
            description: 'Transfer recent chat messages with original avatar identities and timestamps',
            dependencies: ['webhooks', 'channels'],
            estimatedTimeSeconds: Math.max(5, Math.ceil((sourceAnalysis?.channelsCount || 10) * (options.msgLimit || 15) * 0.15)),
            enabled: true
        });
    }

    // Phase 10: Verification
    phases.push({
        id: 'verification',
        phaseNumber: 10,
        name: 'Deep State Audit & Verification',
        description: 'Compare target server against source manifest and calculate migration score',
        dependencies: ['permissions'],
        estimatedTimeSeconds: 3,
        enabled: true
    });

    const activePhases = phases.filter(p => p.enabled);
    const totalEstimatedSeconds = activePhases.reduce((acc, p) => acc + p.estimatedTimeSeconds, 0);

    return {
        totalPhases: activePhases.length,
        estimatedTotalSeconds: totalEstimatedSeconds,
        phases: activePhases,
        allPhases: phases
    };
}
