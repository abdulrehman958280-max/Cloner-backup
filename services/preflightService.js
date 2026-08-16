/**
 * Preflight Check Engine - Evaluates credentials, guild permissions, resources, and safety policies
 */

import { ERROR_CODES } from './configContract.js';
import { createDiscordClient, authenticateClient, destroyClient } from './discordService.js';
import { createCleanupPlan } from './cleaner/index.js';

export async function runPreflightCheck({
    userToken,
    sourceId,
    targetId,
    options = {}
}) {
    let client = null;
    const checks = [];
    const counts = {
        roles: 0,
        categories: 0,
        channels: 0,
        textChannels: 0,
        voiceChannels: 0,
        announcementChannels: 0,
        stageChannels: 0,
        forumChannels: 0,
        threads: 0,
        unsupportedChannels: 0,
        targetExistingChannels: 0,
        targetExistingRoles: 0
    };

    let isBlocked = false;
    let blockReason = null;
    let sourceGuildName = 'Unknown';
    let targetGuildName = 'Unknown';
    let cleanupPreview = null;

    try {
        // 1. Client & Token Authentication Check
        client = createDiscordClient();
        let user = null;
        try {
            user = await authenticateClient(client, userToken);
            checks.push({
                name: 'User Token Authentication',
                status: 'PASSED',
                detail: `Authenticated as ${user.tag || user.username}`
            });
        } catch (authErr) {
            isBlocked = true;
            blockReason = 'Discord token is invalid, expired, or rejected by the Discord gateway.';
            checks.push({
                name: 'User Token Authentication',
                status: 'BLOCKED',
                detail: authErr.message || 'Authentication failed'
            });
            return {
                ready: false,
                status: 'BLOCKED',
                reason: blockReason,
                code: ERROR_CODES.AUTHENTICATION_ERROR,
                checks,
                counts
            };
        }

        // 2. Fetch Guilds
        const sourceGuild = client.guilds.cache.get(sourceId);
        const targetGuild = client.guilds.cache.get(targetId);

        if (!sourceGuild) {
            isBlocked = true;
            blockReason = `Source server (${sourceId}) was not found in your Discord account. Ensure your user account is in this server.`;
            checks.push({
                name: 'Source Server Access',
                status: 'BLOCKED',
                detail: `Guild ID ${sourceId} not found in account cache`
            });
        } else {
            sourceGuildName = sourceGuild.name;
            checks.push({
                name: 'Source Server Access',
                status: 'PASSED',
                detail: `"${sourceGuild.name}" (${sourceGuild.memberCount || 'N/A'} members)`
            });
        }

        if (!targetGuild) {
            isBlocked = true;
            blockReason = `Target server (${targetId}) was not found in your Discord account. Ensure your user account is in this server.`;
            checks.push({
                name: 'Target Server Access',
                status: 'BLOCKED',
                detail: `Guild ID ${targetId} not found in account cache`
            });
        } else {
            targetGuildName = targetGuild.name;
            checks.push({
                name: 'Target Server Access',
                status: 'PASSED',
                detail: `"${targetGuild.name}"`
            });
        }

        if (isBlocked) {
            return {
                ready: false,
                status: 'BLOCKED',
                reason: blockReason,
                code: ERROR_CODES.ACCESS_DENIED,
                checks,
                counts,
                sourceGuildName,
                targetGuildName
            };
        }

        // 3. Permission Checks on Target Server
        const targetMember = targetGuild.members?.me || targetGuild.me;
        const targetPermissions = targetMember?.permissions;
        const hasAdmin = targetPermissions?.has('ADMINISTRATOR') || targetMember?.id === targetGuild.ownerId;
        const hasManageChannels = targetPermissions?.has('MANAGE_CHANNELS');
        const hasManageRoles = targetPermissions?.has('MANAGE_ROLES');
        const hasManageGuild = targetPermissions?.has('MANAGE_GUILD');

        if (!hasAdmin && (!hasManageChannels || !hasManageRoles)) {
            checks.push({
                name: 'Target Server Administrative Permissions',
                status: 'WARNING',
                detail: 'Account lacks Administrator permission. Creation of certain roles, channels, or permission overwrites may fail.'
            });
        } else {
            checks.push({
                name: 'Target Server Administrative Permissions',
                status: 'PASSED',
                detail: hasAdmin ? 'Administrator permission confirmed' : 'Manage Guild/Channels/Roles permissions confirmed'
            });
        }

        // 4. Pre-fetch Source Structure
        await Promise.allSettled([
            sourceGuild.roles.fetch().catch(() => {}),
            sourceGuild.channels.fetch().catch(() => {}),
            targetGuild.roles.fetch().catch(() => {}),
            targetGuild.channels.fetch().catch(() => {})
        ]);

        const sourceRoles = Array.from(sourceGuild.roles.cache.values()).filter(r => !r.managed && r.name !== '@everyone');
        counts.roles = sourceRoles.length;

        const sourceChannels = Array.from(sourceGuild.channels.cache.values());
        for (const ch of sourceChannels) {
            if (ch.type === 'GUILD_CATEGORY') counts.categories++;
            else if (ch.type === 'GUILD_TEXT') counts.textChannels++;
            else if (ch.type === 'GUILD_VOICE') counts.voiceChannels++;
            else if (ch.type === 'GUILD_NEWS') counts.announcementChannels++;
            else if (ch.type === 'GUILD_STAGE_VOICE') counts.stageChannels++;
            else if (ch.type === 'GUILD_FORUM') counts.forumChannels++;
            else if (ch.isThread && ch.isThread()) counts.threads++;
            else {
                counts.unsupportedChannels++;
            }
        }
        counts.channels = sourceChannels.filter(c => c.type !== 'GUILD_CATEGORY').length;
        counts.targetExistingChannels = targetGuild.channels.cache.size;
        counts.targetExistingRoles = targetGuild.roles.cache.size;

        if (counts.unsupportedChannels > 0) {
            checks.push({
                name: 'Channel Type Compatibility',
                status: 'WARNING',
                detail: `${counts.unsupportedChannels} unsupported or specialized channel type(s) detected. They will be safely recorded or created with standard fallback.`
            });
        } else {
            checks.push({
                name: 'Channel Type Compatibility',
                status: 'PASSED',
                detail: `All ${counts.channels} channels use fully supported Discord types`
            });
        }

        // 5. Cleanup Plan Inspection
        if (options.cleanTarget) {
            cleanupPreview = createCleanupPlan(targetGuild, options.cleanupMode || 'full', options);
            checks.push({
                name: 'Target Cleanup Policy',
                status: 'WARNING',
                detail: `Cleanup enabled: ${cleanupPreview.summary.channelsToDeleteCount} channels and ${cleanupPreview.summary.rolesToDeleteCount} custom roles scheduled for deletion.`
            });
        } else {
            checks.push({
                name: 'Target Cleanup Policy',
                status: 'PASSED',
                detail: 'Cleanup disabled: Existing target channels and roles will be preserved.'
            });
        }

        // 6. Messages & Attachments Check
        if (options.cloneMessages) {
            checks.push({
                name: 'Message History Migration',
                status: 'INFO',
                detail: `Enabled: Up to ${options.msgLimit || 15} messages per text channel via webhooks (Attachments: ${options.cloneAttachments ? 'ON' : 'OFF'}).`
            });
        } else {
            checks.push({
                name: 'Message History Migration',
                status: 'PASSED',
                detail: 'Disabled: Message chat history will not be fetched or migrated.'
            });
        }

        const hasWarnings = checks.some(c => c.status === 'WARNING');

        return {
            ready: true,
            status: hasWarnings ? 'WARNING' : 'READY',
            checks,
            counts,
            sourceGuildName,
            targetGuildName,
            cleanupPreview
        };

    } finally {
        destroyClient(client);
    }
}
