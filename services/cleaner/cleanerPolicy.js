/**
 * Cleaner Policy & Protected Resource Rules
 */

import { CLEANUP_MODES } from '../configContract.js';

export class CleanerPolicy {
    constructor(mode = CLEANUP_MODES.NONE, options = {}) {
        this.mode = mode;
        this.options = options;
    }

    /**
     * Determines whether a role is protected from deletion.
     * Evaluates @everyone, managed bots/integrations/booster roles,
     * hierarchy relative to client role, and client permissions.
     * 
     * @param {Object} role - Discord Role object
     * @param {Object} context - { isOwner, clientHighestRolePosition, manifestRoleIds }
     * @returns {{ protected: boolean, reason?: string, managed: boolean, deletable: boolean }}
     */
    isRoleProtected(role, context = {}) {
        if (!role) {
            return {
                protected: true,
                reason: 'Invalid or missing role object',
                managed: false,
                deletable: false
            };
        }

        const isManaged = Boolean(
            role.managed ||
            role.tags?.botId ||
            role.tags?.integrationId ||
            role.tags?.premiumSubscriberRole
        );

        // 1. @everyone cannot and must not be deleted
        if (role.name === '@everyone' || role.id === role.guild?.id || role.position === 0) {
            return {
                protected: true,
                reason: 'System role (@everyone) cannot be deleted',
                managed: isManaged,
                deletable: false
            };
        }

        // 2. Managed roles (bots, integrations, nitro booster) cannot be deleted manually
        if (isManaged) {
            return {
                protected: true,
                reason: 'Managed system/integration/bot role',
                managed: true,
                deletable: false
            };
        }

        // 3. Discord client cannot delete roles higher than or equal to its highest role unless server owner
        if (!context.isOwner) {
            const clientMaxPos = (context.clientHighestRolePosition !== undefined && context.clientHighestRolePosition > 0)
                ? context.clientHighestRolePosition
                : 99999;

            if (clientMaxPos < 99999 && role.position >= clientMaxPos) {
                return {
                    protected: true,
                    reason: `Role hierarchy (${role.position}) is higher than or equal to client role hierarchy (${clientMaxPos})`,
                    managed: false,
                    deletable: false
                };
            }
        }

        // 4. MANAGED cleanup mode constraint
        if (this.mode === CLEANUP_MODES.MANAGED) {
            const isTracked = context.manifestRoleIds?.has?.(role.id);
            if (!isTracked) {
                return {
                    protected: true,
                    reason: 'Unmanaged role (MANAGED mode)',
                    managed: false,
                    deletable: false
                };
            }
        }

        return {
            protected: false,
            managed: false,
            deletable: true
        };
    }

    /**
     * Determines whether a channel is protected from deletion.
     * @param {Object} channel - Discord Channel object
     * @param {Object} context - { systemChannelId, rulesChannelId, publicUpdatesChannelId, manifestChannelIds, isOwner }
     * @returns {{ protected: boolean, reason?: string, deletable: boolean }}
     */
    isChannelProtected(channel, context = {}) {
        if (!channel) {
            return { protected: true, reason: 'Invalid channel object', deletable: false };
        }

        if (channel.deletable === false && !context.isOwner) {
            return { protected: true, reason: 'Channel is marked non-deletable by client permissions', deletable: false };
        }

        // If in MANAGED mode, only delete if managed by previous migration manifest
        if (this.mode === CLEANUP_MODES.MANAGED) {
            const isManaged = context.manifestChannelIds?.has?.(channel.id);
            if (!isManaged) {
                return { protected: true, reason: 'Unmanaged resource (MANAGED mode)', deletable: false };
            }
        }

        return { protected: false, deletable: true };
    }
}

