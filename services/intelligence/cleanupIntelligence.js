/**
 * Clone Intelligence - Cleanup Intelligence & Preview Engine
 * Evaluates target server resources for safe, non-destructive pruning,
 * enforcing preservation of system channels, bot roles, and ticket rooms.
 */

import { scanGuildForTickets } from './ticketDetector.js';

export const RESOURCE_CLEANUP_STATES = Object.freeze({
    PROTECTED: 'PROTECTED',
    PLANNED: 'PLANNED',
    SKIPPED: 'SKIPPED',
    DELETED: 'DELETED',
    FAILED: 'FAILED'
});

/**
 * Builds an intelligent cleanup plan with complete safety classifications
 * @param {Object} targetAnalysis Result from analyzeTargetGuild
 * @param {Object} options Cleanup options
 * @returns {Object} Cleanup plan and preview summary
 */
export function generateCleanupPlan(targetAnalysis, options = {}) {
    const isCleanTargetEnabled = options.cleanTarget !== false;
    const cleanupMode = options.cleanupMode || 'full';

    const plan = {
        enabled: isCleanTargetEnabled,
        mode: cleanupMode,
        roles: {
            planned: [],
            protected: []
        },
        channels: {
            planned: [],
            protected: [],
            ticketPreserved: []
        },
        emojis: {
            planned: [],
            protected: []
        },
        stickers: {
            planned: [],
            protected: []
        },
        webhooks: {
            planned: [],
            protected: []
        },
        warnings: []
    };

    if (!targetAnalysis?.rawResources || !isCleanTargetEnabled || cleanupMode === 'none') {
        return {
            ...plan,
            enabled: false,
            summary: {
                willDelete: { roles: 0, channels: 0, emojis: 0, stickers: 0, webhooks: 0 },
                willPreserve: {
                    roles: targetAnalysis?.rolesCount || 0,
                    channels: targetAnalysis?.channelsCount || 0,
                    ticketChannels: 0
                },
                warningsCount: 0
            }
        };
    }

    const raw = targetAnalysis.rawResources;

    // 1. Roles Categorization
    for (const role of raw.roles) {
        if (role.name === '@everyone') {
            plan.roles.protected.push({ ...role, reason: 'System Default Role (@everyone)' });
        } else if (role.managed) {
            plan.roles.protected.push({ ...role, reason: 'Managed Bot Integration Role' });
        } else if (role.isProtected) {
            plan.roles.protected.push({ ...role, reason: 'Above User Hierarchy' });
        } else {
            plan.roles.planned.push({ ...role, state: RESOURCE_CLEANUP_STATES.PLANNED });
        }
    }

    // 2. Scan Target Channels for Tickets & Protected System Channels
    const allChannelsList = [...raw.categories, ...raw.channels];
    const ticketScan = scanGuildForTickets(allChannelsList);
    const ticketChannelIdSet = new Set(ticketScan.detectedTickets.map(t => t.channelId));

    for (const channel of raw.channels) {
        if (channel.isProtected || targetAnalysis.protectedChannelIds?.includes(channel.id)) {
            plan.channels.protected.push({ ...channel, reason: 'Discord System / Rules / Updates Channel' });
        } else if (ticketChannelIdSet.has(channel.id)) {
            plan.channels.ticketPreserved.push({ ...channel, reason: 'Detected Active Support Ticket Channel' });
        } else {
            plan.channels.planned.push({ ...channel, state: RESOURCE_CLEANUP_STATES.PLANNED });
        }
    }

    // Categories
    for (const cat of raw.categories) {
        plan.channels.planned.push({ ...cat, type: 'GUILD_CATEGORY', state: RESOURCE_CLEANUP_STATES.PLANNED });
    }

    // Emojis & Stickers
    for (const emoji of raw.emojis) {
        plan.emojis.planned.push({ ...emoji, state: RESOURCE_CLEANUP_STATES.PLANNED });
    }

    for (const sticker of raw.stickers) {
        plan.stickers.planned.push({ ...sticker, state: RESOURCE_CLEANUP_STATES.PLANNED });
    }

    // Evaluate warnings
    if (plan.roles.protected.length > 3) {
        plan.warnings.push(`${plan.roles.protected.length} roles are protected and will remain on target server.`);
    }
    if (plan.channels.ticketPreserved.length > 0) {
        plan.warnings.push(`${plan.channels.ticketPreserved.length} ticket channels will be preserved to prevent data loss.`);
    }
    if (plan.channels.protected.length > 0) {
        plan.warnings.push(`${plan.channels.protected.length} system/rules channels will be preserved.`);
    }

    const summary = {
        willDelete: {
            roles: plan.roles.planned.length,
            channels: plan.channels.planned.length,
            emojis: plan.emojis.planned.length,
            stickers: plan.stickers.planned.length,
            webhooks: 0
        },
        willPreserve: {
            roles: plan.roles.protected.length,
            channels: plan.channels.protected.length,
            ticketChannels: plan.channels.ticketPreserved.length
        },
        warningsCount: plan.warnings.length
    };

    return {
        ...plan,
        summary
    };
}
