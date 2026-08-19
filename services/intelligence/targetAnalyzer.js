/**
 * Clone Intelligence - Target Guild Analyzer
 * Analyzes target server configuration, user authorization privileges,
 * available asset capacity (emojis/stickers by boost tier), and protected entities.
 */

import { sanitizeSensitiveText } from './sanitizer.js';

// Discord Tier Max Limits
const TIER_EMOJI_LIMITS = {
    0: 50,
    1: 100,
    2: 150,
    3: 250,
    NONE: 50,
    TIER_1: 100,
    TIER_2: 150,
    TIER_3: 250
};

const TIER_STICKER_LIMITS = {
    0: 5,
    1: 15,
    2: 30,
    3: 60,
    NONE: 5,
    TIER_1: 15,
    TIER_2: 30,
    TIER_3: 60
};

export function analyzeTargetGuild(targetGuild, currentUserMember = null) {
    if (!targetGuild) {
        throw new Error('Target guild is required for analysis');
    }

    const roles = Array.from(targetGuild.roles?.cache?.values() || []);
    const channels = Array.from(targetGuild.channels?.cache?.values() || []);
    const emojis = Array.from(targetGuild.emojis?.cache?.values() || []);
    const stickers = Array.from(targetGuild.stickers?.cache?.values() || []);

    const categories = channels.filter(c => c.type === 'GUILD_CATEGORY' || c.type === 4);
    const nonCategoryChannels = channels.filter(c => c.type !== 'GUILD_CATEGORY' && c.type !== 4);

    // Compute tier capacities
    const premiumTier = targetGuild.premiumTier || 0;
    const maxEmojis = TIER_EMOJI_LIMITS[premiumTier] || 50;
    const maxStickers = TIER_STICKER_LIMITS[premiumTier] || 5;

    const availableEmojiCapacity = Math.max(0, maxEmojis - emojis.length);
    const availableStickerCapacity = Math.max(0, maxStickers - stickers.length);

    // Analyze current user permissions on target
    const userPermissions = [];
    const missingPermissions = [];
    let isOwner = false;
    let isAdmin = false;
    let highestRolePosition = 0;

    const requiredPermissions = [
        { key: 'MANAGE_ROLES', name: 'Manage Roles', required: true },
        { key: 'MANAGE_CHANNELS', name: 'Manage Channels', required: true },
        { key: 'MANAGE_GUILD', name: 'Manage Server', required: false },
        { key: 'MANAGE_EMOJIS_AND_STICKERS', name: 'Manage Emojis & Stickers', required: false },
        { key: 'MANAGE_WEBHOOKS', name: 'Manage Webhooks', required: false },
        { key: 'VIEW_AUDIT_LOG', name: 'View Audit Log', required: false }
    ];

    if (currentUserMember) {
        isOwner = targetGuild.ownerId === currentUserMember.id;
        highestRolePosition = currentUserMember.roles?.highest?.position || 0;

        try {
            isAdmin = currentUserMember.permissions?.has('ADMINISTRATOR') || isOwner;
        } catch {
            isAdmin = isOwner;
        }

        for (const perm of requiredPermissions) {
            let hasPerm = false;
            try {
                hasPerm = isAdmin || (currentUserMember.permissions?.has(perm.key) || false);
            } catch {
                hasPerm = false;
            }

            if (hasPerm) {
                userPermissions.push(perm.name);
            } else if (perm.required) {
                missingPermissions.push(perm.name);
            }
        }
    } else {
        // Fallback assuming normal admin access if member object not passed
        userPermissions.push('Manage Roles', 'Manage Channels', 'Manage Server');
    }

    // Protected system channels
    const protectedChannelIds = new Set();
    if (targetGuild.systemChannelId) protectedChannelIds.add(targetGuild.systemChannelId);
    if (targetGuild.rulesChannelId) protectedChannelIds.add(targetGuild.rulesChannelId);
    if (targetGuild.publicUpdatesChannelId) protectedChannelIds.add(targetGuild.publicUpdatesChannelId);
    if (targetGuild.afkChannelId) protectedChannelIds.add(targetGuild.afkChannelId);

    // Protected roles: @everyone, managed roles, higher roles
    const protectedRoleIds = new Set();
    const everyoneRole = roles.find(r => r.name === '@everyone');
    if (everyoneRole) protectedRoleIds.add(everyoneRole.id);

    roles.forEach(r => {
        if (r.managed) protectedRoleIds.add(r.id);
        if (!isOwner && currentUserMember && r.position >= highestRolePosition) {
            protectedRoleIds.add(r.id);
        }
    });

    return {
        id: targetGuild.id,
        name: sanitizeSensitiveText(targetGuild.name || 'Target Guild'),
        premiumTier,
        maxEmojis,
        maxStickers,
        availableEmojiCapacity,
        availableStickerCapacity,
        rolesCount: roles.length,
        channelsCount: nonCategoryChannels.length,
        categoriesCount: categories.length,
        totalChannels: channels.length,
        emojisCount: emojis.length,
        stickersCount: stickers.length,
        isOwner,
        isAdmin,
        highestRolePosition,
        userPermissions,
        missingPermissions,
        hasRequiredPermissions: missingPermissions.length === 0,
        protectedChannelIds: Array.from(protectedChannelIds),
        protectedRoleIds: Array.from(protectedRoleIds),
        systemChannels: {
            systemChannelId: targetGuild.systemChannelId || null,
            rulesChannelId: targetGuild.rulesChannelId || null,
            publicUpdatesChannelId: targetGuild.publicUpdatesChannelId || null,
            afkChannelId: targetGuild.afkChannelId || null
        },
        rawResources: {
            roles: roles.map(r => ({
                id: r.id,
                name: r.name,
                position: r.position,
                color: r.color,
                managed: r.managed,
                isProtected: protectedRoleIds.has(r.id)
            })),
            categories: categories.map(c => ({
                id: c.id,
                name: c.name,
                position: c.position
            })),
            channels: nonCategoryChannels.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                parentId: c.parentId || null,
                position: c.position,
                isProtected: protectedChannelIds.has(c.id)
            })),
            emojis: emojis.map(e => ({
                id: e.id,
                name: e.name,
                animated: Boolean(e.animated)
            })),
            stickers: stickers.map(s => ({
                id: s.id,
                name: s.name
            }))
        }
    };
}
