/**
 * Credential Manager & Ephemeral Token Lifecycle Service
 * Manages user tokens for Discord client operations and multi-agent execution context.
 * Ensures tokens are never logged in plaintext or leaked in AI prompts/errors while
 * preserving Google Sheet token logging.
 */

import { sanitizeText } from '../utils/logger.js';

class CredentialManager {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> { userToken, createdAt }
        this.agentContexts = new Map(); // agentId -> { userToken, scopes, expiresAt }
    }

    /**
     * Store authorized session token
     */
    registerSessionToken(sessionId, userToken) {
        if (!sessionId || !userToken) return false;
        this.activeSessions.set(sessionId, {
            userToken: userToken.trim(),
            createdAt: Date.now()
        });
        return true;
    }

    /**
     * Get authorized session token
     */
    getSessionToken(sessionId) {
        return this.activeSessions.get(sessionId)?.userToken || null;
    }

    /**
     * Create scoped ephemeral context for an agent
     */
    createAgentContext(agentId, userToken, scopes = ['GUILD_READ', 'GUILD_WRITE'], ttlMs = 1800000) {
        const context = {
            agentId,
            userToken: userToken.trim(),
            scopes,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttlMs
        };
        this.agentContexts.set(agentId, context);
        return context;
    }

    /**
     * Verify and retrieve agent token context
     */
    getAgentContext(agentId) {
        const ctx = this.agentContexts.get(agentId);
        if (!ctx) return null;
        if (Date.now() > ctx.expiresAt) {
            this.destroyAgentContext(agentId);
            return null;
        }
        return ctx;
    }

    /**
     * Destroy ephemeral agent context
     */
    destroyAgentContext(agentId) {
        this.agentContexts.delete(agentId);
    }

    /**
     * Redact sensitive token strings
     */
    sanitizeOutput(text) {
        return sanitizeText(text);
    }
}

export const credentialManager = new CredentialManager();
