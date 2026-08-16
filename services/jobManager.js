/**
 * DISCLONER - Enterprise Background Job Manager
 * Manages detached background migration jobs, job isolation, per-socket concurrency,
 * global active job limits, stale job heartbeat monitoring, and safe telemetry broadcast.
 */

import { executeClone } from './cloneService.js';
import { createLogEntry, sanitizeText } from '../utils/logger.js';
import {
    classifyError,
    serializeErrorSafely,
    getFriendlyErrorMessage,
    ERROR_CATEGORIES
} from './reliability/index.js';
import { RELIABILITY_CONFIG } from './configContract.js';

class JobManager {
    constructor() {
        this.jobs = new Map();
        this.socketJobMap = new Map(); // socketId -> activeJobId
        this.io = null;
        this.MAX_RETAINED_JOBS = 50;
        this.MAX_LOGS_PER_JOB = 1000;
        this.MAX_ACTIVE_JOBS = RELIABILITY_CONFIG.concurrency.maxJobs || 3;
        this.STALE_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of zero activity

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

    /**
     * Checks if a socket or target already has an active running job
     */
    hasActiveJobForSocket(socketId) {
        if (!socketId) return false;
        const jobId = this.socketJobMap.get(socketId);
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
    startJob({ userToken, sourceId, targetId, options, socketId = null, executor = executeClone }) {
        // 1. Guard against per-socket duplicate job execution
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

        const job = {
            id: jobId,
            socketId,
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

        this._pruneOldJobs();

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
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:stage', { stage, label, progress, jobId });
            }
        };

        const onProgress = (progress, current, total, item) => {
            job.lastActivityAt = Date.now();
            job.progress = { progress, current, total, item: sanitizeText(item) };
            if (this.io) {
                this.io.to(`job:${jobId}`).emit('clone:progress', {
                    progress,
                    current,
                    total,
                    item: sanitizeText(item),
                    jobId
                });
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

            const completedLog = createLogEntry('success', 'Background server migration completed successfully.', 'BACKGROUND_COMPLETE', 'completed');
            job.logs.push(completedLog);

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
        }
    }

    /**
     * Request cancellation of a job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return false;
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
            }
        }
    }

    /**
     * Gets a safe serializable snapshot of a job without any secrets
     */
    getJobSnapshot(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return null;

        return {
            id: job.id,
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
            error: job.error
        };
    }

    /**
     * Finds the currently active (running) job or the most recent job
     */
    getActiveOrLatestJob() {
        let runningJob = null;
        let latestJob = null;

        for (const job of this.jobs.values()) {
            if (job.status === 'running') {
                runningJob = job;
                break;
            }
            if (!latestJob || job.startedAt > latestJob.startedAt) {
                latestJob = job;
            }
        }

        const target = runningJob || latestJob;
        return target ? this.getJobSnapshot(target.id) : null;
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
            }
        }
    }
}

export const jobManager = new JobManager();
