import { createDiscordClient, authenticateClient, destroyClient } from './discordService.js';
import { validateToken, validateSnowflake } from './validationService.js';
import { withTimeout } from './reliability/index.js';

/**
 * Fetches and audits user accessible guilds using selfbot client
 */
export async function fetchUserGuilds(userToken) {
    const tokenVal = validateToken(userToken);
    if (!tokenVal.valid) {
        throw new Error(tokenVal.error || 'Invalid user token format.');
    }

    const client = createDiscordClient();
    try {
        await authenticateClient(client, userToken);

        try {
            await withTimeout(() => client.guilds.fetch(), 10000, { operationName: 'fetch_user_guilds' });
        } catch {
            // fallback to cache
        }

        const guilds = [];
        for (const guild of client.guilds.cache.values()) {
            const isOwner = guild.ownerId === client.user.id;
            let me = guild.members?.me || guild.members?.cache?.get(client.user.id);
            
            // If already known owner, owner has all admin permissions implicitly
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


