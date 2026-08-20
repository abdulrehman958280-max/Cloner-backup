/**
 * Clone Intelligence - State Store
 * Centralized in-memory state management for active cloning jobs.
 * Replaces localized map passing between stages.
 */

export class StateStore {
    constructor() {
        this.stores = new Map();
    }

    _initJob(jobId) {
        if (!this.stores.has(jobId)) {
            this.stores.set(jobId, {
                sourceGuildSnapshot: null,
                targetGuildSnapshot: null,
                maps: {
                    roles: {},
                    categories: {},
                    channels: {}
                },
                metadata: {}
            });
        }
        return this.stores.get(jobId);
    }

    setSnapshot(jobId, type, snapshot) {
        const store = this._initJob(jobId);
        if (type === 'source') {
            store.sourceGuildSnapshot = snapshot;
        } else if (type === 'target') {
            store.targetGuildSnapshot = snapshot;
        }
    }

    getSnapshot(jobId, type) {
        const store = this.stores.get(jobId);
        if (!store) return null;
        return type === 'source' ? store.sourceGuildSnapshot : store.targetGuildSnapshot;
    }

    setMapping(jobId, entityType, oldId, newId) {
        const store = this._initJob(jobId);
        if (store.maps[entityType]) {
            store.maps[entityType][oldId] = newId;
        }
    }

    getMapping(jobId, entityType, oldId) {
        const store = this.stores.get(jobId);
        if (!store || !store.maps[entityType]) return undefined;
        return store.maps[entityType][oldId];
    }

    getMappingStore(jobId) {
        const store = this.stores.get(jobId);
        if (!store) return { roles: {}, categories: {}, channels: {} };
        return store.maps;
    }

    setMetadata(jobId, key, value) {
        const store = this._initJob(jobId);
        store.metadata[key] = value;
    }

    getMetadata(jobId, key) {
        const store = this.stores.get(jobId);
        if (!store) return undefined;
        return store.metadata[key];
    }

    clearJob(jobId) {
        this.stores.delete(jobId);
    }
}

export const agentStateStore = new StateStore();
