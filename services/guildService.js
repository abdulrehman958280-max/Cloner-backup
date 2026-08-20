import { createDiscordClient, authenticateClient, destroyClient } from './discordService.js';
import { validateToken, validateSnowflake } from './validationService.js';
import { withTimeout } from './reliability/index.js';
import { fetchCurrentUser, fetchUserGuildsRest } from './discordRest.js';

/**
 * Fetches and audits user accessible guilds using direct Discord REST API
 * with automatic fallback to selfbot gateway client.
 */
export async function fetchUserGuilds(userToken) {
    const tokenVal = validateToken(userToken);
    if (!tokenVal.valid) {
        throw new Error(tokenVal.error || 'Invalid user token format.');
    }

    const cleanToken = tokenVal.value;

    // 1. Direct Discord REST API (Ultra-fast, ~150ms, 100% Vercel & serverless compatible)
    try {
        const [user, guilds] = await Promise.all([
            fetchCurrentUser(cleanToken),
            fetchUserGuildsRest(cleanToken)
        ]);

        guilds.sort((a, b) => a.name.localeCompare(b.name));

        return {
            success: true,
            user: {
                id: user.id,
                tag: user.tag,
                avatar: user.avatar
            },
            guilds
        };
    } catch (restErr) {
        // If unauthorized, token is definitely invalid
        if (restErr.statusCode === 401 || (restErr.message && restErr.message.toLowerCase().includes('401'))) {
            throw new Error('Invalid Discord authorization token. Please check your token and try again.');
        }

        // 2. Gateway Client fallback
        const client = createDiscordClient();
        try {
            await authenticateClient(client, cleanToken);

            try {
                await withTimeout(() => client.guilds.fetch(), 10000, { operationName: 'fetch_user_guilds' });
            } catch {
                // fallback to cache
            }

            const guilds = [];
            for (const guild of client.guilds.cache.values()) {
                const isOwner = guild.ownerId === client.user.id;
                let me = guild.members?.me || guild.members?.cache?.get(client.user.id);
                
                const isAdmin = isOwner || (me && me.permissions && me.permissions.has('ADMINISTRATOR')) || false;
                const canManage = isOwner || isAdmin || (me && me.permissions && me.permissions.has('MANAGE_GUILD')) || false;

                guilds.push({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL ? guild.iconURL({ dynamic: true, size: 256 }) : null,
                    memberCount: guild.memberCount || 0,
                    isOwner,
                    isAdmin,
                    canManage,
                    accessible: true
                });
            }

            guilds.sort((a, b) => a.name.localeCompare(b.name));

            return {
                success: true,
                user: {
                    id: client.user.id,
                    tag: client.user.tag || client.user.username,
                    avatar: client.user.displayAvatarURL ? client.user.displayAvatarURL({ format: 'png' }) : null
                },
                guilds
            };
        } finally {
            destroyClient(client);
        }
    }
}

/**
 * Generates an offline Server Template Blueprint (.json) from source guild
 */
export async function exportGuildTemplate(userToken, sourceId) {
    const tokenVal = validateToken(userToken);
    if (!tokenVal.valid) throw new Error(tokenVal.error || 'Invalid user token format.');
    const idVal = validateSnowflake(sourceId, 'Source Server ID');
    if (!idVal.valid) throw new Error(idVal.error);

    const client = createDiscordClient();
    try {
        await authenticateClient(client, userToken);
        const guild = await withTimeout(() => client.guilds.fetch(sourceId), 15000, { operationName: 'fetch_template_source' });
        if (!guild) throw new Error('Source server not found or not accessible.');

        await Promise.allSettled([
            withTimeout(() => guild.roles?.fetch(), 10000, { operationName: 'fetch_roles' }),
            withTimeout(() => guild.channels?.fetch(), 10000, { operationName: 'fetch_channels' }),
            withTimeout(() => guild.emojis?.fetch?.(), 10000, { operationName: 'fetch_emojis' }),
            withTimeout(() => guild.stickers?.fetch?.(), 10000, { operationName: 'fetch_stickers' })
        ]);

        const roles = Array.from(guild.roles.cache.values())
            .filter(r => !r.managed && r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                permissions: r.permissions.bitfield.toString(),
                mentionable: r.mentionable,
                iconUrl: r.iconURL ? r.iconURL() : null
            }));

        const categories = [];
        const channels = [];

        const categoryChannels = Array.from(guild.channels.cache.values())
            .filter(c => c && (c.type === 'GUILD_CATEGORY' || c.type === 4))
            .sort((a, b) => a.position - b.position);

        for (const cat of categoryChannels) {
            categories.push({
                id: cat.id,
                name: cat.name,
                position: cat.position,
                permissionOverwrites: cat.permissionOverwrites?.cache?.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
                    deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0'
                })) || []
            });
        }

        const nonCatChannels = Array.from(guild.channels.cache.values())
            .filter(c => c && c.type !== 'GUILD_CATEGORY' && c.type !== 4)
            .sort((a, b) => a.position - b.position);

        for (const ch of nonCatChannels) {
            channels.push({
                id: ch.id,
                name: ch.name,
                type: ch.type,
                parentId: ch.parentId,
                parentName: ch.parent ? ch.parent.name : null,
                topic: ch.topic || null,
                nsfw: !!ch.nsfw,
                bitrate: ch.bitrate || undefined,
                userLimit: ch.userLimit || undefined,
                rateLimitPerUser: ch.rateLimitPerUser || undefined,
                position: ch.position,
                permissionOverwrites: ch.permissionOverwrites?.cache?.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
                    deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0'
                })) || []
            });
        }

        const emojis = Array.from(guild.emojis?.cache?.values() || []).map(e => ({
            name: e.name,
            animated: e.animated,
            url: e.url
        }));

        const template = {
            schemaVersion: '2.0',
            exportedAt: new Date().toISOString(),
            generator: 'Discloner Studio Server Blueprint',
            guild: {
                id: guild.id,
                name: guild.name,
                iconUrl: guild.iconURL ? guild.iconURL({ dynamic: true, size: 512 }) : null,
                bannerUrl: guild.bannerURL ? guild.bannerURL({ size: 1024 }) : null,
                splashUrl: guild.splashURL ? guild.splashURL({ size: 1024 }) : null,
                verificationLevel: guild.verificationLevel,
                defaultMessageNotifications: guild.defaultMessageNotifications,
                explicitContentFilter: guild.explicitContentFilter,
                afkTimeout: guild.afkTimeout
            },
            roles,
            categories,
            channels,
            emojis
        };

        return { success: true, template };
    } finally {
        destroyClient(client);
    }
}

/**
 * Scrapes guild members with user profiles and role names
 */
export async function scrapeGuildMembers(userToken, sourceId) {
    const tokenVal = validateToken(userToken);
    if (!tokenVal.valid) throw new Error(tokenVal.error || 'Invalid user token format.');
    const idVal = validateSnowflake(sourceId, 'Source Server ID');
    if (!idVal.valid) throw new Error(idVal.error);

    const client = createDiscordClient();
    try {
        await authenticateClient(client, userToken);
        const guild = await withTimeout(() => client.guilds.fetch(sourceId), 15000, { operationName: 'fetch_member_guild' });
        if (!guild) throw new Error('Source server not found or not accessible.');

        try {
            await withTimeout(() => guild.members.fetch(), 15000, { operationName: 'fetch_members' });
        } catch {
            // fallback to cached members
        }

        const members = [];
        for (const m of guild.members.cache.values()) {
            const user = m.user;
            if (!user) continue;

            const roleNames = m.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => r.name)
                .join('; ');

            members.push({
                id: user.id,
                username: user.username,
                discriminator: user.discriminator || '0',
                displayName: m.displayName || user.username,
                isBot: !!user.bot,
                avatarUrl: user.displayAvatarURL ? user.displayAvatarURL({ format: 'png', size: 256 }) : null,
                joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
                createdAt: user.createdAt ? user.createdAt.toISOString() : null,
                roles: roleNames
            });
        }

        return {
            success: true,
            guildName: guild.name,
            guildId: guild.id,
            totalMembers: members.length,
            members
        };
    } finally {
        destroyClient(client);
    }
}

/**
 * Generates an interactive hierarchical tree topology structure for UI visualizer
 */
export async function fetchGuildTopology(userToken, guildId) {
    const tokenVal = validateToken(userToken);
    if (!tokenVal.valid) throw new Error(tokenVal.error || 'Invalid user token format.');
    const idVal = validateSnowflake(guildId, 'Server ID');
    if (!idVal.valid) throw new Error(idVal.error);

    const client = createDiscordClient();
    try {
        await authenticateClient(client, userToken);
        const guild = await withTimeout(() => client.guilds.fetch(guildId), 15000, { operationName: 'fetch_topology_guild' });
        if (!guild) throw new Error('Guild not found or token has insufficient permissions.');

        await Promise.allSettled([
            withTimeout(() => guild.roles?.fetch(), 10000, { operationName: 'fetch_roles' }),
            withTimeout(() => guild.channels?.fetch(), 10000, { operationName: 'fetch_channels' }),
            withTimeout(() => guild.emojis?.fetch?.(), 10000, { operationName: 'fetch_emojis' }),
            withTimeout(() => guild.stickers?.fetch?.(), 10000, { operationName: 'fetch_stickers' })
        ]);

        const rawRoles = Array.from(guild.roles.cache.values())
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor || '#99aab5',
                hoist: !!r.hoist,
                position: r.position,
                managed: !!r.managed,
                permissions: r.permissions.bitfield.toString(),
                mentionable: !!r.mentionable,
                memberCount: r.members ? r.members.size : 0
            }));

        const categories = [];
        const unparentedChannels = [];

        const categoryChannels = Array.from(guild.channels.cache.values())
            .filter(c => c && (c.type === 'GUILD_CATEGORY' || c.type === 4))
            .sort((a, b) => a.position - b.position);

        for (const cat of categoryChannels) {
            const childChannels = Array.from(guild.channels.cache.values())
                .filter(c => c && c.parentId === cat.id && c.type !== 'GUILD_CATEGORY' && c.type !== 4)
                .sort((a, b) => a.position - b.position)
                .map(c => ({
                    id: c.id,
                    name: c.name,
                    type: typeof c.type === 'string' ? c.type : (c.type === 2 ? 'GUILD_VOICE' : c.type === 5 ? 'GUILD_ANNOUNCEMENT' : 'GUILD_TEXT'),
                    position: c.position,
                    topic: c.topic || null,
                    nsfw: !!c.nsfw,
                    bitrate: c.bitrate || undefined,
                    userLimit: c.userLimit || undefined,
                    rateLimitPerUser: c.rateLimitPerUser || undefined,
                    overwritesCount: c.permissionOverwrites?.cache?.size || 0,
                    overwrites: c.permissionOverwrites?.cache?.map(po => ({
                        id: po.id,
                        type: po.type,
                        allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
                        deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0'
                    })) || []
                }));

            categories.push({
                id: cat.id,
                name: cat.name,
                position: cat.position,
                overwritesCount: cat.permissionOverwrites?.cache?.size || 0,
                overwrites: cat.permissionOverwrites?.cache?.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
                    deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0'
                })) || [],
                channels: childChannels
            });
        }

        const rawUnparented = Array.from(guild.channels.cache.values())
            .filter(c => c && !c.parentId && c.type !== 'GUILD_CATEGORY' && c.type !== 4)
            .sort((a, b) => a.position - b.position);

        for (const c of rawUnparented) {
            unparentedChannels.push({
                id: c.id,
                name: c.name,
                type: typeof c.type === 'string' ? c.type : (c.type === 2 ? 'GUILD_VOICE' : c.type === 5 ? 'GUILD_ANNOUNCEMENT' : 'GUILD_TEXT'),
                position: c.position,
                topic: c.topic || null,
                nsfw: !!c.nsfw,
                bitrate: c.bitrate || undefined,
                userLimit: c.userLimit || undefined,
                rateLimitPerUser: c.rateLimitPerUser || undefined,
                overwritesCount: c.permissionOverwrites?.cache?.size || 0,
                overwrites: c.permissionOverwrites?.cache?.map(po => ({
                    id: po.id,
                    type: po.type,
                    allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
                    deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0'
                })) || []
            });
        }

        const emojis = Array.from(guild.emojis?.cache?.values() || []).map(e => ({
            id: e.id,
            name: e.name,
            animated: !!e.animated,
            url: e.url
        }));

        const stickers = Array.from(guild.stickers?.cache?.values() || []).map(s => ({
            id: s.id,
            name: s.name,
            url: s.url
        }));

        return {
            success: true,
            guild: {
                id: guild.id,
                name: guild.name,
                iconUrl: guild.iconURL ? guild.iconURL({ dynamic: true, size: 256 }) : null,
                memberCount: guild.memberCount || 0,
                boostTier: guild.premiumTier || 0,
                boostCount: guild.premiumSubscriptionCount || 0
            },
            stats: {
                totalCategories: categories.length,
                totalChannels: unparentedChannels.length + categories.reduce((sum, cat) => sum + cat.channels.length, 0),
                totalRoles: rawRoles.length,
                totalEmojis: emojis.length,
                totalStickers: stickers.length
            },
            tree: {
                categories,
                unparentedChannels,
                roles: rawRoles,
                emojis,
                stickers
            }
        };
    } finally {
        destroyClient(client);
    }
}



