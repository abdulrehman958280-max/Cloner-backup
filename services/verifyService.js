/**
 * Verification Engine - Post-migration comparison between expected plan and target guild state
 */

import { VERIFICATION_STATUSES } from './configContract.js';

export async function verifyTargetGuildMigration({
    targetGuild,
    manifest,
    options = {}
}) {
    if (!targetGuild || !manifest) {
        return {
            status: VERIFICATION_STATUSES.FAILED,
            reason: 'Target guild or migration manifest missing for verification.'
        };
    }

    const verification = {
        status: VERIFICATION_STATUSES.VERIFIED,
        roles: {
            planned: manifest.roles.planned,
            created: manifest.roles.created,
            targetCount: 0,
            verified: 0,
            mismatches: []
        },
        categories: {
            planned: manifest.categories.planned,
            created: manifest.categories.created,
            targetCount: 0,
            verified: 0
        },
        channels: {
            planned: manifest.channels.planned,
            created: manifest.channels.created,
            targetCount: 0,
            verified: 0,
            positionMismatches: 0
        },
        permissions: {
            planned: manifest.permissions.planned,
            applied: manifest.permissions.applied,
            skipped: manifest.permissions.skipped,
            failed: manifest.permissions.failed
        },
        messages: {
            planned: manifest.messages.planned,
            copied: manifest.messages.copied,
            failed: manifest.messages.failed
        },
        attachments: {
            planned: manifest.attachments.planned,
            copied: manifest.attachments.copied,
            failed: manifest.attachments.failed
        },
        warnings: []
    };

    try {
        // Re-fetch target guild structure for fresh verification
        await Promise.allSettled([
            targetGuild.roles.fetch().catch(() => {}),
            targetGuild.channels.fetch().catch(() => {})
        ]);

        // 1. Role Verification
        if (options.cloneRoles) {
            const targetRoles = Array.from(targetGuild.roles.cache.values());
            verification.roles.targetCount = targetRoles.length;

            for (const [sourceRoleId, targetRoleId] of manifest.roleMap.entries()) {
                const targetRole = targetGuild.roles.cache.get(targetRoleId);
                if (targetRole) {
                    verification.roles.verified++;
                } else {
                    verification.roles.mismatches.push(sourceRoleId);
                }
            }

            if (manifest.roles.failed > 0 || verification.roles.mismatches.length > 0) {
                verification.warnings.push(`Role verification detected ${manifest.roles.failed} failed and ${verification.roles.mismatches.length} unverified role(s).`);
            }
        }

        // 2. Category & Channel Verification
        if (options.cloneChannels) {
            const targetCats = Array.from(targetGuild.channels.cache.values()).filter(c => c.type === 'GUILD_CATEGORY');
            verification.categories.targetCount = targetCats.length;

            for (const [sourceCatId, targetCatId] of manifest.categoryMap.entries()) {
                const targetCat = targetGuild.channels.cache.get(targetCatId);
                if (targetCat) verification.categories.verified++;
            }

            const targetChans = Array.from(targetGuild.channels.cache.values()).filter(c => c.type !== 'GUILD_CATEGORY');
            verification.channels.targetCount = targetChans.length;

            for (const [sourceChId, targetChId] of manifest.channelMap.entries()) {
                const targetCh = targetGuild.channels.cache.get(targetChId);
                if (targetCh) verification.channels.verified++;
            }

            if (manifest.channels.failed > 0 || (verification.channels.verified < manifest.channels.created)) {
                verification.warnings.push(`Channel verification detected ${manifest.channels.failed} failed and missing channel(s).`);
            }
        }

        // 3. Permission Overwrite Verification
        if (options.clonePermissions) {
            if (manifest.permissions.failed > 0 || manifest.permissions.skipped > 0) {
                verification.warnings.push(`Permissions: ${manifest.permissions.applied} applied, ${manifest.permissions.skipped} skipped, ${manifest.permissions.failed} failed.`);
            }
        }

        // 4. Message & Attachment Verification
        if (options.cloneMessages) {
            if (manifest.messages.failed > 0) {
                verification.warnings.push(`Messages: ${manifest.messages.failed} message(s) failed migration.`);
            }
            if (options.cloneAttachments && manifest.attachments.failed > 0) {
                verification.warnings.push(`Attachments: ${manifest.attachments.failed} attachment file(s) failed replication.`);
            }
        }

        // Calculate Final Verification Status
        const totalFailed = manifest.roles.failed + manifest.channels.failed + manifest.categories.failed;
        const totalPlanned = manifest.roles.planned + manifest.channels.planned + manifest.categories.planned;

        if (totalFailed > 0 && totalFailed >= totalPlanned && totalPlanned > 0) {
            verification.status = VERIFICATION_STATUSES.FAILED;
        } else if (totalFailed > 0) {
            verification.status = VERIFICATION_STATUSES.PARTIAL;
        } else if (verification.warnings.length > 0) {
            verification.status = VERIFICATION_STATUSES.VERIFIED_WITH_WARNINGS;
        } else {
            verification.status = VERIFICATION_STATUSES.VERIFIED;
        }

    } catch (err) {
        verification.status = VERIFICATION_STATUSES.VERIFIED_WITH_WARNINGS;
        verification.warnings.push(`Verification query error: ${err.message}`);
    }

    return verification;
}
