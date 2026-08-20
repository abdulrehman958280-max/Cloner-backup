/**
 * Clone Intelligence - BaseAgent Foundation Abstraction
 * Defines canonical agent properties, state transitions, capabilities, and complete
 * lifecycle hooks (start, authenticate, preflight, execute, pause, resume, cancel, recover, verify, logout, shutdown).
 */

import { agentEventBus, AGENT_EVENT_TYPES } from './agentEventBus.js';
import { sanitizeSensitiveText, sanitizeAiContext } from './sanitizer.js';

export const AGENT_STATES = {
    IDLE: 'IDLE',
    INITIALIZING: 'INITIALIZING',
    AUTHENTICATING: 'AUTHENTICATING',
    READY: 'READY',
    PREFLIGHT: 'PREFLIGHT',
    EXECUTING: 'EXECUTING',
    WAITING: 'WAITING',
    RECOVERING: 'RECOVERING',
    VERIFYING: 'VERIFYING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    PAUSED: 'PAUSED',
    CANCELLED: 'CANCELLED',
    LOGGING_OUT: 'LOGGING_OUT',
    OFFLINE: 'OFFLINE'
};

export class BaseAgent {
    constructor(config = {}) {
        this.id = config.id || `agent_${Math.random().toString(36).substr(2, 7)}`;
        this.name = config.name || 'Base Agent';
        this.type = config.type || 'WORKER'; // CLEANER, CLONER, TESTER, ASSISTANT, DIAGNOSTICS
        this.systemPrompt = config.systemPrompt || 'You are an AI migration agent for Discloner Studio.';
        this.modelRouter = config.modelRouter || null;
        
        this.jobId = null;
        this.state = AGENT_STATES.IDLE;
        this.capabilities = config.capabilities || [];
        this.permissions = config.permissions || [];
        
        this.credentials = null; // Ephemeral scoped token
        this.client = null; // Ephemeral discord client
        this.isCancelled = false;
        this.isPaused = false;
        this.metrics = {
            startTime: null,
            endTime: null,
            operationsCount: 0,
            errorCount: 0,
            retryCount: 0
        };
    }

    /**
     * Set agent state and publish lifecycle event
     */
    setState(newState, message = '', metadata = {}) {
        const oldState = this.state;
        this.state = newState;
        
        agentEventBus.publish({
            jobId: this.jobId,
            agentId: this.id,
            agentType: this.type,
            eventType: this.getEventTypeForState(newState),
            stage: newState,
            status: newState === AGENT_STATES.FAILED ? 'ERROR' : (newState === AGENT_STATES.COMPLETED ? 'SUCCESS' : 'INFO'),
            message: message || `Agent ${this.name} state changed from ${oldState} to ${newState}`,
            metadata: { ...metadata, oldState, newState }
        });
    }

    getEventTypeForState(state) {
        switch (state) {
            case AGENT_STATES.INITIALIZING: return AGENT_EVENT_TYPES.AGENT_STARTED;
            case AGENT_STATES.AUTHENTICATING: return AGENT_EVENT_TYPES.AGENT_STARTED;
            case AGENT_STATES.READY: return AGENT_EVENT_TYPES.AGENT_READY;
            case AGENT_STATES.PREFLIGHT: return AGENT_EVENT_TYPES.PREFLIGHT_STARTED;
            case AGENT_STATES.EXECUTING: return AGENT_EVENT_TYPES.CLONE_STARTED;
            case AGENT_STATES.VERIFYING: return AGENT_EVENT_TYPES.VERIFICATION_STARTED;
            case AGENT_STATES.RECOVERING: return AGENT_EVENT_TYPES.RECOVERY_STARTED;
            case AGENT_STATES.COMPLETED: return AGENT_EVENT_TYPES.AGENT_COMPLETED;
            case AGENT_STATES.FAILED: return AGENT_EVENT_TYPES.AGENT_FAILED;
            case AGENT_STATES.LOGGING_OUT: return AGENT_EVENT_TYPES.AGENT_LOGOUT;
            default: return AGENT_EVENT_TYPES.AGENT_STARTED;
        }
    }

    /**
     * Start agent lifecycle for a specific job
     */
    async start(jobId) {
        this.jobId = jobId;
        this.isCancelled = false;
        this.isPaused = false;
        this.metrics.startTime = Date.now();
        this.setState(AGENT_STATES.INITIALIZING, `Agent ${this.name} initialized for job ${jobId}`);
        return true;
    }

    /**
     * Authenticate agent with scoped credentials
     */
    async authenticate(credentials) {
        this.setState(AGENT_STATES.AUTHENTICATING, `Agent ${this.name} authenticating credentials...`);
        this.credentials = credentials;
        // Subclasses override to initialize Discord client or validate scoped token
        this.setState(AGENT_STATES.READY, `Agent ${this.name} authenticated successfully.`);
        return true;
    }

    /**
     * Preflight check prior to execution
     */
    async preflight(context = {}) {
        this.setState(AGENT_STATES.PREFLIGHT, `Agent ${this.name} running preflight verification...`);
        // Subclasses override for domain-specific checks
        return { ok: true, checks: [] };
    }

    /**
     * Primary execution hook
     */
    async execute(task, options = {}) {
        if (this.isCancelled) throw new Error('Agent execution cancelled');
        this.setState(AGENT_STATES.EXECUTING, `Agent ${this.name} executing task...`);
        
        // AI Reasoning call if AI available
        if (this.modelRouter && this.modelRouter.isAiAvailable()) {
            const cleanQuery = sanitizeSensitiveText(typeof task === 'string' ? task : JSON.stringify(task));
            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: `Shared Context:\n${JSON.stringify(sanitizeAiContext(options.sharedState || {}))}\n\nTask:\n${cleanQuery}` }
            ];

            const aiResult = await this.modelRouter.executePrompt(messages, {
                taskType: options.taskType || 'complex',
                temperature: 0.2,
                maxTokens: 1000,
                jobId: this.jobId
            });

            return {
                success: aiResult.success,
                isAiGenerated: true,
                agentId: this.id,
                agentName: this.name,
                agentType: this.type,
                reply: aiResult.text || `${this.name} execution completed.`,
                modelUsed: aiResult.modelUsed,
                latencyMs: aiResult.latencyMs
            };
        }

        return {
            success: true,
            isAiGenerated: false,
            agentId: this.id,
            agentName: this.name,
            agentType: this.type,
            reply: `[${this.name} - Deterministic Engine] Task executed successfully with active safety controls.`
        };
    }

    /**
     * Pause agent execution
     */
    async pause() {
        this.isPaused = true;
        this.setState(AGENT_STATES.PAUSED, `Agent ${this.name} execution paused.`);
        return true;
    }

    /**
     * Resume agent execution
     */
    async resume() {
        this.isPaused = false;
        this.setState(AGENT_STATES.EXECUTING, `Agent ${this.name} execution resumed.`);
        return true;
    }

    /**
     * Cancel agent execution
     */
    async cancel() {
        this.isCancelled = true;
        this.setState(AGENT_STATES.CANCELLED, `Agent ${this.name} execution cancelled.`);
        await this.logout();
        return true;
    }

    /**
     * Handle error recovery
     */
    async recover(error) {
        this.metrics.errorCount++;
        this.setState(AGENT_STATES.RECOVERING, `Agent ${this.name} executing error recovery: ${error.message || error}`);
        // Subclasses implement targeted recovery logic
        return false;
    }

    /**
     * Verify execution outcome
     */
    async verify() {
        this.setState(AGENT_STATES.VERIFYING, `Agent ${this.name} verifying outcomes...`);
        return { verified: true, score: 100 };
    }

    /**
     * Ephemeral credential logout & context wipe
     */
    async logout() {
        this.setState(AGENT_STATES.LOGGING_OUT, `Agent ${this.name} logging out and wiping credential context.`);
        this.credentials = null;
        if (this.client) {
            try {
                if (typeof this.client.destroy === 'function') {
                    this.client.destroy();
                }
            } catch {}
            this.client = null;
        }
        return true;
    }

    /**
     * Final shutdown
     */
    async shutdown() {
        await this.logout();
        this.metrics.endTime = Date.now();
        this.setState(AGENT_STATES.OFFLINE, `Agent ${this.name} shut down.`);
        return true;
    }
}
