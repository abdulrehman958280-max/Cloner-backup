import { createDiscordClient, authenticateClient, destroyClient } from './discordService.js';
import { validateToken } from './validationService.js';

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
            await client.guilds.fetch({ timeout: 10000 });
        } catch {
            // fallback to cache
        }

        const guilds = [];
        for (const guild of client.guilds.cache.values()) {
            let me = guild.members.cache.get(client.user.id);
            if (!me) {
                try {
                    me = await guild.members.fetch(client.user.id);
                } catch {
                    me = null;
                }
            }

            const isOwner = guild.ownerId === client.user.id;
            const isAdmin = isOwner || (me && me.permissions && me.permissions.has('ADMINISTRATOR'));
            const canManage = isOwner || isAdmin || (me && me.permissions && me.permissions.has('MANAGE_GUILD'));

            guilds.push({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL({ dynamic: true, size: 256 }) || null,
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
