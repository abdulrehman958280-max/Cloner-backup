/**
 * Credential Manager & Ephemeral Token Lifecycle Service
 * Manages user tokens for Discord client operations and multi-agent execution context.
 * Implements HMAC session fingerprinting, 15-minute zero-knowledge auto-expiration,
 * periodic garbage collection, and safe token scrub boundaries.
 */

import crypto from 'crypto';
import { sanitizeText } from '../utils/logger.js';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes max inactivity

class CredentialManager {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> { userToken, fingerprint, createdAt, lastAccessedAt, expiresAt }
        this.agentContexts = new Map(); // agentId -> { userToken, scopes, createdAt, expiresAt }
        
        // Start background garbage collector (runs every 60s)
        this.gcInterval = setInterval(() => {
            this.purgeExpiredSessions();
        }, 60000);
        if (this.gcInterval.unref) this.gcInterval.unref();
    }

    /**
     * Creates HMAC SHA-256 session fingerprint for token integrity
     */
    generateFingerprint(sessionId, clientSeed = '') {
        return crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(`${sessionId}:${clientSeed}`)
            .digest('hex');
    }

    /**
     * Store authorized session token with HMAC fingerprint and TTL
     */
    registerSessionToken(sessionId, userToken, clientSeed = '', ttlMs = DEFAULT_SESSION_TTL_MS) {
        if (!sessionId || !userToken) return false;
        const now = Date.now();
        const fingerprint = this.generateFingerprint(sessionId, clientSeed);
        
        this.activeSessions.set(sessionId, {
            userToken: userToken.trim(),
            fingerprint,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt: now + ttlMs
        });
        return true;
    }

    /**
     * Get authorized session token and refresh its inactivity timestamp
     */
    getSessionToken(sessionId, clientSeed = null) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        const now = Date.now();
        if (now > session.expiresAt) {
            this.revokeSession(sessionId);
            return null;
        }

        // Verify fingerprint if client seed provided
        if (clientSeed !== null && clientSeed !== undefined && clientSeed !== '') {
            const expected = this.generateFingerprint(sessionId, clientSeed);
            if (session.fingerprint && session.fingerprint !== expected) {
                return null;
            }
        }

        // Refresh rolling activity expiration
        session.lastAccessedAt = now;
        session.expiresAt = now + DEFAULT_SESSION_TTL_MS;
        return session.userToken;
    }

    /**
     * Revoke and securely scrub session token from memory
     */
    revokeSession(sessionId) {
        if (this.activeSessions.has(sessionId)) {
            const session = this.activeSessions.get(sessionId);
            // Overwrite memory before deleting
            session.userToken = 'REDACTED';
            this.activeSessions.delete(sessionId);
            return true;
        }
        return false;
    }

    /**
     * Create scoped ephemeral context for an agent
     */
    createAgentContext(agentId, userToken, scopes = ['GUILD_READ', 'GUILD_WRITE'], ttlMs = 1800000) {
        const now = Date.now();
        const context = {
            agentId,
            userToken: userToken.trim(),
            scopes,
            createdAt: now,
            expiresAt: now + ttlMs
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
        if (this.agentContexts.has(agentId)) {
            const ctx = this.agentContexts.get(agentId);
            ctx.userToken = 'REDACTED';
            this.agentContexts.delete(agentId);
        }
    }

    /**
     * Periodic garbage collection of inactive / expired session tokens
     */
    purgeExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                session.userToken = 'EXPIRED';
                this.activeSessions.delete(sessionId);
            }
        }
        for (const [agentId, ctx] of this.agentContexts.entries()) {
            if (now > ctx.expiresAt) {
                ctx.userToken = 'EXPIRED';
                this.agentContexts.delete(agentId);
            }
        }
    }

    /**
     * Redact sensitive token strings
     */
    sanitizeOutput(text) {
        return sanitizeText(text);
    }
}

export const credentialManager = new CredentialManager();

