/**
 * Migration Manifest & Reliability Telemetry Tracking
 * Maintains in-memory session tracking of created resources, verification state,
 * retry metrics, rate-limit statistics, and failure isolation.
 */

export class MigrationManifest {
    constructor(sourceGuildId, targetGuildId, options = {}) {
        this.migrationId = 'mig_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        this.sourceGuildId = sourceGuildId;
        this.targetGuildId = targetGuildId;
        this.options = options;
        this.startTime = Date.now();
        this.endTime = null;

        // Resource mappings: Source ID -> Target ID
        this.roleMap = new Map();
        this.categoryMap = new Map();
        this.channelMap = new Map();
        this.messageMap = new Map();

        // Created resource IDs on target
        this.createdRoleIds = new Set();
        this.createdCategoryIds = new Set();
        this.createdChannelIds = new Set();

        // Itemized records
        this.roles = { planned: 0, created: 0, skipped: 0, failed: 0, items: [] };
        this.categories = { planned: 0, created: 0, skipped: 0, failed: 0, items: [] };
        this.channels = { planned: 0, created: 0, skipped: 0, failed: 0, items: [] };
        this.permissions = { planned: 0, applied: 0, skipped: 0, failed: 0 };
        this.messages = { planned: 0, copied: 0, skipped: 0, failed: 0, retried: 0, items: [] };
        this.attachments = { planned: 0, copied: 0, skipped: 0, failed: 0 };

        // Reliability Telemetry
        this.telemetry = {
            retryCount: 0,
            rateLimitCount: 0,
            totalRetryDelayMs: 0,
            networkErrorCount: 0,
            timeoutCount: 0,
            permissionErrorCount: 0,
            fatalErrorCount: 0,
            operationsDelayed: 0,
            operationsFailedAfterRetry: 0
        };

        this.warnings = [];
        this.errors = [];
    }

    recordRetry(waitMs = 0) {
        this.telemetry.retryCount++;
        this.telemetry.totalRetryDelayMs += Math.max(0, waitMs);
    }

    recordRateLimit(waitMs = 0) {
        this.telemetry.rateLimitCount++;
        this.telemetry.totalRetryDelayMs += Math.max(0, waitMs);
    }

    recordClassifiedError(err) {
        if (!err) return;
        const code = err.code || err.name;
        if (code === 'NETWORK_ERROR') this.telemetry.networkErrorCount++;
        else if (code === 'TIMEOUT') this.telemetry.timeoutCount++;
        else if (code === 'PERMISSION_DENIED' || code === 'ACCESS_DENIED') this.telemetry.permissionErrorCount++;
        else if (code === 'AUTHENTICATION_ERROR') this.telemetry.fatalErrorCount++;
    }

    recordRole(sourceRole, targetRole, status = 'created', error = null) {
        if (targetRole) {
            this.roleMap.set(sourceRole.id, targetRole.id);
            this.createdRoleIds.add(targetRole.id);
        }
        if (status === 'created') this.roles.created++;
        else if (status === 'skipped') this.roles.skipped++;
        else if (status === 'failed') this.roles.failed++;

        this.roles.items.push({
            sourceId: sourceRole.id,
            sourceName: sourceRole.name,
            targetId: targetRole?.id || null,
            status,
            error: error ? (error.message || String(error)) : null
        });
    }

    recordCategory(sourceCat, targetCat, status = 'created', error = null) {
        if (targetCat) {
            this.categoryMap.set(sourceCat.id, targetCat.id);
            this.createdCategoryIds.add(targetCat.id);
        }
        if (status === 'created') this.categories.created++;
        else if (status === 'skipped') this.categories.skipped++;
        else if (status === 'failed') this.categories.failed++;

        this.categories.items.push({
            sourceId: sourceCat.id,
            sourceName: sourceCat.name,
            targetId: targetCat?.id || null,
            status,
            error: error ? (error.message || String(error)) : null
        });
    }

    recordChannel(sourceCh, targetCh, status = 'created', error = null) {
        if (targetCh) {
            this.channelMap.set(sourceCh.id, targetCh.id);
            this.createdChannelIds.add(targetCh.id);
        }
        if (status === 'created') this.channels.created++;
        else if (status === 'skipped') this.channels.skipped++;
        else if (status === 'failed') this.channels.failed++;

        this.channels.items.push({
            sourceId: sourceCh.id,
            sourceName: sourceCh.name,
            type: sourceCh.type,
            targetId: targetCh?.id || null,
            status,
            error: error ? (error.message || String(error)) : null
        });
    }

    recordPermission(applied = true, detail = null) {
        if (applied) this.permissions.applied++;
        else this.permissions.skipped++;
    }

    recordMessage(copied = true) {
        if (copied) this.messages.copied++;
        else this.messages.skipped++;
    }

    recordAttachment(copied = true) {
        if (copied) this.attachments.copied++;
        else this.attachments.skipped++;
    }

    getSummary() {
        return {
            migrationId: this.migrationId,
            sourceGuildId: this.sourceGuildId,
            targetGuildId: this.targetGuildId,
            rolesCreated: this.roles.created,
            categoriesCreated: this.categories.created,
            channelsCreated: this.channels.created,
            permissionsApplied: this.permissions.applied,
            messagesCopied: this.messages.copied,
            attachmentsCopied: this.attachments.copied,
            warningsCount: this.warnings.length,
            errorsCount: this.errors.length,
            telemetry: { ...this.telemetry }
        };
    }

    addWarning(message, detail = null) {
        this.warnings.push({ message, detail, timestamp: new Date().toISOString() });
    }

    addError(message, code = null, detail = null) {
        this.errors.push({ message, code, detail, timestamp: new Date().toISOString() });
    }

    finalize() {
        this.endTime = Date.now();
        return {
            migrationId: this.migrationId,
            sourceGuildId: this.sourceGuildId,
            targetGuildId: this.targetGuildId,
            durationMs: this.endTime - this.startTime,
            roles: this.roles,
            categories: this.categories,
            channels: this.channels,
            permissions: this.permissions,
            messages: this.messages,
            attachments: this.attachments,
            telemetry: { ...this.telemetry },
            warningsCount: this.warnings.length,
            errorsCount: this.errors.length
        };
    }
}
