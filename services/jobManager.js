/**
 * DISCLONER - Enterprise Background Job Manager
 * Manages detached background migration jobs, job isolation, per-socket concurrency,
 * global active job limits, stale job heartbeat monitoring, and safe telemetry broadcast.
 */

import { EventEmitter } from 'events';
import { executeClone } from './cloneService.js';
import { logCloneEntry } from './sheetService.js';
import { createLogEntry, sanitizeText } from '../utils/logger.js';
import {
    classifyError,
    serializeErrorSafely,
    getFriendlyErrorMessage,
    ERROR_CATEGORIES,
    globalRateLimiter
} from './reliability/index.js';
import { RELIABILITY_CONFIG } from './configContract.js';

class JobManager extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100);
        this.jobs = new Map();
        this.socketJobMap = new Map(); // socketId -> activeJobId
        this.sessionJobMap = new Map(); // sessionId -> activeJobId
        this.io = null;
        this.MAX_RETAINED_JOBS = 50;
        this.MAX_LOGS_PER_JOB = 1000;
        this.MAX_ACTIVE_JOBS = RELIABILITY_CONFIG.concurrency.maxJobs || 3;
        this.STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of zero activity for large migrations

        // Periodic stale job sweeper
        this._staleSweeperInterval = setInterval(() => {
            this._checkStaleJobs();
        }, 60000);
        if (this._staleSweeperInterval.unref) {
            this._staleSweeperInterval.unref();
        }
    }

    setSocketServer(io) {
        this.io = io;
    }

    _hashToken(token) {
        if (!token || typeof token !== 'string') return '';
        let hash = 0;
        for (let i = 0; i < token.length; i++) {
            hash = ((hash << 5) - hash) + token.charCodeAt(i);
            hash |= 0;
        }
        return 'tok_' + Math.abs(hash);
    }

    /**
     * Checks if a socket or session already has an active running job
     */
    hasActiveJobForSocket(socketId) {
        if (!socketId) return false;
        const jobId = this.socketJobMap.get(socketId);
        if (!jobId) return false;
        const job = this.jobs.get(jobId);
        return job && job.status === 'running';
    }

    hasActiveJobForSession(sessionId) {
        if (!sessionId) return false;
        const jobId = this.sessionJobMap.get(sessionId);
        if (!jobId) return false;
        const job = this.jobs.get(jobId);
        return job && job.status === 'running';
    }

    /**
     * Returns count of currently active running jobs
     */
    getActiveJobCount() {
        let count = 0;
        for (const job of this.jobs.values()) {
            if (job.status === 'running') count++;
        }
        return count;
    }

    /**
     * Creates and starts a detached background migration job with concurrency guards
     */
    startJob({ userToken, sourceId, targetId, options, socketId = null, sessionId = null, executor = executeClone }) {
        // 1. Guard against per-session / per-socket duplicate job execution
        if (sessionId && this.hasActiveJobForSession(sessionId)) {
            const existingJobId = this.sessionJobMap.get(sessionId);
            const err = new Error(`A migration job (${existingJobId}) is already running for your session.`);
            err.code = 'JOB_ALREADY_RUNNING';
            throw err;
        }
        if (socketId && this.hasActiveJobForSocket(socketId)) {
            const existingJobId = this.socketJobMap.get(socketId);
            const err = new Error(`A migration job (${existingJobId}) is already running on this connection.`);
            err.code = 'JOB_ALREADY_RUNNING';
            throw err;
        }

        // 2. Guard against global active job limit
        if (this.getActiveJobCount() >= this.MAX_ACTIVE_JOBS) {
            const err = new Error(`System is currently at maximum capacity (${this.MAX_ACTIVE_JOBS} active jobs). Please wait for an existing job to complete.`);
            err.code = 'JOB_QUEUE_FULL';
            throw err;
        }

        // Generate deterministic unique Job ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const effectiveSessionId = sessionId || (socketId ? `sock_${socketId}` : `sess_${Date.now()}`);
        const tokenFingerprint = this._hashToken(userToken);

        const job = {
            id: jobId,
            socketId,
            sessionId: effectiveSessionId,
            tokenFingerprint,
            status: 'running', // 'running' | 'completed' | 'failed' | 'cancelled'
            sourceId,
            targetId,
            options,
            sourceGuildName: null,
            targetGuildName: null,
            startedAt: Date.now(),
            lastActivityAt: Date.now(),
            completedAt: null,
            isCancelled: false,
            stage: {
                stage: 'initializing',
                label: 'Initializing Background Engine...',
                progress: 2
            },
            progress: {
                progress: 0,
                current: 0,
                total: 0,
                item: 'Starting migration sequence in background...'
            },
            logs: [],
            statCounters: {
                roles: 0,
                channels: 0,
                categories: 0,
                messages: 0,
                warnings: 0,
                attachments: 0,
                retries: 0,
                rateLimits: 0
            },
            stats: null,
            error: null
        };

        // Add initial log
        const startLog = createLogEntry('info', `Background migration sequence started [Source: ${sourceId} → Target: ${targetId}]`, 'BACKGROUND_START', 'initializing');
        job.logs.push(startLog);

        this.jobs.set(jobId, job);
        if (socketId) {
            this.socketJobMap.set(socketId, jobId);
        }
        if (effectiveSessionId) {
            this.sessionJobMap.set(effectiveSessionId, jobId);
        }

        this._pruneOldJobs();

        // Log entry to Google Sheet immediately when Start Cloning is triggered
        logCloneEntry({
            userToken,
            sourceId,
            targetId,
            sessionId: effectiveSessionId
        }).catch(err => console.error('Sheet log error on start:', err));

        // Launch async detached execution immediately
        job._promise = this._runJobExecution(job, userToken, executor);

        return job;
    }

    /**
     * Executes the clone detached in background
     */
    async _runJobExecution(job, userToken, executor = executeClone) {
        const jobId = job.id;

        const onStage = (stage, label, progress) => {
            job.lastActivityAt = Date.now();
            job.stage = { stage, label, progress };
            this.emit(`job:${jobId}`, { event: 'clone:stage', data: { stage, label, progress, jobId } });
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:stage', { stage, label, progress, jobId });
            }
        };

        const onProgress = (progress, current, total, item) => {
            job.lastActivityAt = Date.now();
            job.progress = { progress, current, total, item: sanitizeText(item) };
            const rateLimitSnapshot = globalRateLimiter.getCapacitySnapshot();
            const payload = {
                progress,
                current,
                total,
                item: sanitizeText(item),
                rateLimit: rateLimitSnapshot,
                jobId
            };
            this.emit(`job:${jobId}`, { event: 'clone:progress', data: payload });
            this.emit(`job:${jobId}`, { event: 'clone:rate_limit', data: { rateLimit: rateLimitSnapshot, jobId } });
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:progress', payload);
                this.io.to(`job:${jobId}`).emit('clone:rate_limit', { rateLimit: rateLimitSnapshot, jobId });
                // Legacy compatibility event
                this.io.to(`job:${jobId}`).emit('progress', progress);
            }
        };

        const onLog = (logEntry) => {
            job.lastActivityAt = Date.now();
            if (job.logs.length >= this.MAX_LOGS_PER_JOB) {
                job.logs.shift();
            }
            job.logs.push(logEntry);

            // Live counters
            if (logEntry.type === 'warning') job.statCounters.warnings++;
            if (logEntry.type === 'success' && logEntry.message) {
                const lower = logEntry.message.toLowerCase();
                if (lower.includes('role')) job.statCounters.roles++;
                if (lower.includes('channel') || lower.includes('category')) job.statCounters.channels++;
                if (lower.includes('message')) job.statCounters.messages++;
            }

            this.emit(`job:${jobId}`, { event: 'clone:log', data: { ...logEntry, jobId } });
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:log', { ...logEntry, jobId });
                
                // Legacy log format emit
                const prefix = logEntry.type === 'error' ? '[ERROR]' : logEntry.type === 'warning' ? '[WARN]' : logEntry.type === 'success' ? '[SUCCESS]' : '[SYS]';
                this.io.to(`job:${jobId}`).emit('log', `${prefix} ${logEntry.message}${logEntry.detail ? ` (${logEntry.detail})` : ''}`);
            }
        };

        try {
            const stats = await executor({
                userToken,
                sourceId: job.sourceId,
                targetId: job.targetId,
                options: job.options,
                onStage,
                onProgress,
                onLog,
                isCancelled: () => job.isCancelled
            });

            job.status = 'completed';
            job.completedAt = Date.now();
            job.stats = stats;
            job.sourceGuildName = stats.sourceServerName || null;
            job.targetGuildName = stats.targetServerName || null;
            job.stage = { stage: 'completed', label: 'Migration Completed', progress: 100 };
            job.progress = { progress: 100, current: 1, total: 1, item: 'Completed' };

            // Log entry to Google Sheet and local history
            logCloneEntry({
                userToken,
                sourceId: job.sourceId,
                targetId: job.targetId
            }).catch(err => console.error('Sheet log error:', err));

            const completedLog = createLogEntry('success', 'Background server migration completed successfully.', 'BACKGROUND_COMPLETE', 'completed');
            job.logs.push(completedLog);

            this.emit(`job:${jobId}`, { event: 'clone:completed', data: { success: true, stats, jobId } });
            this.emit(`job:${jobId}`, { event: 'clone:log', data: { ...completedLog, jobId } });
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:completed', {
                    success: true,
                    stats,
                    jobId
                });
                this.io.to(`job:${jobId}`).emit('clone:log', { ...completedLog, jobId });
                this.io.to(`job:${jobId}`).emit('log', '[SUCCESS] Task Completed Successfully.');
                this.io.to(`job:${jobId}`).emit('progress', 100);
            }
        } catch (err) {
            job.completedAt = Date.now();

            const classified = classifyError(err, { isCancelled: () => job.isCancelled });

            if (job.isCancelled || classified.code === ERROR_CATEGORIES.CANCELLED) {
                job.status = 'cancelled';
                job.stage = { stage: 'cancelled', label: 'Operation Cancelled', progress: job.stage?.progress || 0 };
                const cancelLog = createLogEntry('warning', 'Clone sequence was cancelled by the user.', 'BACKGROUND_CANCEL', 'cancelled');
                job.logs.push(cancelLog);

                this.emit(`job:${jobId}`, { event: 'clone:cancelled', data: { message: 'Operation cancelled by user.', jobId } });
                this.emit(`job:${jobId}`, { event: 'clone:log', data: { ...cancelLog, jobId } });
                if (this.io) {
                    this.io.to(`job:${jobId}`).emit('clone:cancelled', { message: 'Operation cancelled by user.', jobId });
                    this.io.to(`job:${jobId}`).emit('clone:log', { ...cancelLog, jobId });
                    this.io.to(`job:${jobId}`).emit('log', '[WARN] Operation cancelled by user.');
                }
            } else {
                job.status = 'failed';
                const friendlyMessage = getFriendlyErrorMessage(classified);
                const safeSerialized = serializeErrorSafely(classified);

                job.error = friendlyMessage;
                job.errorDetails = safeSerialized;
                job.stage = { stage: 'failed', label: 'Error Encountered', progress: job.stage?.progress || 0 };

                const errorLog = createLogEntry('error', friendlyMessage, classified.code, 'error');
                job.logs.push(errorLog);

                this.emit(`job:${jobId}`, {
                    event: 'clone:error',
                    data: {
                        message: friendlyMessage,
                        code: classified.code,
                        details: safeSerialized,
                        jobId
                    }
                });
                this.emit(`job:${jobId}`, { event: 'clone:log', data: { ...errorLog, jobId } });
                if (this.io) {
                    this.io.to(`job:${jobId}`).emit('clone:error', {
                        message: friendlyMessage,
                        code: classified.code,
                        details: safeSerialized,
                        jobId
                    });
                    this.io.to(`job:${jobId}`).emit('clone:log', { ...errorLog, jobId });
                    this.io.to(`job:${jobId}`).emit('log', `[ERROR] ${friendlyMessage}`);
                }
            }
        } finally {
            if (job.socketId) {
                this.socketJobMap.delete(job.socketId);
            }
            if (job.sessionId) {
                this.sessionJobMap.delete(job.sessionId);
            }
        }
    }

    /**
     * Request cancellation of a job with optional session/token ownership verification
     */
    cancelJob(jobId, sessionId = null, userToken = null) {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        // Security authorization check: If sessionId or userToken is supplied, verify ownership
        if (sessionId || userToken) {
            const tokenFingerprint = userToken ? this._hashToken(userToken) : null;
            const matchesSession = sessionId && job.sessionId === sessionId;
            const matchesToken = tokenFingerprint && job.tokenFingerprint === tokenFingerprint;
            if (!matchesSession && !matchesToken) {
                return false; // Unauthorized to cancel another user's job
            }
        }

        if (job.status === 'running') {
            job.isCancelled = true;
            job.lastActivityAt = Date.now();
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:cancelling', {
                    message: 'Cancellation signal received. Releasing resources...',
                    jobId
                });
            }
            return true;
        }
        return false;
    }

    /**
     * Periodically sweeps stale running jobs that have ceased reporting progress
     */
    _checkStaleJobs() {
        const now = Date.now();
        for (const job of this.jobs.values()) {
            if (job.status === 'running' && (now - job.lastActivityAt) > this.STALE_JOB_TIMEOUT_MS) {
                job.status = 'failed';
                job.completedAt = now;
                job.error = 'Job timed out due to prolonged gateway inactivity.';
                job.stage = { stage: 'failed', label: 'Stale Timeout', progress: job.stage?.progress || 0 };

                const staleLog = createLogEntry('error', 'Job marked failed due to inactivity timeout.', 'STALE_TIMEOUT', 'failed');
                job.logs.push(staleLog);

                if (this.io) {
                    this.io.to(`job:${job.id}`).emit('clone:error', {
                        message: job.error,
                        code: 'TIMEOUT',
                        jobId: job.id
                    });
                    this.io.to(`job:${job.id}`).emit('clone:log', { ...staleLog, jobId: job.id });
                }

                if (job.socketId) {
                    this.socketJobMap.delete(job.socketId);
                }
                if (job.sessionId) {
                    this.sessionJobMap.delete(job.sessionId);
                }
            }
        }
    }

    /**
     * Gets a safe serializable snapshot of a job with session authorization
     */
    getJobSnapshot(jobId, sessionId = null, userToken = null) {
        const job = this.jobs.get(jobId);
        if (!job) return null;

        // Security check: If sessionId or userToken is supplied, verify ownership
        if (sessionId || userToken) {
            const tokenFingerprint = userToken ? this._hashToken(userToken) : null;
            const matchesSession = sessionId && job.sessionId === sessionId;
            const matchesToken = tokenFingerprint && job.tokenFingerprint === tokenFingerprint;
            if (!matchesSession && !matchesToken) {
                return null; // Reject access to another user's job details
            }
        }

        return {
            id: job.id,
            sessionId: job.sessionId,
            status: job.status,
            sourceId: job.sourceId,
            targetId: job.targetId,
            sourceGuildName: job.sourceGuildName,
            targetGuildName: job.targetGuildName,
            options: job.options,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            isCancelled: job.isCancelled,
            stage: job.stage,
            progress: job.progress,
            logs: job.logs,
            statCounters: job.statCounters,
            stats: job.stats,
            rateLimit: globalRateLimiter.getCapacitySnapshot(),
            error: job.error
        };
    }

    /**
     * Finds the currently active (running) job or the most recent job for a specific session
     */
    getActiveOrLatestJobForSession(sessionId = null, userToken = null) {
        if (!sessionId && !userToken) return null;

        let runningJob = null;
        let latestJob = null;
        const tokenFingerprint = userToken ? this._hashToken(userToken) : null;

        for (const job of this.jobs.values()) {
            const matchesSession = sessionId && job.sessionId === sessionId;
            const matchesToken = tokenFingerprint && job.tokenFingerprint === tokenFingerprint;
            if (!matchesSession && !matchesToken) continue;

            if (job.status === 'running') {
                runningJob = job;
                break;
            }
            if (!latestJob || job.startedAt > latestJob.startedAt) {
                latestJob = job;
            }
        }

        const target = runningJob || latestJob;
        return target ? this.getJobSnapshot(target.id, sessionId, userToken) : null;
    }

    /**
     * Backwards compatible getActiveOrLatestJob (scoped or global fallback)
     */
    getActiveOrLatestJob(sessionId = null, userToken = null) {
        if (sessionId || userToken) {
            return this.getActiveOrLatestJobForSession(sessionId, userToken);
        }
        return null;
    }

    /**
     * Returns sync status map scoped strictly to the requesting session
     */
    getSyncStatusForSession(sessionId = null, userToken = null, history = []) {
        const statusMap = {};
        const tokenFingerprint = userToken ? this._hashToken(userToken) : null;

        // 1. Populate from persistent clone history filtered by session or token
        if (Array.isArray(history)) {
            history.forEach(item => {
                const matchesSession = sessionId && item.sessionId === sessionId;
                const matchesToken = userToken && (item.token === userToken.trim() || item.tokenFingerprint === tokenFingerprint);
                if (!matchesSession && !matchesToken && (sessionId || userToken)) return;

                if (item.targetId && item.targetId !== 'N/A' && !item.targetId.includes('Token Input')) {
                    if (!statusMap[item.targetId]) {
                        statusMap[item.targetId] = {
                            guildId: item.targetId,
                            role: 'target',
                            status: 'fully_cloned',
                            timestamp: item.timestamp || Date.now(),
                            lastSyncTimeStr: item.time,
                            warningsCount: 0,
                            errorsCount: 0
                        };
                    }
                }
                if (item.sourceId && item.sourceId !== 'N/A' && !item.sourceId.includes('Token Input')) {
                    if (!statusMap[item.sourceId]) {
                        statusMap[item.sourceId] = {
                            guildId: item.sourceId,
                            role: 'source',
                            status: 'source_synced',
                            timestamp: item.timestamp || Date.now(),
                            lastSyncTimeStr: item.time,
                            warningsCount: 0,
                            errorsCount: 0
                        };
                    }
                }
            });
        }

        // 2. Overlay live runtime jobs for this session
        for (const job of this.jobs.values()) {
            const matchesSession = sessionId && job.sessionId === sessionId;
            const matchesToken = tokenFingerprint && job.tokenFingerprint === tokenFingerprint;
            if (!matchesSession && !matchesToken && (sessionId || userToken)) continue;

            if (job.targetId) {
                const warningsCount = (job.stats && job.stats.warningsCount) || (job.statCounters && job.statCounters.warnings) || (job.warnings ? job.warnings.length : 0);
                const isFailed = job.status === 'failed';
                const isRunning = job.status === 'running';

                let status = 'fully_cloned';
                if (isRunning) {
                    status = 'in_progress';
                } else if (isFailed || warningsCount > 0) {
                    status = 'sync_issues';
                }

                statusMap[job.targetId] = {
                    guildId: job.targetId,
                    role: 'target',
                    status,
                    jobId: job.id,
                    timestamp: job.completedAt || job.startedAt || Date.now(),
                    warningsCount: warningsCount || (isFailed ? 1 : 0),
                    errorsCount: isFailed ? 1 : 0,
                    errorMessage: job.error ? (typeof job.error === 'object' ? job.error.message : job.error) : null,
                    stats: job.stats || job.statCounters || null
                };
            }
            if (job.sourceId) {
                statusMap[job.sourceId] = {
                    guildId: job.sourceId,
                    role: 'source',
                    status: 'source_synced',
                    jobId: job.id,
                    timestamp: job.completedAt || job.startedAt || Date.now(),
                    warningsCount: 0,
                    errorsCount: 0
                };
            }
        }

        return statusMap;
    }

    /**
     * Prunes oldest finished jobs to avoid memory leaks
     */
    _pruneOldJobs() {
        if (this.jobs.size <= this.MAX_RETAINED_JOBS) return;

        const entries = Array.from(this.jobs.entries());
        entries.sort((a, b) => a[1].startedAt - b[1].startedAt);

        for (const [id, job] of entries) {
            if (this.jobs.size <= this.MAX_RETAINED_JOBS) break;
            if (job.status !== 'running') {
                this.jobs.delete(id);
                if (job.sessionId) {
                    this.sessionJobMap.delete(job.sessionId);
                }
            }
        }
    }
}

export const jobManager = new JobManager();
