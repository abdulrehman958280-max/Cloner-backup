/**
 * DISCLONER - Enterprise Server Clone & Migration Engine
 * User-token based architecture with centralized reliability, rate-limit backoff,
 * bounded concurrency, idempotency safety, and comprehensive telemetry.
 */

import { createLogEntry } from '../utils/logger.js';
import { createDiscordClient, authenticateClient, destroyClient } from './discordService.js';
import { createCleanupPlan, executeCleanupPlan, verifyCleanupState } from './cleaner/index.js';
import { MigrationManifest } from './manifest.js';
import { verifyTargetGuildMigration } from './verifyService.js';
import { VERIFICATION_STATUSES } from './configContract.js';
import {
    executeDiscordOperation,
    OPERATION_POLICIES,
    cancellableSleep,
    globalRateLimiter
} from './reliability/index.js';

/**
 * Sanitizes content to prevent unintended massive pings
 */
function sanitizeMentions(text, policy = 'sanitize') {
    if (!text || typeof text !== 'string' || policy === 'allow') return text;
    return text
        .replace(/@everyone/g, '@\u200beveryone')
        .replace(/@here/g, '@\u200bhere');
}

/**
 * Executes a full Discord server cloning operation with verification and telemetry
 */
export async function executeClone({
    userToken,
    sourceId,
    targetId,
    options = {},
    onStage = () => {},
    onProgress = () => {},
    onLog = () => {},
    isCancelled = () => false
}) {
    const manifest = new MigrationManifest(sourceId, targetId, options);

    const emitLog = (type, message, detail = null, stage = null) => {
        if (type === 'warning') manifest.addWarning(message, detail);
        if (type === 'error') manifest.addError(message, null, detail);
        onLog(createLogEntry(type, message, detail, stage));
    };

    let client = null;
    const activeWebhooks = [];

    const checkCancellation = () => {
        if (isCancelled()) {
            throw new Error('Operation was cancelled by user.');
        }
    };

    // Shared event handlers for operation executor
    const makeRetryHandler = (stage) => ({ operation, resourceType, attempt, maxAttempts, waitMs }) => {
        manifest.recordRetry(waitMs);
        emitLog('warning', `Retrying ${operation} for ${resourceType || 'item'} (${attempt}/${maxAttempts}) in ${(waitMs / 1000).toFixed(1)}s...`, null, stage);
    };

    const makeRateLimitHandler = (stage) => ({ operation, resourceType, retryAfterMs }) => {
        manifest.recordRateLimit(retryAfterMs);
        emitLog('warning', `Rate-limit detected on ${operation}. Backing off for ${(retryAfterMs / 1000).toFixed(1)}s...`, null, stage);
    };

    try {
        // ======================================================================
        // 1. DISCOVERY & INITIALIZATION
        // ======================================================================
        onStage('initializing', 'Initializing Client Session', 2);
        emitLog('info', 'Starting client session with Discord Gateway...', null, 'initializing');
        client = createDiscordClient();

        // ======================================================================
        // 2. AUTHENTICATING
        // ======================================================================
        checkCancellation();
        onStage('authenticating', 'Authenticating Credentials', 6);
        emitLog('info', 'Authenticating token with Discord...', null, 'authenticating');

        const user = await authenticateClient(client, userToken);
        emitLog('success', `Authenticated as ${user.tag || user.username}`, null, 'authenticating');

        // ======================================================================
        // 3. VALIDATING SERVERS
        // ======================================================================
        checkCancellation();
        onStage('validating_servers', 'Detecting Source and Target Guilds', 12);
        emitLog('info', 'Searching for source & target servers in account cache...', null, 'validating_servers');

        const sourceGuild = client.guilds.cache.get(sourceId);
        const targetGuild = client.guilds.cache.get(targetId);

        if (!sourceGuild) {
            throw new Error(`Source server with ID (${sourceId}) was not found or your account does not have access.`);
        }
        if (!targetGuild) {
            throw new Error(`Target server with ID (${targetId}) was not found or your account is not a member.`);
        }

        emitLog('success', `Source: "${sourceGuild.name}" (${sourceGuild.memberCount || 'N/A'} members)`, null, 'validating_servers');
        emitLog('success', `Target: "${targetGuild.name}"`, null, 'validating_servers');

        // ======================================================================
        // 4. READING SOURCE STRUCTURE
        // ======================================================================
        checkCancellation();
        onStage('reading_source', 'Reading Source Guild Structure', 18);
        emitLog('info', 'Fetching roles, channels, categories, and guild configuration...', null, 'reading_source');

        try {
            await executeDiscordOperation({
                operationName: 'fetch_guild_structures',
                resourceType: 'guild',
                policy: OPERATION_POLICIES.READ,
                isCancelled,
                execute: async () => {
                    await Promise.allSettled([
                        sourceGuild.roles?.fetch?.().catch(() => {}),
                        sourceGuild.channels?.fetch?.().catch(() => {}),
                        targetGuild.roles?.fetch?.().catch(() => {}),
                        targetGuild.channels?.fetch?.().catch(() => {})
                    ]);
                },
                onRetry: makeRetryHandler('reading_source'),
                onRateLimit: makeRateLimitHandler('reading_source')
            });
        } catch (fetchErr) {
            emitLog('warning', 'Could not pre-fetch full guild cache, using cached structure.', fetchErr.message, 'reading_source');
        }

        // ======================================================================
        // 5. OPTIONAL CLEANUP STAGE
        // ======================================================================
        let cleanupReport = { status: 'SKIPPED' };
        if (options.cleanTarget) {
            checkCancellation();
            onStage('cleaning_target', 'Cleaning Target Server Structure', 24);

            try {
                await Promise.allSettled([
                    targetGuild.roles?.fetch?.().catch(() => {}),
                    targetGuild.channels?.fetch?.().catch(() => {}),
                    targetGuild.members?.fetchMe?.().catch(() => targetGuild.members?.fetch?.(client.user.id).catch(() => {}))
                ]);
            } catch (e) {}

            const cleanupPlan = createCleanupPlan(targetGuild, options.cleanupMode || 'full', options);
            emitLog('info', `Target cleanup starting (${cleanupPlan.summary.channelsToDeleteCount} channels, ${cleanupPlan.summary.rolesToDeleteCount} roles to delete)...`, null, 'cleaning_target');

            const cleanupResult = await executeCleanupPlan({
                targetGuild,
                plan: cleanupPlan,
                onProgress: (pct, cur, tot, item) => onProgress(24 + Math.round((pct / 100) * 8), cur, tot, item),
                onLog: emitLog,
                isCancelled,
                options
            });

            cleanupReport = verifyCleanupState(targetGuild, cleanupResult);
            const failureCount = cleanupReport.failedResources?.length || 0;
            emitLog(
                cleanupReport.verified ? 'success' : 'warning',
                `Target cleanup finished with status: ${cleanupReport.status}${failureCount > 0 ? ` (${failureCount} unremoved items)` : ''}`,
                failureCount > 0 ? `${failureCount} failed` : null,
                'cleaning_target'
            );

            if (cleanupReport.failedResources && cleanupReport.failedResources.length > 0) {
                for (const failedItem of cleanupReport.failedResources) {
                    const tagType = (failedItem.type || 'resource').toUpperCase();
                    const reason = failedItem.error || 'Deletion failed';
                    emitLog(
                        'warning',
                        `[CLEANUP UNREMOVED ${tagType}] "${failedItem.name}" (ID: ${failedItem.id}) - Reason: ${reason}`,
                        `ID:${failedItem.id}`,
                        'cleaning_target'
                    );
                }
            }
        }

        // ======================================================================
        // 6. CLONING SERVER PROFILE / BRANDING
        // ======================================================================
        if (options.cloneProfile) {
            checkCancellation();
            onStage('cloning_profile', 'Cloning Server Branding & Profile', 34);
            emitLog('info', 'Synchronizing server title, icon, and banner assets...', null, 'cloning_profile');

            if (targetGuild.name !== sourceGuild.name) {
                try {
                    await executeDiscordOperation({
                        operationName: 'update_server_name',
                        resourceType: 'guild',
                        resourceId: targetGuild.id,
                        policy: OPERATION_POLICIES.UPDATE,
                        isCancelled,
                        execute: async () => {
                            await targetGuild.setName(sourceGuild.name);
                        },
                        onRetry: makeRetryHandler('cloning_profile'),
                        onRateLimit: makeRateLimitHandler('cloning_profile')
                    });
                    emitLog('success', `Updated server name to "${sourceGuild.name}"`, null, 'cloning_profile');
                } catch (err) {
                    emitLog('warning', 'Failed to update server name', err.message, 'cloning_profile');
                }
            }

            const iconUrl = sourceGuild.iconURL ? sourceGuild.iconURL({ dynamic: true, size: 4096 }) : null;
            if (iconUrl) {
                try {
                    await executeDiscordOperation({
                        operationName: 'update_server_icon',
                        resourceType: 'guild',
                        resourceId: targetGuild.id,
                        policy: OPERATION_POLICIES.UPDATE,
                        isCancelled,
                        execute: async () => {
                            await targetGuild.setIcon(iconUrl);
                        },
                        onRetry: makeRetryHandler('cloning_profile'),
                        onRateLimit: makeRateLimitHandler('cloning_profile')
                    });
                    emitLog('success', 'Synchronized server icon asset', null, 'cloning_profile');
                } catch (err) {
                    emitLog('warning', 'Could not apply server icon', err.message, 'cloning_profile');
                }
            }

            const bannerUrl = sourceGuild.bannerURL ? sourceGuild.bannerURL({ size: 4096 }) : null;
            if (bannerUrl) {
                try {
                    await executeDiscordOperation({
                        operationName: 'update_server_banner',
                        resourceType: 'guild',
                        resourceId: targetGuild.id,
                        policy: OPERATION_POLICIES.UPDATE,
                        isCancelled,
                        execute: async () => {
                            await targetGuild.setBanner(bannerUrl);
                        },
                        onRetry: makeRetryHandler('cloning_profile'),
                        onRateLimit: makeRateLimitHandler('cloning_profile')
                    });
                    emitLog('success', 'Synchronized server banner asset', null, 'cloning_profile');
                } catch (err) {
                    emitLog('warning', 'Could not apply server banner (tier requirement)', err.message, 'cloning_profile');
                }
            }
        }

        // ======================================================================
        // 6a. CLONING EMOJIS
        // ======================================================================
        if (options.cloneEmojis) {
            checkCancellation();
            onStage('cloning_emojis', 'Cloning Emojis', 35);
            emitLog('info', 'Cloning custom emojis...', null, 'cloning_emojis');

            try {
                const sourceEmojis = await sourceGuild.emojis.fetch();
                let emojiIdx = 0;
                for (const emoji of sourceEmojis.values()) {
                    checkCancellation();
                    emojiIdx++;
                    try {
                        await executeDiscordOperation({
                            operationName: 'create_emoji',
                            resourceType: 'emoji',
                            resourceId: emoji.name,
                            policy: OPERATION_POLICIES.CREATE,
                            isCancelled,
                            execute: async () => {
                                await targetGuild.emojis.create({
                                    attachment: emoji.url,
                                    name: emoji.name
                                });
                            },
                            onRetry: makeRetryHandler('cloning_emojis'),
                            onRateLimit: makeRateLimitHandler('cloning_emojis')
                        });
                        emitLog('success', `Cloned emoji :${emoji.name}:`, null, 'cloning_emojis');
                    } catch (err) {
                        emitLog('warning', `Failed to clone emoji ${emoji.name}`, err.message, 'cloning_emojis');
                    }
                }
            } catch (err) {
                emitLog('error', 'Failed to fetch source emojis', err.message, 'cloning_emojis');
            }
        }

        // ======================================================================
        // 6b. CLONING STICKERS
        // ======================================================================
        if (options.cloneStickers) {
            checkCancellation();
            onStage('cloning_stickers', 'Cloning Stickers', 38);
            emitLog('info', 'Cloning custom stickers...', null, 'cloning_stickers');

            try {
                const sourceStickers = await sourceGuild.stickers.fetch();
                let stickerIdx = 0;
                for (const sticker of sourceStickers.values()) {
                    checkCancellation();
                    stickerIdx++;
                    try {
                        await executeDiscordOperation({
                            operationName: 'create_sticker',
                            resourceType: 'sticker',
                            resourceId: sticker.name,
                            policy: OPERATION_POLICIES.CREATE,
                            isCancelled,
                            execute: async () => {
                                await targetGuild.stickers.create({
                                    file: sticker.url,
                                    name: sticker.name,
                                    tags: sticker.tags || 'cloned',
                                    description: sticker.description || ''
                                });
                            },
                            onRetry: makeRetryHandler('cloning_stickers'),
                            onRateLimit: makeRateLimitHandler('cloning_stickers')
                        });
                        emitLog('success', `Cloned sticker ${sticker.name}`, null, 'cloning_stickers');
                    } catch (err) {
                        emitLog('warning', `Failed to clone sticker ${sticker.name}`, err.message, 'cloning_stickers');
                    }
                }
            } catch (err) {
                emitLog('error', 'Failed to fetch source stickers', err.message, 'cloning_stickers');
            }
        }

        // ======================================================================
        // 7. CLONING ROLES
        // ======================================================================
        if (options.cloneRoles) {
            checkCancellation();
            onStage('cloning_roles', 'Cloning Roles & Hierarchy', 42);
            emitLog('info', 'Cloning custom roles, colors, and permissions...', null, 'cloning_roles');

            const sourceRoles = Array.from(sourceGuild.roles.cache.values())
                .filter(r => !r.managed)
                .sort((a, b) => a.position - b.position);

            manifest.roles.planned = sourceRoles.filter(r => r.name !== '@everyone').length;
            const totalRoles = sourceRoles.length;
            let roleIdx = 0;

            for (const role of sourceRoles) {
                checkCancellation();
                roleIdx++;
                const currentPct = 42 + Math.round((roleIdx / Math.max(1, totalRoles)) * 16);
                onProgress(currentPct, roleIdx, totalRoles, `@${role.name}`);

                if (role.name === '@everyone') {
                    const targetEveryone = targetGuild.roles.cache.find(r => r.name === '@everyone');
                    if (targetEveryone) {
                        try {
                            await executeDiscordOperation({
                                operationName: 'update_everyone_permissions',
                                resourceType: 'role',
                                resourceId: targetEveryone.id,
                                policy: OPERATION_POLICIES.UPDATE,
                                isCancelled,
                                execute: async () => {
                                    await targetEveryone.setPermissions(role.permissions);
                                },
                                onRetry: makeRetryHandler('cloning_roles'),
                                onRateLimit: makeRateLimitHandler('cloning_roles')
                            });
                            manifest.roleMap.set(role.id, targetEveryone.id);
                        } catch (permErr) {
                            emitLog('warning', 'Could not set @everyone base permissions', permErr.message, 'cloning_roles');
                        }
                    }
                    continue;
                }

                try {
                    const newRole = await executeDiscordOperation({
                        operationName: 'create_role',
                        resourceType: 'role',
                        resourceId: role.id,
                        policy: OPERATION_POLICIES.CREATE,
                        isCancelled,
                        checkIdempotency: async () => {
                            // Check if target already has this created role
                            return targetGuild.roles.cache.find(r => r.name === role.name && !r.managed);
                        },
                        execute: async () => {
                            return await targetGuild.roles.create({
                                name: role.name,
                                color: role.color,
                                hoist: role.hoist,
                                permissions: role.permissions,
                                mentionable: role.mentionable
                            });
                        },
                        onRetry: makeRetryHandler('cloning_roles'),
                        onRateLimit: makeRateLimitHandler('cloning_roles')
                    });

                    if (newRole) {
                        manifest.recordRole(role, newRole, 'created');
                        emitLog('success', `Created role @${role.name}`, null, 'cloning_roles');
                    }
                } catch (rCreateErr) {
                    manifest.recordRole(role, null, 'failed', rCreateErr);
                    emitLog('warning', `Failed to create role @${role.name}`, rCreateErr.message, 'cloning_roles');
                }

                await cancellableSleep(100, isCancelled);
            }
            emitLog('success', `Finished cloning roles (${manifest.roles.created} created, ${manifest.roles.failed} failed).`, null, 'cloning_roles');
        }

        // ======================================================================
        // 8. CLONING CATEGORIES
        // ======================================================================
        if (options.cloneChannels) {
            checkCancellation();
            onStage('cloning_categories', 'Building Category Containers', 60);
            emitLog('info', 'Building category containers and structure...', null, 'cloning_categories');

            const sourceCategories = Array.from(sourceGuild.channels.cache.values())
                .filter(c => c.type === 'GUILD_CATEGORY')
                .sort((a, b) => a.position - b.position);

            manifest.categories.planned = sourceCategories.length;
            const totalCats = sourceCategories.length;
            let catIdx = 0;

            for (const cat of sourceCategories) {
                checkCancellation();
                catIdx++;
                const currentPct = 60 + Math.round((catIdx / Math.max(1, totalCats)) * 8);
                onProgress(currentPct, catIdx, totalCats, `📁 ${cat.name}`);

                try {
                    const newCat = await executeDiscordOperation({
                        operationName: 'create_category',
                        resourceType: 'category',
                        resourceId: cat.id,
                        policy: OPERATION_POLICIES.CREATE,
                        isCancelled,
                        checkIdempotency: async () => {
                            return targetGuild.channels.cache.find(c => c.name === cat.name && c.type === 'GUILD_CATEGORY');
                        },
                        execute: async () => {
                            return await targetGuild.channels.create(cat.name, {
                                type: 'GUILD_CATEGORY',
                                position: cat.position
                            });
                        },
                        onRetry: makeRetryHandler('cloning_categories'),
                        onRateLimit: makeRateLimitHandler('cloning_categories')
                    });

                    if (newCat) {
                        manifest.recordCategory(cat, newCat, 'created');
                        emitLog('success', `Created category [${cat.name}]`, null, 'cloning_categories');
                    }
                } catch (catErr) {
                    manifest.recordCategory(cat, null, 'failed', catErr);
                    emitLog('warning', `Failed to create category [${cat.name}]`, catErr.message, 'cloning_categories');
                }

                await cancellableSleep(100, isCancelled);
            }
        }

        // ======================================================================
        // 9. CLONING CHANNELS
        // ======================================================================
        const targetChannelObjects = new Map(); // sourceId -> targetChannel Discord object
        if (options.cloneChannels) {
            checkCancellation();
            onStage('cloning_channels', 'Building Channels & Structure', 68);
            emitLog('info', 'Creating text, voice, and announcement channels...', null, 'cloning_channels');

            const sourceChannels = Array.from(sourceGuild.channels.cache.values())
                .filter(c => c.type !== 'GUILD_CATEGORY')
                .sort((a, b) => a.position - b.position);

            manifest.channels.planned = sourceChannels.length;
            const totalChans = sourceChannels.length;
            let chIdx = 0;

            for (const ch of sourceChannels) {
                checkCancellation();
                chIdx++;
                const currentPct = 68 + Math.round((chIdx / Math.max(1, totalChans)) * 14);
                onProgress(currentPct, chIdx, totalChans, `#${ch.name}`);

                const parentId = ch.parentId ? manifest.categoryMap.get(ch.parentId) : null;
                const channelOptions = {
                    type: ch.type,
                    topic: ch.topic || undefined,
                    nsfw: Boolean(ch.nsfw),
                    bitrate: ch.bitrate || undefined,
                    userLimit: ch.userLimit || undefined,
                    rateLimitPerUser: ch.rateLimitPerUser || undefined,
                    rtcRegion: ch.rtcRegion || undefined,
                    videoQualityMode: ch.videoQualityMode || undefined,
                    availableTags: ch.availableTags || undefined,
                    defaultReactionEmoji: ch.defaultReactionEmoji || undefined,
                    defaultSortOrder: ch.defaultSortOrder || undefined,
                    defaultThreadRateLimitPerUser: ch.defaultThreadRateLimitPerUser || undefined,
                    parent: parentId || undefined,
                    position: ch.position
                };

                try {
                    const newChannel = await executeDiscordOperation({
                        operationName: 'create_channel',
                        resourceType: 'channel',
                        resourceId: ch.id,
                        policy: OPERATION_POLICIES.CREATE,
                        isCancelled,
                        checkIdempotency: async () => {
                            return targetGuild.channels.cache.find(c => c.name === ch.name && c.type !== 'GUILD_CATEGORY' && (!parentId || c.parentId === parentId));
                        },
                        execute: async () => {
                            return await targetGuild.channels.create(ch.name, channelOptions);
                        },
                        onRetry: makeRetryHandler('cloning_channels'),
                        onRateLimit: makeRateLimitHandler('cloning_channels')
                    });

                    if (newChannel) {
                        manifest.recordChannel(ch, newChannel, 'created');
                        targetChannelObjects.set(ch.id, newChannel);
                        emitLog('success', `Created channel #${ch.name}`, null, 'cloning_channels');
                    }
                } catch (chErr) {
                    // Try graceful fallback with standard parameters
                    try {
                        const fallbackType = ch.type === 'GUILD_VOICE' ? 'GUILD_VOICE' : 'GUILD_TEXT';
                        const fallbackChannel = await executeDiscordOperation({
                            operationName: 'create_channel_fallback',
                            resourceType: 'channel',
                            resourceId: ch.id,
                            policy: OPERATION_POLICIES.CREATE,
                            isCancelled,
                            execute: async () => {
                                return await targetGuild.channels.create(ch.name, {
                                    type: fallbackType,
                                    parent: parentId || undefined
                                });
                            },
                            onRetry: makeRetryHandler('cloning_channels'),
                            onRateLimit: makeRateLimitHandler('cloning_channels')
                        });

                        if (fallbackChannel) {
                            manifest.recordChannel(ch, fallbackChannel, 'created');
                            targetChannelObjects.set(ch.id, fallbackChannel);
                            emitLog('warning', `Created channel #${ch.name} with standard fallback parameters`, chErr.message, 'cloning_channels');
                        }
                    } catch (fallbackErr) {
                        manifest.recordChannel(ch, null, 'failed', fallbackErr);
                        emitLog('warning', `Could not create channel #${ch.name}`, fallbackErr.message, 'cloning_channels');
                    }
                }

                await cancellableSleep(100, isCancelled);
            }

            // Map System and AFK channels if configured on source
            if (options.cloneProfile) {
                if (sourceGuild.afkChannelId && manifest.channelMap.has(sourceGuild.afkChannelId)) {
                    const mappedAfkId = manifest.channelMap.get(sourceGuild.afkChannelId);
                    try {
                        await targetGuild.setAFKChannel(mappedAfkId);
                        if (sourceGuild.afkTimeout) {
                            await targetGuild.setAFKTimeout(sourceGuild.afkTimeout);
                        }
                        emitLog('success', 'Mapped AFK voice channel and timeout', null, 'cloning_channels');
                    } catch (e) {
                        // ignore afk channel mapping warning
                    }
                }
                if (sourceGuild.systemChannelId && manifest.channelMap.has(sourceGuild.systemChannelId)) {
                    const mappedSysId = manifest.channelMap.get(sourceGuild.systemChannelId);
                    try {
                        await targetGuild.setSystemChannel(mappedSysId);
                        if (sourceGuild.systemChannelFlags) {
                            await targetGuild.setSystemChannelFlags(sourceGuild.systemChannelFlags);
                        }
                        emitLog('success', 'Mapped System messages channel and notifications', null, 'cloning_channels');
                    } catch (e) {
                        // ignore system channel mapping warning
                    }
                }
            }

            emitLog('success', `Finished building channels (${manifest.channels.created} created, ${manifest.channels.failed} failed).`, null, 'cloning_channels');
        }

        // ======================================================================
        // 10. APPLYING PERMISSION OVERWRITES
        // ======================================================================
        if (options.clonePermissions && (options.cloneRoles || options.cloneChannels)) {
            checkCancellation();
            onStage('applying_permissions', 'Applying Permission Overwrites', 82);
            emitLog('info', 'Configuring channel privacy & role overwrites...', null, 'applying_permissions');

            for (const [sourceChId, targetCh] of targetChannelObjects.entries()) {
                checkCancellation();
                const sourceCh = sourceGuild.channels.cache.get(sourceChId);
                if (!sourceCh || !sourceCh.permissionOverwrites) continue;

                const newOverwrites = [];
                for (const [id, overwrite] of sourceCh.permissionOverwrites.cache.entries()) {
                    manifest.permissions.planned++;
                    let targetIdResolved = null;
                    if (overwrite.type === 'role') {
                        targetIdResolved = manifest.roleMap.get(id);
                    } else if (overwrite.type === 'member') {
                        if (id === client.user.id) {
                            targetIdResolved = client.user.id;
                        }
                    }

                    if (targetIdResolved) {
                        newOverwrites.push({
                            id: targetIdResolved,
                            type: overwrite.type,
                            allow: overwrite.allow,
                            deny: overwrite.deny
                        });
                        manifest.permissions.applied++;
                    } else {
                        manifest.permissions.skipped++;
                    }
                }

                if (newOverwrites.length > 0 && targetCh.permissionOverwrites) {
                    try {
                        await executeDiscordOperation({
                            operationName: 'set_permission_overwrites',
                            resourceType: 'channel_permissions',
                            resourceId: targetCh.id,
                            policy: OPERATION_POLICIES.UPDATE,
                            isCancelled,
                            execute: async () => {
                                await targetCh.permissionOverwrites.set(newOverwrites);
                            },
                            onRetry: makeRetryHandler('applying_permissions'),
                            onRateLimit: makeRateLimitHandler('applying_permissions')
                        });
                    } catch (permErr) {
                        manifest.permissions.failed++;
                        emitLog('warning', `Failed to apply permissions to #${targetCh.name}`, permErr.message, 'applying_permissions');
                    }
                }
            }
            emitLog('success', `Applied ${manifest.permissions.applied} permission overwrites across channels (${manifest.permissions.skipped} skipped).`, null, 'applying_permissions');
        }

        // ======================================================================
        // 11. CLONING WEBHOOKS
        // ======================================================================
        if (options.cloneWebhooks && options.cloneChannels && targetChannelObjects.size > 0) {
            checkCancellation();
            onStage('cloning_webhooks', 'Cloning Webhooks', 84);
            emitLog('info', 'Cloning source webhooks to target channels...', null, 'cloning_webhooks');

            const textChannels = Array.from(targetChannelObjects.entries()).filter(([srcId, tgtCh]) => {
                const src = sourceGuild.channels.cache.get(srcId);
                return src && src.isText() && tgtCh && tgtCh.isText();
            });

            for (const [srcId, targetChannel] of textChannels) {
                checkCancellation();
                const sourceChannel = sourceGuild.channels.cache.get(srcId);
                try {
                    const sourceWebhooks = await executeDiscordOperation({
                        operationName: 'fetch_webhooks',
                        resourceType: 'channel_webhooks',
                        resourceId: srcId,
                        policy: OPERATION_POLICIES.READ,
                        isCancelled,
                        execute: async () => await sourceChannel.fetchWebhooks(),
                        onRetry: makeRetryHandler('cloning_webhooks'),
                        onRateLimit: makeRateLimitHandler('cloning_webhooks')
                    });

                    if (sourceWebhooks && sourceWebhooks.size > 0) {
                        for (const wh of sourceWebhooks.values()) {
                            checkCancellation();
                            try {
                                await executeDiscordOperation({
                                    operationName: 'create_webhook',
                                    resourceType: 'webhook',
                                    resourceId: wh.id,
                                    policy: OPERATION_POLICIES.CREATE,
                                    isCancelled,
                                    execute: async () => {
                                        await targetChannel.createWebhook(wh.name || 'Cloned Webhook', {
                                            avatar: wh.avatarURL() || undefined
                                        });
                                    },
                                    onRetry: makeRetryHandler('cloning_webhooks'),
                                    onRateLimit: makeRateLimitHandler('cloning_webhooks')
                                });
                                emitLog('success', `Cloned webhook ${wh.name} in #${targetChannel.name}`, null, 'cloning_webhooks');
                            } catch (err) {
                                emitLog('warning', `Failed to clone webhook ${wh.name}`, err.message, 'cloning_webhooks');
                            }
                        }
                    }
                } catch (err) {
                    emitLog('warning', `Could not fetch webhooks from #${sourceChannel.name}`, err.message, 'cloning_webhooks');
                }
            }
        }

        // ======================================================================
        // 12. CLONING MESSAGES (OPTIONAL)
        // =====================================================================
        if (options.cloneMessages && options.cloneChannels && targetChannelObjects.size > 0) {
            checkCancellation();
            const limit = options.msgLimit || 15;
            const delay = options.msgDelay || 1000;

            onStage('cloning_messages', `Cloning Message History (Up to ${limit}/channel)`, 88);
            emitLog('info', `Syncing chat logs via webhooks (${limit} msgs/channel, ${delay}ms pacing)...`, null, 'cloning_messages');

            const textChannelsToSync = Array.from(targetChannelObjects.entries()).filter(([srcId, tgtCh]) => {
                const src = sourceGuild.channels.cache.get(srcId);
                return src && src.isText() && tgtCh && tgtCh.isText();
            });

            let syncedChannelsCount = 0;
            const totalTextChannels = textChannelsToSync.length;

            for (const [srcId, targetChannel] of textChannelsToSync) {
                checkCancellation();
                syncedChannelsCount++;
                const sourceChannel = sourceGuild.channels.cache.get(srcId);
                onProgress(
                    88 + Math.round((syncedChannelsCount / Math.max(1, totalTextChannels)) * 6),
                    syncedChannelsCount,
                    totalTextChannels,
                    `Syncing messages in #${targetChannel.name}`
                );

                try {
                    let messages = null;
                    try {
                        messages = await executeDiscordOperation({
                            operationName: 'fetch_messages',
                            resourceType: 'channel_messages',
                            resourceId: srcId,
                            policy: OPERATION_POLICIES.READ,
                            isCancelled,
                            execute: async () => {
                                return await sourceChannel.messages.fetch({ limit });
                            },
                            onRetry: makeRetryHandler('cloning_messages'),
                            onRateLimit: makeRateLimitHandler('cloning_messages')
                        });
                    } catch (fetchErr) {
                        emitLog('warning', `Could not fetch messages from #${sourceChannel.name}`, fetchErr.message, 'cloning_messages');
                        continue;
                    }

                    if (messages && messages.size > 0) {
                        let webhook = null;
                        try {
                            webhook = await executeDiscordOperation({
                                operationName: 'create_webhook',
                                resourceType: 'webhook',
                                resourceId: targetChannel.id,
                                policy: OPERATION_POLICIES.CREATE,
                                isCancelled,
                                execute: async () => {
                                    return await targetChannel.createWebhook('DisclonerSync', {
                                        avatar: client.user.displayAvatarURL ? client.user.displayAvatarURL({ format: 'png' }) : undefined
                                    });
                                },
                                onRetry: makeRetryHandler('cloning_messages'),
                                onRateLimit: makeRateLimitHandler('cloning_messages')
                            });

                            if (webhook) {
                                activeWebhooks.push(webhook);
                            }
                        } catch (whErr) {
                            emitLog('warning', `Could not create webhook in #${targetChannel.name} (Missing Manage Webhooks permission)`, whErr.message, 'cloning_messages');
                            continue;
                        }

                        const msgArray = Array.from(messages.values()).reverse();
                        manifest.messages.planned += msgArray.length;

                        try {
                            for (const msg of msgArray) {
                                checkCancellation();

                                // Prevent duplicate sending
                                if (manifest.messageMap.has(msg.id)) {
                                    manifest.messages.skipped++;
                                    continue;
                                }

                                const hasAttachments = options.cloneAttachments && msg.attachments && msg.attachments.size > 0;
                                const hasEmbeds = msg.embeds && msg.embeds.length > 0;
                                if (msg.content || hasAttachments || hasEmbeds) {
                                    const files = hasAttachments
                                        ? msg.attachments.map(a => a.url).filter(Boolean)
                                        : [];
                                    const rawEmbeds = hasEmbeds
                                        ? msg.embeds.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)).filter(Boolean)
                                        : [];

                                    if (options.cloneAttachments && msg.attachments) {
                                        manifest.attachments.planned += msg.attachments.size;
                                    }

                                    const safeContent = sanitizeMentions(msg.content, options.mentionPolicy);

                                    try {
                                        await executeDiscordOperation({
                                            operationName: 'send_webhook_message',
                                            resourceType: 'message',
                                            resourceId: msg.id,
                                            policy: OPERATION_POLICIES.MESSAGE,
                                            isCancelled,
                                            execute: async () => {
                                                const payload = {
                                                    content: safeContent || (rawEmbeds.length > 0 ? '' : ' '),
                                                    username: msg.author ? msg.author.username.substring(0, 32) : 'User',
                                                    avatarURL: msg.author && msg.author.displayAvatarURL ? msg.author.displayAvatarURL({ dynamic: true }) : undefined,
                                                    files: files.slice(0, 10)
                                                };
                                                if (rawEmbeds.length > 0) {
                                                    payload.embeds = rawEmbeds.slice(0, 10);
                                                }
                                                await webhook.send(payload);
                                            },
                                            onRetry: makeRetryHandler('cloning_messages'),
                                            onRateLimit: makeRateLimitHandler('cloning_messages')
                                        });

                                        manifest.messageMap.set(msg.id, true);
                                        manifest.messages.copied++;
                                        manifest.attachments.copied += files.length;
                                        await cancellableSleep(delay, isCancelled);

                                    } catch (sendErr) {
                                        manifest.messages.failed++;
                                        if (files.length > 0) manifest.attachments.failed += files.length;
                                        emitLog('warning', `Failed to copy message from ${msg.author?.username || 'user'}`, sendErr.message, 'cloning_messages');
                                    }
                                }
                            }
                        } finally {
                            // Deterministic webhook cleanup
                            if (webhook) {
                                try {
                                    await executeDiscordOperation({
                                        operationName: 'delete_webhook',
                                        resourceType: 'webhook',
                                        resourceId: webhook.id,
                                        policy: OPERATION_POLICIES.DELETE,
                                        isCancelled: () => false, // Always complete cleanup
                                        execute: async () => {
                                            await webhook.delete();
                                        }
                                    });
                                } catch {
                                    // ignore webhook deletion error
                                }
                                const whIndex = activeWebhooks.indexOf(webhook);
                                if (whIndex !== -1) activeWebhooks.splice(whIndex, 1);
                            }
                        }
                    }
                } catch (chMsgErr) {
                    emitLog('warning', `Could not sync messages in #${sourceChannel.name}`, chMsgErr.message, 'cloning_messages');
                }
            }
            emitLog('success', `Message migration finished (${manifest.messages.copied} messages copied).`, null, 'cloning_messages');
        }

        // ======================================================================
        // 12. VERIFICATION ENGINE
        // ======================================================================
        checkCancellation();
        onStage('verifying', 'Verifying Target Server State', 95);
        emitLog('info', 'Performing post-migration audit and comparing expected hierarchy...', null, 'verifying');

        const verification = await verifyTargetGuildMigration({
            targetGuild,
            manifest,
            options
        });

        emitLog(
            verification.status === VERIFICATION_STATUSES.VERIFIED ? 'success' : 'warning',
            `Verification complete: ${verification.status}`,
            null,
            'verifying'
        );

        // ======================================================================
        // 13. COMPLETED & REPORT
        // ======================================================================
        onStage('completed', 'Migration Completed', 100);
        onProgress(100, 1, 1, 'Completed');

        const finalReport = manifest.finalize();
        finalReport.sourceServerName = sourceGuild.name;
        finalReport.targetServerName = targetGuild.name;
        finalReport.verification = verification;
        finalReport.cleanup = cleanupReport;
        finalReport.status = verification.status;

        // Legacy compatibility properties
        finalReport.rolesCreated = manifest.roles.created;
        finalReport.categoriesCreated = manifest.categories.created;
        finalReport.channelsCreated = manifest.channels.created;
        finalReport.messagesCopied = manifest.messages.copied;
        finalReport.attachmentsCopied = manifest.attachments.copied;
        finalReport.warningsCount = manifest.warnings.length;

        emitLog('success', `Migration finished in ${(finalReport.durationMs / 1000).toFixed(1)}s with status: ${finalReport.status}`, null, 'completed');
        return finalReport;

    } catch (err) {
        manifest.finalize();
        for (const wh of activeWebhooks) {
            try { await wh.delete(); } catch {}
        }
        throw err;
    } finally {
        destroyClient(client);
        client = null;
    }
}
