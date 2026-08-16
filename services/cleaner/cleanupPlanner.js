/**
 * Cleaner Planner - Inspects target guild and generates a safe cleanup plan
 * with role-first discovery, hierarchy categorization, and protected entity isolation.
 */

import { CLEANUP_MODES } from '../configContract.js';
import { CleanerPolicy } from './cleanerPolicy.js';

export function createCleanupPlan(targetGuild, mode = CLEANUP_MODES.NONE, options = {}) {
    if (!targetGuild) {
        throw new Error('Target guild is required to plan cleanup.');
    }

    if (mode === CLEANUP_MODES.NONE) {
        return {
            mode: CLEANUP_MODES.NONE,
            enabled: false,
            summary: {
                rolesFoundCount: 0,
                rolesToDeleteCount: 0,
                protectedRolesCount: 0,
                managedRolesCount: 0,
                channelsFoundCount: 0,
                channelsToDeleteCount: 0,
                protectedChannelsCount: 0
            },
            roles: {
                all: [],
                toDelete: [],
                protected: [],
                managed: []
            },
            channels: {
                all: [],
                toDelete: [],
                protected: []
            },
            // Legacy / convenience aliases
            channelsToDelete: [],
            rolesToDelete: [],
            protectedChannels: [],
            protectedRoles: []
        };
    }

    const policy = new CleanerPolicy(mode, options);
    
    // Resolve client context and hierarchy reliably
    const clientUser = targetGuild.client?.user;
    const clientMember = targetGuild.members?.me || targetGuild.me || (clientUser ? targetGuild.members?.cache?.get(clientUser.id) : null);
    const isOwner = Boolean(
        (targetGuild.ownerId && clientUser && targetGuild.ownerId === clientUser.id) ||
        (targetGuild.ownerId && clientMember?.id && targetGuild.ownerId === clientMember.id)
    );
    const clientHighestRolePosition = isOwner ? 99999 : (clientMember?.roles?.highest?.position ?? 99999);

    const context = {
        isOwner,
        clientHighestRolePosition,
        systemChannelId: targetGuild.systemChannelId,
        rulesChannelId: targetGuild.rulesChannelId,
        publicUpdatesChannelId: targetGuild.publicUpdatesChannelId,
        manifestChannelIds: options.manifestChannelIds || new Set(),
        manifestRoleIds: options.manifestRoleIds || new Set()
    };

    // =========================================================================
    // 1. DISCOVER & ANALYZE TARGET ROLES (FIRST)
    // =========================================================================
    const allRoleObjects = [];
    const rolesToDelete = [];
    const protectedRoles = [];
    const managedRoles = [];

    const rawRoles = Array.from(targetGuild.roles?.cache?.values() || []);

    for (const role of rawRoles) {
        const check = policy.isRoleProtected(role, context);
        const roleInfo = {
            id: role.id,
            name: role.name,
            position: role.position ?? 0,
            managed: Boolean(check.managed || role.managed || role.tags?.botId || role.tags?.integrationId),
            deletable: Boolean(check.deletable),
            protected: Boolean(check.protected),
            reason: check.reason || null
        };

        allRoleObjects.push(roleInfo);

        if (roleInfo.managed) {
            managedRoles.push(roleInfo);
        }

        if (check.protected) {
            protectedRoles.push(roleInfo);
        } else {
            rolesToDelete.push(roleInfo);
        }
    }

    // Sort roles to delete from lowest position to highest (safe bottom-up deletion)
    rolesToDelete.sort((a, b) => a.position - b.position);

    // =========================================================================
    // 2. DISCOVER & ANALYZE TARGET CHANNELS & CATEGORIES (SECOND)
    // =========================================================================
    const allChannelObjects = [];
    const channelsToDelete = [];
    const protectedChannels = [];

    const rawChannels = Array.from(targetGuild.channels?.cache?.values() || []);

    for (const ch of rawChannels) {
        const check = policy.isChannelProtected(ch, context);
        const isCategory = ch.type === 4 || ch.type === 'GUILD_CATEGORY' || ch.type === 'category';
        
        const chInfo = {
            id: ch.id,
            name: ch.name,
            type: ch.type,
            position: ch.position ?? 0,
            isCategory,
            deletable: Boolean(check.deletable),
            protected: Boolean(check.protected),
            reason: check.reason || null
        };

        allChannelObjects.push(chInfo);

        if (check.protected) {
            protectedChannels.push(chInfo);
        } else {
            channelsToDelete.push(chInfo);
        }
    }

    // Sort channels so standard channels are deleted before category containers
    channelsToDelete.sort((a, b) => {
        if (a.isCategory && !b.isCategory) return 1;
        if (!a.isCategory && b.isCategory) return -1;
        return a.position - b.position;
    });

    return {
        mode,
        enabled: true,
        summary: {
            rolesFoundCount: allRoleObjects.length,
            rolesToDeleteCount: rolesToDelete.length,
            protectedRolesCount: protectedRoles.length,
            managedRolesCount: managedRoles.length,
            channelsFoundCount: allChannelObjects.length,
            channelsToDeleteCount: channelsToDelete.length,
            protectedChannelsCount: protectedChannels.length
        },
        roles: {
            all: allRoleObjects,
            toDelete: rolesToDelete,
            protected: protectedRoles,
            managed: managedRoles
        },
        channels: {
            all: allChannelObjects,
            toDelete: channelsToDelete,
            protected: protectedChannels
        },
        // Backwards compatible aliases
        channelsToDelete,
        rolesToDelete,
        protectedChannels,
        protectedRoles
    };
}

