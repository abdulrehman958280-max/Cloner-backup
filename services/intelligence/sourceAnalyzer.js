/**
 * Clone Intelligence - Source Guild Analyzer
 * Deeply examines source server architecture, permissions, channel topologies,
 * assets, and metadata without exposing sensitive credentials.
 */

import { sanitizeSensitiveText } from './sanitizer.js';

export function analyzeSourceGuild(sourceGuild, options = {}) {
    if (!sourceGuild) {
        throw new Error('Source guild is required for analysis');
    }

    const roles = Array.from(sourceGuild.roles?.cache?.values() || []);
    const channels = Array.from(sourceGuild.channels?.cache?.values() || []);
    const emojis = Array.from(sourceGuild.emojis?.cache?.values() || []);
    const stickers = Array.from(sourceGuild.stickers?.cache?.values() || []);

    // Filter categories vs regular channels
    const categories = channels.filter(c => c.type === 'GUILD_CATEGORY' || c.type === 4);
    const nonCategoryChannels = channels.filter(c => c.type !== 'GUILD_CATEGORY' && c.type !== 4);

    // Channel type breakdown
    const channelBreakdown = {
        text: 0,
        voice: 0,
        announcement: 0,
        forum: 0,
        stage: 0,
        category: categories.length,
        other: 0
    };

    let totalPermissionOverwrites = 0;
    let nsfwChannels = 0;

    for (const channel of nonCategoryChannels) {
        const typeStr = String(channel.type).toUpperCase();
        if (typeStr === 'GUILD_TEXT' || typeStr === '0') {
            channelBreakdown.text++;
        } else if (typeStr === 'GUILD_VOICE' || typeStr === '2') {
            channelBreakdown.voice++;
        } else if (typeStr === 'GUILD_NEWS' || typeStr === 'GUILD_ANNOUNCEMENT' || typeStr === '5') {
            channelBreakdown.announcement++;
        } else if (typeStr === 'GUILD_FORUM' || typeStr === '15') {
            channelBreakdown.forum++;
        } else if (typeStr === 'GUILD_STAGE_VOICE' || typeStr === '13') {
            channelBreakdown.stage++;
        } else {
            channelBreakdown.other++;
        }

        if (channel.nsfw) nsfwChannels++;
        if (channel.permissionOverwrites?.cache) {
            totalPermissionOverwrites += channel.permissionOverwrites.cache.size;
        }
    }

    // Role breakdown
    const customRoles = roles.filter(r => r.name !== '@everyone' && !r.managed);
    const managedBotRoles = roles.filter(r => r.managed);
    const adminRoles = roles.filter(r => {
        try {
            return r.permissions?.has('ADMINISTRATOR') || false;
        } catch {
            return false;
        }
    });

    // Asset size summary
    const animatedEmojis = emojis.filter(e => e.animated).length;
    const staticEmojis = emojis.length - animatedEmojis;

    return {
        id: sourceGuild.id,
        name: sanitizeSensitiveText(sourceGuild.name || 'Source Guild'),
        iconUrl: sourceGuild.iconURL ? sourceGuild.iconURL({ dynamic: true, size: 4096 }) : null,
        bannerUrl: sourceGuild.bannerURL ? sourceGuild.bannerURL({ size: 4096 }) : null,
        description: sourceGuild.description || null,
        preferredLocale: sourceGuild.preferredLocale || 'en-US',
        verificationLevel: sourceGuild.verificationLevel || 'NONE',
        explicitContentFilter: sourceGuild.explicitContentFilter || 'DISABLED',
        rolesCount: roles.length,
        customRolesCount: customRoles.length,
        managedRolesCount: managedBotRoles.length,
        adminRolesCount: adminRoles.length,
        channelsCount: nonCategoryChannels.length,
        categoriesCount: categories.length,
        totalChannels: channels.length,
        channelBreakdown,
        totalPermissionOverwrites,
        nsfwChannelsCount: nsfwChannels,
        emojisCount: emojis.length,
        animatedEmojisCount: animatedEmojis,
        staticEmojisCount: staticEmojis,
        stickersCount: stickers.length,
        webhooksCount: 0, // Filled during deep scan if permissions allow
        features: sourceGuild.features ? Array.from(sourceGuild.features) : [],
        rawResources: {
            roles: roles.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                position: r.position,
                permissions: r.permissions?.bitfield ? String(r.permissions.bitfield) : '0',
                mentionable: r.mentionable,
                managed: r.managed
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
                topic: c.topic || '',
                nsfw: Boolean(c.nsfw),
                rateLimitPerUser: c.rateLimitPerUser || 0,
                bitrate: c.bitrate || null,
                userLimit: c.userLimit || null,
                overwritesCount: c.permissionOverwrites?.cache?.size || 0
            })),
            emojis: emojis.map(e => ({
                id: e.id,
                name: e.name,
                animated: Boolean(e.animated),
                url: e.url
            })),
            stickers: stickers.map(s => ({
                id: s.id,
                name: s.name,
                format: s.format,
                tags: s.tags,
                url: s.url
            }))
        }
    };
}
