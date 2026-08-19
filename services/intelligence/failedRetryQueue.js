/**
 * Clone Intelligence - Failed Resources Retry Queue
 * Tracks uncompleted or failed resources during migration and manages
 * selective "Retry Failed Only" execution runs.
 */

export class FailedRetryQueue {
    constructor() {
        this.failedItems = new Map(); // id -> { type, name, data, error, attempts, timestamp }
    }

    /**
     * Records a failed resource
     * @param {string} id Unique identifier
     * @param {string} type Resource type ('role', 'category', 'channel', 'permission', 'emoji', 'sticker', 'webhook', 'message')
     * @param {string} name Human readable name
     * @param {Object} data Raw creation payload
     * @param {Error|Object} error Error encountered
     */
    addFailed(id, type, name, data, error) {
        const existing = this.failedItems.get(id);
        this.failedItems.set(id, {
            id,
            type,
            name,
            data,
            error: error?.message || String(error),
            attempts: (existing?.attempts || 0) + 1,
            lastAttemptTime: new Date().toISOString()
        });
    }

    /**
     * Removes a resolved item from the queue
     * @param {string} id 
     */
    removeFailed(id) {
        this.failedItems.delete(id);
    }

    /**
     * Gets all queued failed items sorted by dependency priority:
     * roles -> categories -> channels -> permissions -> emojis -> stickers -> webhooks -> messages
     */
    getPendingRetries() {
        const typePriority = {
            role: 1,
            category: 2,
            channel: 3,
            permission: 4,
            emoji: 5,
            sticker: 6,
            webhook: 7,
            message: 8
        };

        return Array.from(this.failedItems.values()).sort((a, b) => {
            const pA = typePriority[a.type] || 99;
            const pB = typePriority[b.type] || 99;
            return pA - pB;
        });
    }

    getStats() {
        const breakdown = {};
        for (const item of this.failedItems.values()) {
            breakdown[item.type] = (breakdown[item.type] || 0) + 1;
        }

        return {
            totalFailed: this.failedItems.size,
            hasPendingRetries: this.failedItems.size > 0,
            breakdown,
            items: Array.from(this.failedItems.values())
        };
    }

    clear() {
        this.failedItems.clear();
    }
}
