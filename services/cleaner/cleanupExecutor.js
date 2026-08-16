/**
 * Cleaner Executor - Executes planned deletions in strict role-first order
 * with rate-limit pacing, centralized reliability layer, bounded concurrency,
 * retry idempotency handling, explicit stage verification, and cancellation support.
 */

import {
    executeDiscordOperation,
    OPERATION_POLICIES,
    CONCURRENCY_LIMITS,
    createConcurrencyLimiter
} from '../reliability/index.js';
import { verifyRoleCleanupState } from './cleanupVerifier.js';

export async function executeCleanupPlan({
    targetGuild,
    plan,
    onProgress = () => {},
    onLog = () => {},
    isCancelled = () => false,
    options = {}
}) {
    if (!plan || !plan.enabled || plan.mode === 'none') {
        return {
            status: 'SKIPPED',
            roles: { planned: 0, deleted: 0, failed: 0, skipped: 0, items: [] },
            channels: { planned: 0, deleted: 0, failed: 0, skipped: 0, items: [] }
        };
    }

    const checkCancelled = () => {
        if (isCancelled()) {
            const err = new Error('Cleanup operation was cancelled by user.');
            err.code = 'CANCELLED';
            throw err;
        }
    };

    const roleConcurrency = Math.max(1, options.cleanerRoleConcurrency || CONCURRENCY_LIMITS.CLEANER_ROLE_CONCURRENCY || 2);
    const channelConcurrency = Math.max(1, options.cleanerChannelConcurrency || CONCURRENCY_LIMITS.CLEANER_CHANNEL_CONCURRENCY || 3);

    const roleItems = [];
    const channelItems = [];

    const rolesToDelete = plan.roles?.toDelete || plan.rolesToDelete || [];
    const protectedRoles = plan.roles?.protected || plan.protectedRoles || [];
    const managedRoles = plan.roles?.managed || [];

    const channelsToDelete = plan.channels?.toDelete || plan.channelsToDelete || [];
    const protectedChannels = plan.channels?.protected || plan.protectedChannels || [];

    const roleStats = {
        planned: rolesToDelete.length,
        deleted: 0,
        failed: 0,
        skipped: protectedRoles.length,
        items: roleItems
    };

    const channelStats = {
        planned: channelsToDelete.length,
        deleted: 0,
        failed: 0,
        skipped: protectedChannels.length,
        items: channelItems
    };

    // Track protected role entities
    for (const protRole of protectedRoles) {
        roleItems.push({
            id: protRole.id,
            name: protRole.name,
            type: 'role',
            status: 'PROTECTED',
            reason: protRole.reason || 'Protected by policy'
        });
    }

    // Track protected channel entities
    for (const protCh of protectedChannels) {
        channelItems.push({
            id: protCh.id,
            name: protCh.name,
            type: 'channel',
            status: 'PROTECTED',
            reason: protCh.reason || 'Protected by policy'
        });
    }

    // =========================================================================
    // STAGE 1: DISCOVER & DELETE TARGET ROLES (ROLE-FIRST)
    // =========================================================================
    checkCancelled();
    onLog('info', 'ROLE CLEANUP: Discovering target server roles...', null, 'cleaning_target');
    const totalRolesFound = rolesToDelete.length + protectedRoles.length;
    onLog(
        'info',
        `ROLE CLEANUP: ${totalRolesFound} roles found (Deletable: ${rolesToDelete.length}, Protected: ${protectedRoles.length}, Managed: ${managedRoles.length})`,
        null,
        'cleaning_target'
    );

    if (rolesToDelete.length > 0) {
        onLog('info', `ROLE CLEANUP: Deleting ${rolesToDelete.length} deletable target roles (bounded concurrency: ${roleConcurrency}, recursive mode enabled)...`, null, 'cleaning_target');

        let currentRolesToDelete = [...rolesToDelete];
        let maxRecursivePasses = 3;
        let pass = 0;
        let totalSuccessfullyDeleted = 0;

        while (pass < maxRecursivePasses && currentRolesToDelete.length > 0) {
            pass++;
            if (pass > 1) {
                onLog('info', `ROLE CLEANUP: Recursive pass ${pass} for remaining deletable roles...`, null, 'cleaning_target');
                try {
                    await targetGuild.roles?.fetch?.();
                } catch (e) {}
                
                currentRolesToDelete = currentRolesToDelete.filter(item => {
                    const role = targetGuild.roles?.cache?.get(item.id);
                    return role && role.name !== '@everyone' && !role.managed;
                });
                if (currentRolesToDelete.length === 0) break;
            }

            const roleLimiter = createConcurrencyLimiter(roleConcurrency);
            let completedRoles = 0;
            const sortedRoles = [...currentRolesToDelete].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            let passFailedItems = [];

            const roleTasks = sortedRoles.map((item) => {
                return roleLimiter(async () => {
                    checkCancelled();

                    const role = targetGuild.roles?.cache?.get(item.id);
                    if (!role) {
                        completedRoles++;
                        return;
                    }

                    try {
                        await executeDiscordOperation({
                            operationName: 'delete_role',
                            resourceType: 'role',
                            resourceId: item.id,
                            policy: OPERATION_POLICIES.DELETE,
                            isCancelled,
                            checkIdempotency: async () => {
                                const current = targetGuild.roles?.cache?.get(item.id);
                                if (!current) {
                                    return { deleted: true, reason: 'Already deleted' };
                                }
                                return null;
                            },
                            execute: async () => {
                                await role.delete();
                            },
                            onRetry: ({ attempt, maxAttempts, waitMs }) => {
                                onLog('warning', `Retrying deletion of @${item.name} (${attempt}/${maxAttempts}) in ${waitMs}ms...`, null, 'cleaning_target');
                            },
                            onRateLimit: ({ retryAfterMs }) => {
                                onLog('warning', `Rate-limited while deleting @${item.name}. Backing off for ${retryAfterMs}ms...`, null, 'cleaning_target');
                            }
                        });

                        totalSuccessfullyDeleted++;
                        if (pass === 1) {
                            roleStats.deleted++;
                            roleItems.push({
                                id: item.id,
                                name: item.name,
                                type: 'role',
                                status: 'DELETED'
                            });
                        }
                    } catch (err) {
                        const rawMsg = err?.message || String(err);
                        const isAlreadyDeleted = (
                            err?.statusCode === 404 ||
                            err?.code === 'NOT_FOUND' ||
                            err?.originalCode === 10011 ||
                            rawMsg.toLowerCase().includes('unknown role')
                        );

                        if (isAlreadyDeleted) {
                            totalSuccessfullyDeleted++;
                            if (pass === 1) {
                                roleStats.deleted++;
                                roleItems.push({
                                    id: item.id,
                                    name: item.name,
                                    type: 'role',
                                    status: 'DELETED',
                                    note: 'Role was already removed'
                                });
                            }
                        } else {
                            passFailedItems.push(item);
                            if (pass === maxRecursivePasses) {
                                roleStats.failed++;
                                roleItems.push({
                                    id: item.id,
                                    name: item.name,
                                    type: 'role',
                                    status: 'FAILED',
                                    error: rawMsg
                                });
                                onLog('warning', `Could not delete role @${item.name}: ${rawMsg}`, null, 'cleaning_target');
                            }
                        }
                    } finally {
                        completedRoles++;
                        const progressPct = Math.round((completedRoles / Math.max(1, currentRolesToDelete.length)) * 50);
                        onProgress(progressPct, completedRoles, currentRolesToDelete.length, `Deleted @${item.name}`);
                    }
                });
            });

            await Promise.allSettled(roleTasks);
            currentRolesToDelete = passFailedItems;
        }
    } else {
        onLog('info', 'ROLE CLEANUP: No custom roles required deletion.', null, 'cleaning_target');
    }

    onLog(
        roleStats.failed === 0 ? 'success' : 'warning',
        `ROLE CLEANUP COMPLETE: ${roleStats.deleted} deleted, ${roleStats.skipped} protected/skipped${roleStats.failed > 0 ? `, ${roleStats.failed} failed` : ''}`,
        null,
        'cleaning_target'
    );

    // =========================================================================
    // STAGE 2: VERIFY ROLE CLEANUP BEFORE PROCEEDING
    // =========================================================================
    checkCancelled();
    const roleVerification = verifyRoleCleanupState(targetGuild, roleStats);
    if (!roleVerification.verified) {
        onLog('warning', `Role cleanup finished with ${roleVerification.failed} failed items, continuing with channel cleanup...`, null, 'cleaning_target');
    } else {
        onLog('info', 'Role cleanup verified. Proceeding to target channel cleanup...', null, 'cleaning_target');
    }

    // =========================================================================
    // STAGE 3: DISCOVER & DELETE TARGET CHANNELS & CATEGORIES
    // =========================================================================
    checkCancelled();
    onLog('info', 'CHANNEL CLEANUP: Discovering target server channels and categories...', null, 'cleaning_target');
    const totalChannelsFound = channelsToDelete.length + protectedChannels.length;
    onLog(
        'info',
        `CHANNEL CLEANUP: ${totalChannelsFound} channels/categories found (Deletable: ${channelsToDelete.length}, Protected: ${protectedChannels.length})`,
        null,
        'cleaning_target'
    );

    if (channelsToDelete.length > 0) {
        onLog('info', `CHANNEL CLEANUP: Deleting ${channelsToDelete.length} deletable channels & categories (bounded concurrency: ${channelConcurrency})...`, null, 'cleaning_target');

        const channelLimiter = createConcurrencyLimiter(channelConcurrency);
        let completedChannels = 0;

        const channelTasks = channelsToDelete.map((item) => {
            return channelLimiter(async () => {
                checkCancelled();

                const ch = targetGuild.channels?.cache?.get(item.id);
                if (!ch) {
                    channelStats.skipped++;
                    channelItems.push({
                        id: item.id,
                        name: item.name,
                        type: 'channel',
                        status: 'SKIPPED',
                        reason: 'Channel no longer exists in target server'
                    });
                    completedChannels++;
                    return;
                }

                try {
                    await executeDiscordOperation({
                        operationName: 'delete_channel',
                        resourceType: 'channel',
                        resourceId: item.id,
                        policy: OPERATION_POLICIES.DELETE,
                        isCancelled,
                        checkIdempotency: async () => {
                            const current = targetGuild.channels?.cache?.get(item.id);
                            if (!current) {
                                return { deleted: true, reason: 'Already deleted' };
                            }
                            return null;
                        },
                        execute: async () => {
                            await ch.delete();
                        },
                        onRetry: ({ attempt, maxAttempts, waitMs }) => {
                            onLog('warning', `Retrying deletion of #${item.name} (${attempt}/${maxAttempts}) in ${waitMs}ms...`, null, 'cleaning_target');
                        },
                        onRateLimit: ({ retryAfterMs }) => {
                            onLog('warning', `Rate-limited while deleting #${item.name}. Backing off for ${retryAfterMs}ms...`, null, 'cleaning_target');
                        }
                    });

                    channelStats.deleted++;
                    channelItems.push({
                        id: item.id,
                        name: item.name,
                        type: 'channel',
                        status: 'DELETED'
                    });
                } catch (err) {
                    const rawMsg = err?.message || String(err);
                    const isAlreadyDeleted = (
                        err?.statusCode === 404 ||
                        err?.code === 'NOT_FOUND' ||
                        err?.originalCode === 10003 ||
                        rawMsg.toLowerCase().includes('unknown channel')
                    );

                    if (isAlreadyDeleted) {
                        channelStats.deleted++;
                        channelItems.push({
                            id: item.id,
                            name: item.name,
                            type: 'channel',
                            status: 'DELETED',
                            note: 'Channel was already removed'
                        });
                    } else {
                        channelStats.failed++;
                        channelItems.push({
                            id: item.id,
                            name: item.name,
                            type: 'channel',
                            status: 'FAILED',
                            error: rawMsg
                        });
                        onLog('warning', `Could not delete channel #${item.name}: ${rawMsg}`, null, 'cleaning_target');
                    }
                } finally {
                    completedChannels++;
                    const progressPct = 50 + Math.round((completedChannels / Math.max(1, channelsToDelete.length)) * 50);
                    onProgress(progressPct, completedChannels, channelsToDelete.length, `Deleted #${item.name}`);
                }
            });
        });

        await Promise.allSettled(channelTasks);
    } else {
        onLog('info', 'CHANNEL CLEANUP: No custom channels required deletion.', null, 'cleaning_target');
    }

    onLog(
        channelStats.failed === 0 ? 'success' : 'warning',
        `CHANNEL CLEANUP COMPLETE: ${channelStats.deleted} deleted, ${channelStats.skipped} protected/skipped${channelStats.failed > 0 ? `, ${channelStats.failed} failed` : ''}`,
        null,
        'cleaning_target'
    );

    // =========================================================================
    // STAGE 4: OVERALL EVALUATION & SUMMARY STATUS
    // =========================================================================
    const hasFailures = roleStats.failed > 0 || channelStats.failed > 0;
    const totalPlanned = roleStats.planned + channelStats.planned;
    const totalDeleted = roleStats.deleted + channelStats.deleted;

    let status = 'SUCCESS';
    if (hasFailures && totalDeleted > 0) {
        status = 'PARTIAL';
    } else if (hasFailures && totalDeleted === 0 && totalPlanned > 0) {
        status = 'FAILED';
    } else if (totalDeleted < totalPlanned && hasFailures) {
        status = 'PARTIAL';
    }

    return {
        status,
        roles: roleStats,
        channels: channelStats
    };
}

