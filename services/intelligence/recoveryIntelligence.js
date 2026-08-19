/**
 * Clone Intelligence - Recovery Intelligence & Fallback Manager
 * Provides graceful degradation and fallback mechanisms when Discord features
 * are unavailable on target guilds (e.g., converting Forum to Text, Stage to Voice).
 */

export class RecoveryIntelligence {
    constructor() {
        this.degradedResources = [];
        this.fallbackLog = [];
    }

    /**
     * Attempts to resolve an unsupported resource by applying a safe fallback
     * @param {Object} resource The resource that failed
     * @param {Object} diagnostic Result from errorIntelligence.classifyError
     * @returns {Object|null} Fallback parameters or null if impossible
     */
    determineFallback(resource, diagnostic) {
        if (!diagnostic.allowFallback) return null;

        const typeStr = String(resource.type || '').toUpperCase();

        // 1. Forum Channel Fallback -> Text Channel
        if (typeStr === 'GUILD_FORUM' || typeStr === '15') {
            const fallback = {
                ...resource,
                type: 'GUILD_TEXT',
                topic: `[Migrated Forum Channel] ${resource.topic || ''}`.trim(),
                isDegraded: true,
                originalType: 'GUILD_FORUM'
            };
            this.recordDegraded(resource, fallback, 'Forum channel converted to standard text channel due to Community requirements');
            return fallback;
        }

        // 2. Stage Channel Fallback -> Voice Channel
        if (typeStr === 'GUILD_STAGE_VOICE' || typeStr === '13') {
            const fallback = {
                ...resource,
                type: 'GUILD_VOICE',
                isDegraded: true,
                originalType: 'GUILD_STAGE_VOICE'
            };
            this.recordDegraded(resource, fallback, 'Stage channel converted to standard voice channel');
            return fallback;
        }

        // 3. Announcement / News Channel Fallback -> Text Channel
        if (typeStr === 'GUILD_NEWS' || typeStr === 'GUILD_ANNOUNCEMENT' || typeStr === '5') {
            const fallback = {
                ...resource,
                type: 'GUILD_TEXT',
                isDegraded: true,
                originalType: 'GUILD_NEWS'
            };
            this.recordDegraded(resource, fallback, 'Announcement channel converted to standard text channel');
            return fallback;
        }

        return null;
    }

    recordDegraded(original, fallback, reason) {
        const entry = {
            id: original.id || original.name,
            name: original.name,
            originalType: original.type,
            fallbackType: fallback.type,
            reason,
            timestamp: new Date().toISOString()
        };
        this.degradedResources.push(entry);
        this.fallbackLog.push(entry);
    }

    getDegradedReport() {
        return {
            totalDegraded: this.degradedResources.length,
            degradedList: [...this.degradedResources]
        };
    }

    reset() {
        this.degradedResources = [];
        this.fallbackLog = [];
    }
}
