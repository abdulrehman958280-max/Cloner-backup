/**
 * Clone Intelligence - Centralized Agent Event Bus
 * Publishes and buffers structured multi-agent lifecycle events, resource creation logs,
 * rate limit states, and verification scores for real-time Socket.IO & SSE synchronization.
 */

import EventEmitter from 'events';

export const AGENT_EVENT_TYPES = {
    AGENT_STARTED: 'AGENT_STARTED',
    AGENT_READY: 'AGENT_READY',
    AUTH_SUCCESS: 'AUTH_SUCCESS',
    AUTH_FAILED: 'AUTH_FAILED',
    PREFLIGHT_STARTED: 'PREFLIGHT_STARTED',
    PREFLIGHT_COMPLETED: 'PREFLIGHT_COMPLETED',
    SCAN_STARTED: 'SCAN_STARTED',
    SCAN_COMPLETED: 'SCAN_COMPLETED',
    PLAN_CREATED: 'PLAN_CREATED',
    CLEANUP_STARTED: 'CLEANUP_STARTED',
    CLEANUP_PROGRESS: 'CLEANUP_PROGRESS',
    CLEANUP_COMPLETED: 'CLEANUP_COMPLETED',
    CLONE_STARTED: 'CLONE_STARTED',
    CLONE_PROGRESS: 'CLONE_PROGRESS',
    RESOURCE_CREATED: 'RESOURCE_CREATED',
    RESOURCE_FAILED: 'RESOURCE_FAILED',
    RESOURCE_SKIPPED: 'RESOURCE_SKIPPED',
    RATE_LIMITED: 'RATE_LIMITED',
    RETRY_STARTED: 'RETRY_STARTED',
    RECOVERY_STARTED: 'RECOVERY_STARTED',
    VERIFICATION_STARTED: 'VERIFICATION_STARTED',
    VERIFICATION_COMPLETED: 'VERIFICATION_COMPLETED',
    AGENT_LOGOUT: 'AGENT_LOGOUT',
    AGENT_COMPLETED: 'AGENT_COMPLETED',
    AGENT_FAILED: 'AGENT_FAILED'
};

export class AgentEventBus extends EventEmitter {
    constructor() {
        super();
        this.eventHistory = new Map(); // jobId -> Array<Event>
        this.MAX_EVENTS_PER_JOB = 1000;
        this.globalListeners = new Set();
    }

    /**
     * Publishes a structured event to the bus and buffers it for job history
     */
    publish(eventPayload) {
        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            jobId: eventPayload.jobId || 'global',
            agentId: eventPayload.agentId || 'system',
            agentType: eventPayload.agentType || 'SYSTEM', // CLEANER, CLONER, TESTER, ASSISTANT
            eventType: eventPayload.eventType || AGENT_EVENT_TYPES.AGENT_STARTED,
            stage: eventPayload.stage || 'EXECUTING',
            resourceType: eventPayload.resourceType || null,
            resourceId: eventPayload.resourceId || null,
            status: eventPayload.status || 'INFO',
            progress: eventPayload.progress ?? null,
            message: eventPayload.message || '',
            errorCode: eventPayload.errorCode || null,
            retryCount: eventPayload.retryCount || 0,
            metadata: eventPayload.metadata || {}
        };

        // Buffer in job history
        if (event.jobId) {
            if (!this.eventHistory.has(event.jobId)) {
                this.eventHistory.set(event.jobId, []);
            }
            const history = this.eventHistory.get(event.jobId);
            if (history.length >= this.MAX_EVENTS_PER_JOB) {
                history.shift();
            }
            history.push(event);
        }

        // Emit specific job event and global event
        this.emit(`job:${event.jobId}`, event);
        this.emit('agent:event', event);

        for (const listener of this.globalListeners) {
            try {
                listener(event);
            } catch {}
        }

        return event;
    }

    /**
     * Subscribe to all global events
     */
    addGlobalListener(listener) {
        if (typeof listener === 'function') {
            this.globalListeners.add(listener);
        }
    }

    /**
     * Unsubscribe global listener
     */
    removeGlobalListener(listener) {
        this.globalListeners.delete(listener);
    }

    /**
     * Get buffered history for a given job
     */
    getJobEventHistory(jobId, agentTypeFilter = null) {
        const history = this.eventHistory.get(jobId) || [];
        if (!agentTypeFilter) return history;
        return history.filter(e => e.agentType === agentTypeFilter);
    }

    /**
     * Clear history for job
     */
    clearJobHistory(jobId) {
        this.eventHistory.delete(jobId);
    }
}

export const agentEventBus = new AgentEventBus();
