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
    globalRateLimiter,
    withTimeout
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
 * Downloads binary image/sticker buffer with safety timeout
 */
async function downloadAssetBuffer(url, timeoutMs = 10000) {
    if (!url || typeof url !== 'string') return null;
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        clearTimeout(t);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch {
        return null;
    }
}

function sanitizeEmojiName(name, fallback = 'emoji') {
    if (!name || typeof name !== 'string') return fallback;
    const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 32);
    if (sanitized.length < 2) {
        return (sanitized + '_custom').substring(0, 32);
    }
    return sanitized;
}

function sanitizeStickerName(name, fallback = 'sticker') {
    if (!name || typeof name !== 'string') return fallback;
    const sanitized = name.trim().substring(0, 30);
    return sanitized.length < 2 ? (sanitized + ' cloned').substring(0, 30) : sanitized;
}

function sanitizeStickerTags(tags, name) {
    if (tags && typeof tags === 'string' && tags.trim().length >= 2) {
        return tags.trim().substring(0, 200);
    }
    if (name && typeof name === 'string' && name.trim().length >= 2) {
        return name.trim().substring(0, 200);
    }
    return 'cloned, emoji';
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
        emitLog('warning', `Retrying ${operation} for ${resourceType || 'item'} (${attempt}/${maxAttempts}) with exponential backoff in ${(waitMs / 1000).toFixed(1)}s...`, null, stage);
    };

    const makeRateLimitHandler = (stage) => ({ operation, resourceType, retryAfterMs }) => {
        manifest.recordRateLimit(retryAfterMs);
        emitLog('warning', `Discord API 429 Rate Limit hit on ${operation}. Backing off for ${(retryAfterMs / 1000).toFixed(1)}s before retry...`, null, stage);
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
        // 6. CLONING SERVER PROFILE / BRANDING & SETTINGS
        // ======================================================================
        if (options.cloneProfile) {
            checkCancellation();
            onStage('cloning_profile', 'Cloning Server Branding & Settings', 34);
            emitLog('info', 'Synchronizing server title, icon, banner, and settings...', null, 'cloning_profile');

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
                    emitLog('success', 'Synchronized server icon asset (high-res dynamic)', null, 'cloning_profile');
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
                    emitLog('warning', 'Could not apply server banner (tier requirement or permission)', err.message, 'cloning_profile');
                }
            }

            const splashUrl = sourceGuild.splashURL ? sourceGuild.splashURL({ size: 4096 }) : null;
            if (splashUrl) {
                try {
                    await executeDiscordOperation({
                        operationName: 'update_server_splash',
                        resourceType: 'guild',
                        resourceId: targetGuild.id,
                        policy: OPERATION_POLICIES.UPDATE,
                        isCancelled,
                        execute: async () => {
                            if (typeof targetGuild.setSplash === 'function') {
                                await targetGuild.setSplash(splashUrl);
                            }
                        },
                        onRetry: makeRetryHandler('cloning_profile'),
                        onRateLimit: makeRateLimitHandler('cloning_profile')
                    });
                    emitLog('success', 'Synchronized invite splash background', null, 'cloning_profile');
                } catch (err) {
                    // Ignore splash error if tier not met
                }
            }

            // Sync server verification and notification levels if supported
            try {
                if (sourceGuild.verificationLevel && typeof targetGuild.setVerificationLevel === 'function') {
                    await targetGuild.setVerificationLevel(sourceGuild.verificationLevel).catch(() => {});
                }
                if (sourceGuild.explicitContentFilter && typeof targetGuild.setExplicitContentFilter === 'function') {
                    await targetGuild.setExplicitContentFilter(sourceGuild.explicitContentFilter).catch(() => {});
                }
                if (sourceGuild.defaultMessageNotifications && typeof targetGuild.setDefaultMessageNotifications === 'function') {
                    await targetGuild.setDefaultMessageNotifications(sourceGuild.defaultMessageNotifications).catch(() => {});
                }
            } catch (settingsErr) {
                // Ignore guild level settings non-fatal errors
            }
        }

        // ======================================================================
        // 6a. CLONING EMOJIS (BEAST RESILIENCE)
        // ======================================================================
        if (options.cloneEmojis) {
            checkCancellation();
            onStage('cloning_emojis', 'Cloning Emojis', 35);
            emitLog('info', 'Scanning and cloning custom emojis (animated & static)...', null, 'cloning_emojis');

            try {
                // Safely fetch source and target emojis
                let sourceEmojis = [];
                try {
                    const fetchedEmojis = await withTimeout(
                        () => sourceGuild.emojis.fetch(),
                        15000,
                        { operationName: 'fetch_source_emojis', isCancelled }
                    );
                    sourceEmojis = Array.from(fetchedEmojis.values());
                } catch (fetchErr) {
                    emitLog('warning', 'Could not refresh source emojis list via API, using cache', fetchErr.message, 'cloning_emojis');
                    sourceEmojis = Array.from(sourceGuild.emojis.cache.values());
                }

                try {
                    await withTimeout(
                        () => targetGuild.emojis.fetch(),
                        15000,
                        { operationName: 'fetch_target_emojis', isCancelled }
                    ).catch(() => {});
                } catch {}

                manifest.emojis.planned = sourceEmojis.length;
                let emojiIdx = 0;
                const totalEmojis = sourceEmojis.length;

                if (totalEmojis === 0) {
                    emitLog('info', 'No custom emojis found on source server.', null, 'cloning_emojis');
                }

                for (const emoji of sourceEmojis) {
                    checkCancellation();
                    emojiIdx++;
                    const cleanName = sanitizeEmojiName(emoji.name);
                    onProgress(35 + Math.round((emojiIdx / Math.max(1, totalEmojis)) * 3), emojiIdx, totalEmojis, `:${cleanName}:`);

                    // Check if already exists on target
                    const existingOnTarget = targetGuild.emojis.cache.find(e => e.name === cleanName || e.name === emoji.name);
                    if (existingOnTarget) {
                        manifest.recordEmoji('skipped');
                        emitLog('info', `Emoji :${cleanName}: already exists on target server (skipped duplicate)`, null, 'cloning_emojis');
                        continue;
                    }

                    const emojiUrl = emoji.url || (emoji.id ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}` : null);
                    if (!emojiUrl) {
                        manifest.recordEmoji('failed');
                        emitLog('warning', `Skipping emoji :${cleanName}: - no valid image URL found`, null, 'cloning_emojis');
                        continue;
                    }

                    // Download image buffer for rock-solid upload reliability
                    const imageBuffer = await downloadAssetBuffer(emojiUrl, 10000);

                    try {
                        await executeDiscordOperation({
                            operationName: 'create_emoji',
                            resourceType: 'emoji',
                            resourceId: cleanName,
                            policy: OPERATION_POLICIES.CREATE,
                            operationTimeoutMs: 15000,
                            isCancelled,
                            checkIdempotency: async () => {
                                return targetGuild.emojis.cache.find(e => e.name === cleanName || e.name === emoji.name);
                            },
                            execute: async () => {
                                // discord.js-selfbot-v13 GuildEmojiManager.prototype.create: (attachment, name, options)
                                return await targetGuild.emojis.create(
                                    imageBuffer || emojiUrl,
                                    cleanName
                                );
                            },
                            onRetry: makeRetryHandler('cloning_emojis'),
                            onRateLimit: makeRateLimitHandler('cloning_emojis')
                        });
                        manifest.recordEmoji('created');
                        emitLog('success', `Cloned emoji :${cleanName}: (${emoji.animated ? 'animated' : 'static'})`, null, 'cloning_emojis');
                    } catch (err) {
                        manifest.recordEmoji('failed');
                        const errMsg = err.message || '';
                        if (errMsg.includes('30016') || errMsg.includes('Maximum number of emojis')) {
                            emitLog('warning', `Server emoji limit reached: cannot upload :${cleanName}:`, errMsg, 'cloning_emojis');
                            break; // Avoid spamming when emoji slots are capped
                        } else if (errMsg.includes('50013') || errMsg.includes('Missing Permissions')) {
                            emitLog('warning', `Missing Manage Emojis and Stickers permission on target server`, errMsg, 'cloning_emojis');
                            break;
                        } else {
                            emitLog('warning', `Failed to clone emoji :${cleanName}:`, errMsg, 'cloning_emojis');
                        }
                    }

                    await cancellableSleep(75, isCancelled);
                }
                emitLog('success', `Finished cloning emojis (${manifest.emojis.created} created, ${manifest.emojis.skipped} skipped, ${manifest.emojis.failed} failed).`, null, 'cloning_emojis');
            } catch (err) {
                emitLog('error', 'Failed during emoji migration stage', err.message, 'cloning_emojis');
            }
        }

        // ======================================================================
        // 6b. CLONING STICKERS
        // ======================================================================
        if (options.cloneStickers) {
            checkCancellation();
            onStage('cloning_stickers', 'Cloning Stickers', 38);
            emitLog('info', 'Scanning and cloning custom stickers...', null, 'cloning_stickers');

            try {
                // Safely fetch source and target stickers
                let sourceStickers = [];
                try {
                    const fetchedStickers = await withTimeout(
                        () => sourceGuild.stickers.fetch(),
                        15000,
                        { operationName: 'fetch_source_stickers', isCancelled }
                    );
                    sourceStickers = Array.from(fetchedStickers.values());
                } catch (fetchErr) {
                    emitLog('warning', 'Could not refresh source stickers list via API, using cache', fetchErr.message, 'cloning_stickers');
                    sourceStickers = Array.from(sourceGuild.stickers.cache.values());
                }

                try {
                    await withTimeout(
                        () => targetGuild.stickers.fetch(),
                        15000,
                        { operationName: 'fetch_target_stickers', isCancelled }
                    ).catch(() => {});
                } catch {}

                manifest.stickers.planned = sourceStickers.length;
                let stickerIdx = 0;
                const totalStickers = sourceStickers.length;

                if (totalStickers === 0) {
                    emitLog('info', 'No custom stickers found on source server.', null, 'cloning_stickers');
                }

                for (const sticker of sourceStickers) {
                    checkCancellation();
                    stickerIdx++;
                    const cleanName = sanitizeStickerName(sticker.name);
                    const cleanTags = sanitizeStickerTags(sticker.tags, sticker.name);
                    onProgress(38 + Math.round((stickerIdx / Math.max(1, totalStickers)) * 4), stickerIdx, totalStickers, cleanName);

                    // Check if already exists on target
                    const existingOnTarget = targetGuild.stickers.cache.find(s => s.name === cleanName || s.name === sticker.name);
                    if (existingOnTarget) {
                        manifest.recordSticker('skipped');
                        emitLog('info', `Sticker "${cleanName}" already exists on target server (skipped duplicate)`, null, 'cloning_stickers');
                        continue;
                    }

                    const stickerUrl = sticker.url || (sticker.id ? `https://media.discordapp.net/stickers/${sticker.id}.png` : null);
                    if (!stickerUrl) {
                        manifest.recordSticker('failed');
                        emitLog('warning', `Skipping sticker "${cleanName}" - no valid file URL found`, null, 'cloning_stickers');
                        continue;
                    }

                    // Download sticker buffer for rock-solid upload reliability
                    const stickerBuffer = await downloadAssetBuffer(stickerUrl, 10000);

                    try {
                        await executeDiscordOperation({
                            operationName: 'create_sticker',
                            resourceType: 'sticker',
                            resourceId: cleanName,
                            policy: OPERATION_POLICIES.CREATE,
                            operationTimeoutMs: 15000,
                            isCancelled,
                            checkIdempotency: async () => {
                                return targetGuild.stickers.cache.find(s => s.name === cleanName || s.name === sticker.name);
                            },
                            execute: async () => {
                                // discord.js-selfbot-v13 GuildStickerManager.prototype.create: (file, name, tags, options)
                                return await targetGuild.stickers.create(
                                    stickerBuffer || stickerUrl,
                                    cleanName,
                                    cleanTags,
                                    { description: sticker.description || '' }
                                );
                            },
                            onRetry: makeRetryHandler('cloning_stickers'),
                            onRateLimit: makeRateLimitHandler('cloning_stickers')
                        });
                        manifest.recordSticker('created');
                        emitLog('success', `Cloned sticker "${cleanName}"`, null, 'cloning_stickers');
                    } catch (err) {
                        manifest.recordSticker('failed');
                        const errMsg = err.message || '';
                        if (errMsg.includes('30039') || errMsg.includes('Maximum number of stickers')) {
                            emitLog('warning', `Server sticker capacity reached: cannot upload "${cleanName}"`, errMsg, 'cloning_stickers');
                            break;
                        } else if (errMsg.includes('50013') || errMsg.includes('Missing Permissions')) {
                            emitLog('warning', `Missing Manage Emojis and Stickers permission on target server`, errMsg, 'cloning_stickers');
                            break;
                        } else if (errMsg.includes('50035') || errMsg.includes('Invalid Form Body') || errMsg.includes('LOTTIE')) {
                            emitLog('warning', `Sticker "${cleanName}" format or tags not supported by server tier`, errMsg, 'cloning_stickers');
                        } else {
                            emitLog('warning', `Failed to clone sticker "${cleanName}"`, errMsg, 'cloning_stickers');
                        }
                    }

                    await cancellableSleep(60, isCancelled);
                }
                emitLog('success', `Finished cloning stickers (${manifest.stickers.created} created, ${manifest.stickers.skipped} skipped, ${manifest.stickers.failed} failed).`, null, 'cloning_stickers');
            } catch (err) {
                emitLog('error', 'Failed during sticker migration stage', err.message, 'cloning_stickers');
            }
        }

        // ======================================================================
        // 7. CLONING ROLES & HIERARCHY
        // ======================================================================
        if (options.cloneRoles) {
            checkCancellation();
            onStage('cloning_roles', 'Cloning Roles & Hierarchy', 42);
            emitLog('info', 'Cloning custom roles, colors, and permissions...', null, 'cloning_roles');

            const continueOnRoleError = options.continueOnRoleError !== false;
            const reuseExistingRoles = options.reuseExistingRoles !== false;
            const roleOperationTimeoutMs = options.roleOperationTimeoutMs || 30000;

            // Fetch source roles safely with timeout
            let sourceRoles = [];
            try {
                const fetchedRoles = await withTimeout(
                    () => sourceGuild.roles.fetch(),
                    15000,
                    { operationName: 'fetch_source_roles', isCancelled }
                );
                sourceRoles = Array.from(fetchedRoles.values())
                    .filter(r => !r.managed)
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            } catch (fetchErr) {
                emitLog('warning', 'Could not refresh source roles, using cache', fetchErr.message, 'cloning_roles');
                sourceRoles = Array.from(sourceGuild.roles.cache.values())
                    .filter(r => !r.managed)
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            }

            // Fetch target roles cache safely
            try {
                await withTimeout(
                    () => targetGuild.roles.fetch(),
                    15000,
                    { operationName: 'fetch_target_roles', isCancelled }
                ).catch(() => {});
            } catch (e) {}

            manifest.roles.planned = sourceRoles.filter(r => r.name !== '@everyone').length;
            const totalRoles = sourceRoles.length;
            let roleIdx = 0;
            const createdRolesForPositioning = [];

            for (const role of sourceRoles) {
                checkCancellation();
                roleIdx++;
                const roleStartTime = Date.now();

                if (role.name === '@everyone') {
                    const targetEveryone = targetGuild.roles.cache.find(r => r.name === '@everyone');
                    if (targetEveryone) {
                        try {
                            await executeDiscordOperation({
                                operationName: 'update_everyone_permissions',
                                resourceType: 'role',
                                resourceId: targetEveryone.id,
                                policy: OPERATION_POLICIES.UPDATE,
                                operationTimeoutMs: Math.min(15000, roleOperationTimeoutMs),
                                isCancelled,
                                execute: async () => {
                                    if (role.permissions) {
                                        await targetEveryone.setPermissions(role.permissions).catch(() => {});
                                    }
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

                let processedRole = null;
                let roleOutcome = 'failed';
                let roleError = null;

                try {
                    // Check if role is already mapped in manifest
                    const existingMappedId = manifest.roleMap.get(role.id);
                    if (existingMappedId) {
                        const existing = targetGuild.roles.cache.get(existingMappedId);
                        if (existing) {
                            processedRole = existing;
                            roleOutcome = 'reused';
                            manifest.recordRole(role, existing, 'reused', null, { durationMs: Date.now() - roleStartTime });
                            createdRolesForPositioning.push({ role: existing, sourcePos: role.position ?? 0 });
                            emitLog('info', `Role @${role.name} already synchronized`, null, 'cloning_roles');
                            continue;
                        }
                    }

                    // Check for existing matching unmanaged role on target to reuse if configured
                    if (reuseExistingRoles) {
                        const match = targetGuild.roles.cache.find(r => 
                            !r.managed && 
                            r.name !== '@everyone' && 
                            r.name.trim().toLowerCase() === (role.name || '').trim().toLowerCase() &&
                            !Array.from(manifest.roleMap.values()).includes(r.id)
                        );
                        if (match) {
                            processedRole = match;
                            roleOutcome = 'reused';
                            manifest.recordRole(role, match, 'reused', null, { durationMs: Date.now() - roleStartTime });
                            createdRolesForPositioning.push({ role: match, sourcePos: role.position ?? 0 });
                            emitLog('success', `Reused existing target role @${role.name}`, null, 'cloning_roles');
                            continue;
                        }
                    }

                    // 1. Primary Attempt: Full role creation with styling and permissions
                    try {
                        processedRole = await executeDiscordOperation({
                            operationName: 'create_role',
                            resourceType: 'role',
                            resourceId: role.id,
                            policy: OPERATION_POLICIES.CREATE,
                            operationTimeoutMs: Math.min(8000, roleOperationTimeoutMs),
                            retryPolicy: { maxAttempts: 1 },
                            isCancelled,
                            checkIdempotency: async () => {
                                const mappedId = manifest.roleMap.get(role.id);
                                if (mappedId) {
                                    return targetGuild.roles.cache.get(mappedId) || null;
                                }
                                return null;
                            },
                            execute: async () => {
                                const roleData = {
                                    name: role.name || 'new-role',
                                    color: role.color || 0,
                                    hoist: Boolean(role.hoist),
                                    mentionable: Boolean(role.mentionable)
                                };

                                if (role.permissions) {
                                    roleData.permissions = role.permissions;
                                }

                                if (role.unicodeEmoji) {
                                    roleData.unicodeEmoji = role.unicodeEmoji;
                                }

                                return await targetGuild.roles.create(roleData);
                            },
                            onRetry: makeRetryHandler('cloning_roles'),
                            onRateLimit: makeRateLimitHandler('cloning_roles')
                        });

                        if (processedRole) {
                            roleOutcome = 'created';
                            manifest.recordRole(role, processedRole, 'created', null, { durationMs: Date.now() - roleStartTime });
                            createdRolesForPositioning.push({ role: processedRole, sourcePos: role.position ?? 0 });
                            emitLog('success', `Created role @${role.name}`, null, 'cloning_roles');
                        }
                    } catch (rCreateErr) {
                        checkCancellation();
                        // 2. Fallback Attempt: If creation failed (e.g. elevated permissions or invalid flags), create with basic parameters
                        try {
                            processedRole = await executeDiscordOperation({
                                operationName: 'create_role_fallback',
                                resourceType: 'role',
                                resourceId: role.id,
                                policy: OPERATION_POLICIES.CREATE,
                                operationTimeoutMs: Math.min(6000, roleOperationTimeoutMs),
                                retryPolicy: { maxAttempts: 1 },
                                isCancelled,
                                execute: async () => {
                                    return await targetGuild.roles.create({
                                        name: role.name || 'new-role',
                                        color: role.color || 0,
                                        hoist: Boolean(role.hoist),
                                        mentionable: Boolean(role.mentionable)
                                    });
                                },
                                onRetry: makeRetryHandler('cloning_roles'),
                                onRateLimit: makeRateLimitHandler('cloning_roles')
                            });

                            if (processedRole) {
                                roleOutcome = 'created';
                                manifest.recordRole(role, processedRole, 'created', null, { durationMs: Date.now() - roleStartTime });
                                createdRolesForPositioning.push({ role: processedRole, sourcePos: role.position ?? 0 });
                                emitLog('warning', `Created role @${role.name} (permissions adapted for target server)`, rCreateErr.message, 'cloning_roles');
                            }
                        } catch (rFallbackErr) {
                            checkCancellation();
                            // 3. Ultra Fallback: create role with name only
                            try {
                                processedRole = await executeDiscordOperation({
                                    operationName: 'create_role_minimal',
                                    resourceType: 'role',
                                    resourceId: role.id,
                                    policy: OPERATION_POLICIES.CREATE,
                                    operationTimeoutMs: Math.min(5000, roleOperationTimeoutMs),
                                    retryPolicy: { maxAttempts: 1 },
                                    isCancelled,
                                    execute: async () => {
                                        return await targetGuild.roles.create({
                                            name: role.name || 'new-role'
                                        });
                                    },
                                    onRetry: makeRetryHandler('cloning_roles'),
                                    onRateLimit: makeRateLimitHandler('cloning_roles')
                                });

                                if (processedRole) {
                                    roleOutcome = 'created';
                                    manifest.recordRole(role, processedRole, 'created', null, { durationMs: Date.now() - roleStartTime });
                                    createdRolesForPositioning.push({ role: processedRole, sourcePos: role.position ?? 0 });
                                    emitLog('warning', `Created role @${role.name} with minimal parameters`, rFallbackErr.message, 'cloning_roles');
                                }
                            } catch (finalRoleErr) {
                                throw finalRoleErr;
                            }
                        }
                    }
                } catch (roleErr) {
                    if (isCancelled()) {
                        throw roleErr;
                    }
                    roleError = roleErr;
                    const isTimeout = roleErr.code === 'TIMEOUT' || (roleErr.message && roleErr.message.includes('timed out'));
                    roleOutcome = isTimeout ? 'timedOut' : 'failed';
                    manifest.recordRole(role, null, roleOutcome, roleErr, { durationMs: Date.now() - roleStartTime });
                    emitLog('warning', `Failed to clone role @${role.name} (${isTimeout ? 'Timed out' : roleErr.message})`, roleErr.message, 'cloning_roles');

                    if (!continueOnRoleError) {
                        throw roleErr;
                    }
                } finally {
                    const currentPct = 42 + Math.round((roleIdx / Math.max(1, totalRoles)) * 10);
                    onProgress(currentPct, roleIdx, totalRoles, `@${role.name}`);
                    await cancellableSleep(60, isCancelled);
                }
            }

            emitLog('success', `Finished cloning roles (${manifest.roles.created} created, ${manifest.roles.reused} reused, ${manifest.roles.failed} failed).`, null, 'cloning_roles');

            // ======================================================================
            // 7b. RESTORING ROLE HIERARCHY (Dedicated Stage)
            // ======================================================================
            checkCancellation();
            onStage('restoring_role_hierarchy', 'Restoring Role Hierarchy Positions', 52);
            emitLog('info', 'Synchronizing role hierarchy positions on target server...', null, 'restoring_role_hierarchy');

            const validRolesForPositioning = createdRolesForPositioning
                .filter(item => item.role && item.role.id && !item.role.managed && item.role.name !== '@everyone');

            if (validRolesForPositioning.length > 1 && typeof targetGuild.roles?.setPositions === 'function') {
                try {
                    const positionPayload = validRolesForPositioning
                        .sort((a, b) => (a.sourcePos ?? 0) - (b.sourcePos ?? 0))
                        .map((item, idx) => ({ role: item.role.id, position: idx + 1 }));

                    await executeDiscordOperation({
                        operationName: 'set_role_positions',
                        resourceType: 'role_positions',
                        resourceId: targetGuild.id,
                        policy: OPERATION_POLICIES.UPDATE,
                        operationTimeoutMs: 15000,
                        isCancelled,
                        execute: async () => {
                            return await targetGuild.roles.setPositions(positionPayload);
                        },
                        onRetry: makeRetryHandler('restoring_role_hierarchy'),
                        onRateLimit: makeRateLimitHandler('restoring_role_hierarchy')
                    });
                    emitLog('success', `Synchronized ${positionPayload.length} role hierarchy positions`, null, 'restoring_role_hierarchy');
                } catch (posErr) {
                    emitLog('warning', 'Role hierarchy adjustment limited by Discord permissions (non-blocking)', posErr.message, 'restoring_role_hierarchy');
                }
            }

            // Refresh target roles cache safely
            try {
                await withTimeout(
                    () => targetGuild.roles?.fetch?.(),
                    10000,
                    { operationName: 'fetch_target_roles_after_sync', isCancelled }
                ).catch(() => {});
            } catch (e) {}

            onProgress(55, totalRoles, totalRoles, 'Role hierarchy complete');
        }

        // ======================================================================
        // 8. CLONING CATEGORIES
        // ======================================================================
        const targetCategoryObjects = new Map(); // sourceId -> targetCategory Discord object
        if (options.cloneChannels) {
            checkCancellation();
            onStage('cloning_categories', 'Building Category Containers', 58);
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
                const currentPct = 58 + Math.round((catIdx / Math.max(1, totalCats)) * 8);
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
                        targetCategoryObjects.set(cat.id, newCat);
                        emitLog('success', `Created category [${cat.name}]`, null, 'cloning_categories');
                    }
                } catch (catErr) {
                    manifest.recordCategory(cat, null, 'failed', catErr);
                    emitLog('warning', `Failed to create category [${cat.name}]`, catErr.message, 'cloning_categories');
                }

                await cancellableSleep(75, isCancelled);
            }
        }

        // ======================================================================
        // 9. CLONING CHANNELS
        // ======================================================================
        const targetChannelObjects = new Map(); // sourceId -> targetChannel Discord object
        if (options.cloneChannels) {
            checkCancellation();
            onStage('cloning_channels', 'Building Channels & Structure', 66);
            emitLog('info', 'Creating text, voice, announcement, stage, and forum channels...', null, 'cloning_channels');

            const sourceChannels = Array.from(sourceGuild.channels.cache.values())
                .filter(c => c.type !== 'GUILD_CATEGORY')
                .sort((a, b) => a.position - b.position);

            manifest.channels.planned = sourceChannels.length;
            const totalChans = sourceChannels.length;
            let chIdx = 0;

            for (const ch of sourceChannels) {
                checkCancellation();
                chIdx++;
                const currentPct = 66 + Math.round((chIdx / Math.max(1, totalChans)) * 14);
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
                        const fallbackType = (ch.type === 'GUILD_VOICE' || ch.type === 'GUILD_STAGE_VOICE') ? 'GUILD_VOICE' : 'GUILD_TEXT';
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

                await cancellableSleep(60, isCancelled);
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
                    } catch (e) {}
                }
                if (sourceGuild.systemChannelId && manifest.channelMap.has(sourceGuild.systemChannelId)) {
                    const mappedSysId = manifest.channelMap.get(sourceGuild.systemChannelId);
                    try {
                        await targetGuild.setSystemChannel(mappedSysId);
                        if (sourceGuild.systemChannelFlags) {
                            await targetGuild.setSystemChannelFlags(sourceGuild.systemChannelFlags);
                        }
                        emitLog('success', 'Mapped System messages channel and notifications', null, 'cloning_channels');
                    } catch (e) {}
                }
            }

            emitLog('success', `Finished building channels (${manifest.channels.created} created, ${manifest.channels.failed} failed).`, null, 'cloning_channels');
        }

        // ======================================================================
        // 10. APPLYING PERMISSION OVERWRITES (CATEGORIES & CHANNELS)
        // ======================================================================
        if (options.clonePermissions && (options.cloneRoles || options.cloneChannels)) {
            checkCancellation();
            onStage('applying_permissions', 'Applying Permission Overwrites', 80);
            emitLog('info', 'Configuring category & channel privacy and role overwrites...', null, 'applying_permissions');

            // 10a. Category Permissions
            for (const [sourceCatId, targetCat] of targetCategoryObjects.entries()) {
                checkCancellation();
                const sourceCat = sourceGuild.channels.cache.get(sourceCatId);
                if (!sourceCat || !sourceCat.permissionOverwrites) continue;

                const catOverwrites = [];
                for (const [id, overwrite] of sourceCat.permissionOverwrites.cache.entries()) {
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
                        catOverwrites.push({
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

                if (catOverwrites.length > 0 && targetCat.permissionOverwrites) {
                    try {
                        await executeDiscordOperation({
                            operationName: 'set_category_permission_overwrites',
                            resourceType: 'category_permissions',
                            resourceId: targetCat.id,
                            policy: OPERATION_POLICIES.UPDATE,
                            isCancelled,
                            execute: async () => {
                                await targetCat.permissionOverwrites.set(catOverwrites);
                            },
                            onRetry: makeRetryHandler('applying_permissions'),
                            onRateLimit: makeRateLimitHandler('applying_permissions')
                        });
                    } catch (permErr) {
                        manifest.permissions.failed++;
                        emitLog('warning', `Failed to apply permissions to category [${targetCat.name}]`, permErr.message, 'applying_permissions');
                    }
                }
            }

            // 10b. Channel Permissions
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
            emitLog('success', `Applied ${manifest.permissions.applied} permission overwrites across categories and channels (${manifest.permissions.skipped} skipped).`, null, 'applying_permissions');
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
                        manifest.webhooks.planned += sourceWebhooks.size;
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
                                manifest.recordWebhook('created');
                                emitLog('success', `Cloned webhook "${wh.name}" in #${targetChannel.name}`, null, 'cloning_webhooks');
                            } catch (err) {
                                manifest.recordWebhook('failed');
                                emitLog('warning', `Failed to clone webhook "${wh.name}"`, err.message, 'cloning_webhooks');
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
        if (options.cloneMessages) {
            checkCancellation();
            const limit = Math.max(1, Math.min(1000, options.msgLimit || 15));
            const rawDelay = (typeof options.msgDelay === 'number') ? options.msgDelay : parseInt(options.msgDelay, 10);
            const delay = (!isNaN(rawDelay) && rawDelay >= 0) ? rawDelay : 250;

            onStage('cloning_messages', `Cloning Message History (Up to ${limit}/channel)`, 88);
            emitLog('info', `Syncing chat logs (${limit} msgs/channel, ${delay}ms pacing)...`, null, 'cloning_messages');

            // Find all matching text channels
            let textChannelsToSync = [];
            if (targetChannelObjects && targetChannelObjects.size > 0) {
                textChannelsToSync = Array.from(targetChannelObjects.entries())
                    .map(([srcId, tgtCh]) => {
                        const src = sourceGuild.channels.cache.get(srcId);
                        return { src, tgt: tgtCh };
                    })
                    .filter(pair => {
                        const isSrcText = pair.src && (typeof pair.src.isText === 'function' ? pair.src.isText() : (pair.src.type === 'GUILD_TEXT' || pair.src.type === 0 || pair.src.type === 'GUILD_NEWS' || pair.src.type === 5));
                        const isTgtText = pair.tgt && (typeof pair.tgt.isText === 'function' ? pair.tgt.isText() : (pair.tgt.type === 'GUILD_TEXT' || pair.tgt.type === 0 || pair.tgt.type === 'GUILD_NEWS' || pair.tgt.type === 5));
                        return isSrcText && isTgtText;
                    });
            }

            // Fallback: match by channel name if targetChannelObjects was empty or incomplete
            if (textChannelsToSync.length === 0) {
                const srcTextChannels = Array.from(sourceGuild.channels.cache.values()).filter(c => 
                    c && (typeof c.isText === 'function' ? c.isText() : (c.type === 'GUILD_TEXT' || c.type === 0 || c.type === 'GUILD_NEWS' || c.type === 5))
                );
                for (const srcCh of srcTextChannels) {
                    const tgtCh = targetGuild.channels.cache.find(c => 
                        c && c.name && c.name.toLowerCase() === srcCh.name.toLowerCase() && 
                        (typeof c.isText === 'function' ? c.isText() : (c.type === 'GUILD_TEXT' || c.type === 0 || c.type === 'GUILD_NEWS' || c.type === 5))
                    );
                    if (tgtCh) {
                        textChannelsToSync.push({ src: srcCh, tgt: tgtCh });
                    }
                }
            }

            let syncedChannelsCount = 0;
            const totalTextChannels = textChannelsToSync.length;

            if (totalTextChannels === 0) {
                emitLog('info', 'No matching text channels available for message cloning.', null, 'cloning_messages');
            }

            for (const { src: sourceChannel, tgt: targetChannel } of textChannelsToSync) {
                checkCancellation();
                syncedChannelsCount++;
                onProgress(
                    88 + Math.round((syncedChannelsCount / Math.max(1, totalTextChannels)) * 6),
                    syncedChannelsCount,
                    totalTextChannels,
                    `Syncing messages in #${targetChannel.name}`
                );

                try {
                    // Fetch messages up to requested limit
                    let allFetched = [];
                    let lastId = null;
                    let remaining = limit;

                    while (remaining > 0) {
                        checkCancellation();
                        const fetchBatchSize = Math.min(100, remaining);
                        const fetchOptions = { limit: fetchBatchSize };
                        if (lastId) fetchOptions.before = lastId;

                        let batch = null;
                        try {
                            batch = await executeDiscordOperation({
                                operationName: 'fetch_messages',
                                resourceType: 'channel_messages',
                                resourceId: sourceChannel.id,
                                policy: OPERATION_POLICIES.READ,
                                isCancelled,
                                execute: async () => {
                                    return await sourceChannel.messages.fetch(fetchOptions);
                                },
                                onRetry: makeRetryHandler('cloning_messages'),
                                onRateLimit: makeRateLimitHandler('cloning_messages')
                            });
                        } catch (fetchErr) {
                            emitLog('warning', `Could not fetch messages from #${sourceChannel.name}`, fetchErr.message, 'cloning_messages');
                            break;
                        }

                        if (!batch || batch.size === 0) break;
                        const batchArr = Array.from(batch.values());
                        allFetched.push(...batchArr);
                        lastId = batchArr[batchArr.length - 1].id;
                        remaining -= batchArr.length;
                        if (batchArr.length < fetchBatchSize) break;
                    }

                    if (allFetched.length > 0) {
                        let webhook = null;
                        let useDirectChannel = false;

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
                            // If webhook creation fails, gracefully fall back to direct channel chat messages
                            useDirectChannel = true;
                            emitLog('info', `Using direct chat synchronization for #${targetChannel.name}`, null, 'cloning_messages');
                        }

                        if (!webhook) {
                            useDirectChannel = true;
                        }

                        const msgArray = allFetched.reverse();
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
                                const authorName = msg.author ? (msg.author.username || 'User').substring(0, 32) : 'User';

                                if (msg.content || hasAttachments || hasEmbeds) {
                                    const files = hasAttachments
                                        ? Array.from(msg.attachments.values()).map(a => a.url).filter(Boolean)
                                        : [];
                                    const rawEmbeds = hasEmbeds
                                        ? msg.embeds.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)).filter(Boolean)
                                        : [];

                                    if (options.cloneAttachments && msg.attachments) {
                                        manifest.attachments.planned += msg.attachments.size;
                                    }

                                    const safeContent = sanitizeMentions(msg.content, options.mentionPolicy);
                                    let sentSuccessfully = false;

                                    // Method 1: Webhook Message Delivery
                                    if (webhook && !useDirectChannel) {
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
                                                        username: authorName,
                                                        avatarURL: msg.author && msg.author.displayAvatarURL ? msg.author.displayAvatarURL({ dynamic: true }) : undefined
                                                    };
                                                    if (files.length > 0) {
                                                        payload.files = files.slice(0, 10);
                                                    }
                                                    if (rawEmbeds.length > 0) {
                                                        payload.embeds = rawEmbeds.slice(0, 10);
                                                    }
                                                    await webhook.send(payload);
                                                },
                                                onRetry: makeRetryHandler('cloning_messages'),
                                                onRateLimit: makeRateLimitHandler('cloning_messages')
                                            });
                                            sentSuccessfully = true;
                                        } catch {
                                            useDirectChannel = true;
                                        }
                                    }

                                    // Method 2: Direct Channel Fallback Delivery
                                    if (!sentSuccessfully) {
                                        try {
                                            await executeDiscordOperation({
                                                operationName: 'send_channel_message',
                                                resourceType: 'message',
                                                resourceId: msg.id,
                                                policy: OPERATION_POLICIES.MESSAGE,
                                                isCancelled,
                                                execute: async () => {
                                                    let directText = `**[${authorName}]**: ${safeContent || ''}`.trim();
                                                    if (!directText && rawEmbeds.length === 0 && files.length === 0) {
                                                        directText = `**[${authorName}]**`;
                                                    }

                                                    const sendPayload = {};
                                                    if (directText) sendPayload.content = directText;
                                                    if (rawEmbeds.length > 0) sendPayload.embeds = rawEmbeds.slice(0, 10);

                                                    if (files.length > 0) {
                                                        try {
                                                            sendPayload.files = files.slice(0, 5);
                                                            await targetChannel.send(sendPayload);
                                                            return;
                                                        } catch {
                                                            directText += '\n' + files.map(f => `📎 ${f}`).join('\n');
                                                            sendPayload.content = directText;
                                                            delete sendPayload.files;
                                                        }
                                                    }

                                                    await targetChannel.send(sendPayload);
                                                },
                                                onRetry: makeRetryHandler('cloning_messages'),
                                                onRateLimit: makeRateLimitHandler('cloning_messages')
                                            });
                                            sentSuccessfully = true;
                                        } catch (directErr) {
                                            manifest.messages.failed++;
                                            if (files.length > 0) manifest.attachments.failed += files.length;
                                            emitLog('warning', `Failed to copy message from ${authorName}`, directErr.message, 'cloning_messages');
                                        }
                                    }

                                    if (sentSuccessfully) {
                                        manifest.messageMap.set(msg.id, true);
                                        manifest.messages.copied++;
                                        manifest.attachments.copied += files.length;
                                        if (delay > 0) {
                                            await cancellableSleep(delay, isCancelled);
                                        }
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
        finalReport.emojisCreated = manifest.emojis.created;
        finalReport.stickersCreated = manifest.stickers.created;
        finalReport.webhooksCreated = manifest.webhooks.created;
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
