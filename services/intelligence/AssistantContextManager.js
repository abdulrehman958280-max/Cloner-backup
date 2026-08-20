import { agentEventBus, AGENT_EVENT_TYPES } from './agentEventBus.js';

export class AssistantContextManager {
    constructor() {
        this.activeJobs = new Map();
        this.processedEventIds = new Set();
        this.LIVE_THRESHOLD = 30000; // 30 seconds
        
        this.setupSubscriptions();
    }

    setupSubscriptions() {
        agentEventBus.addGlobalListener(this.handleEvent.bind(this));
    }

    getOrCreateJobState(jobId) {
        if (!jobId) return null;
        if (!this.activeJobs.has(jobId)) {
            this.activeJobs.set(jobId, {
                jobId: jobId,
                status: 'UNKNOWN',
                phase: 'INITIALIZING',
                sourceId: null,
                targetId: null,
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                activeAgent: null,
                activeTask: null,
                progress: 0,
                currentResource: null,
                cleaner: { status: 'WAITING', progress: 0, currentTask: null, currentResource: null, completed: 0, failed: 0, skipped: 0, retries: 0, lastEventAt: null, lastHeartbeat: null },
                cloner: { status: 'WAITING', progress: 0, currentTask: null, currentResource: null, completed: 0, failed: 0, skipped: 0, retries: 0, throughput: 0, lastEventAt: null, lastHeartbeat: null },
                tester: { status: 'WAITING', progress: 0, currentTask: null, currentResource: null, verified: 0, missing: 0, mismatched: 0, lastEventAt: null, lastHeartbeat: null },
                rateLimit: { status: 'HEALTHY', remaining: null, limit: null, resetAt: null, retryAfter: null, latency: null, requestsPerSecond: 0, consecutive429s: 0, lastUpdated: null },
                errors: [],
                warnings: [],
                recentEvents: [],
                verification: { status: 'PENDING', score: null, missing: 0, extra: 0, mismatches: 0 }
            });
        }
        return this.activeJobs.get(jobId);
    }

    handleEvent(event) {
        if (!event || !event.eventId || !event.jobId) return;
        
        // Deduplication
        if (this.processedEventIds.has(event.eventId)) return;
        this.processedEventIds.add(event.eventId);
        
        // Bounded processed set
        if (this.processedEventIds.size > 20000) {
            const iterator = this.processedEventIds.values();
            for (let i=0; i<5000; i++) this.processedEventIds.delete(iterator.next().value);
        }

        const job = this.getOrCreateJobState(event.jobId);
        job.updatedAt = event.timestamp || new Date().toISOString();

        // Base mappings
        if (event.agentType) {
            job.activeAgent = event.agentType;
        }

        // Add to recent events summary
        job.recentEvents.push(event);
        if (job.recentEvents.length > 50) {
            job.recentEvents.shift();
        }

        // REDUCE state based on event
        switch (event.eventType) {
            case AGENT_EVENT_TYPES.CLEANUP_STARTED:
                job.status = 'RUNNING';
                job.phase = 'CLEANUP';
                job.cleaner.status = 'RUNNING';
                job.activeAgent = 'CLEANER';
                break;
            case AGENT_EVENT_TYPES.CLEANUP_PROGRESS:
                job.cleaner.progress = event.progress ?? job.cleaner.progress;
                job.cleaner.currentResource = event.resourceName || event.resourceId;
                job.cleaner.lastEventAt = job.updatedAt;
                break;
            case AGENT_EVENT_TYPES.CLEANUP_COMPLETED:
                job.cleaner.status = 'COMPLETED';
                break;
                
            case 'PLAN_GENERATED':
                job.status = 'AWAITING_APPROVAL';
                job.phase = 'AWAITING_APPROVAL';
                break;

            case AGENT_EVENT_TYPES.CLONE_STARTED:
                job.status = 'RUNNING';
                job.phase = 'CLONING';
                job.cloner.status = 'RUNNING';
                job.activeAgent = 'CLONER';
                break;
            case AGENT_EVENT_TYPES.CLONE_PROGRESS:
                job.cloner.progress = event.progress ?? job.cloner.progress;
                job.progress = event.progress ?? job.progress;
                job.cloner.currentResource = event.resourceName || event.resourceId;
                job.currentResource = event.resourceName || event.resourceId;
                job.cloner.lastEventAt = job.updatedAt;
                break;
            case AGENT_EVENT_TYPES.RESOURCE_CREATED:
                if (event.agentType === 'CLEANER') {
                    job.cleaner.completed++;
                } else {
                    job.cloner.completed++;
                }
                break;
            case AGENT_EVENT_TYPES.RESOURCE_FAILED:
                if (event.agentType === 'CLEANER') {
                    job.cleaner.failed++;
                } else {
                    job.cloner.failed++;
                }
                job.errors.push({ time: job.updatedAt, type: event.resourceType, message: event.message });
                break;
            case AGENT_EVENT_TYPES.RESOURCE_SKIPPED:
                if (event.agentType === 'CLEANER') {
                    job.cleaner.skipped++;
                } else {
                    job.cloner.skipped++;
                }
                break;

            case AGENT_EVENT_TYPES.TESTER_STARTED:
            case AGENT_EVENT_TYPES.VERIFICATION_STARTED:
                job.status = 'RUNNING';
                job.phase = 'TESTING';
                job.tester.status = 'RUNNING';
                job.activeAgent = 'TESTER';
                break;
            case AGENT_EVENT_TYPES.VERIFICATION_COMPLETED:
                job.tester.status = 'COMPLETED';
                job.verification.status = 'COMPLETED';
                if (event.metadata) {
                    job.verification.score = event.metadata.score;
                }
                break;
                
            case AGENT_EVENT_TYPES.RATE_LIMITED:
                job.rateLimit.status = 'RATE_LIMITED';
                job.rateLimit.consecutive429s++;
                job.rateLimit.retryAfter = event.metadata?.retryAfter || event.retryAfter || null;
                job.rateLimit.lastUpdated = job.updatedAt;
                break;
                
            case 'RATE_LIMIT_UPDATE':
            case 'RATE_LIMIT_RECOVERED':
                job.rateLimit.status = 'HEALTHY';
                if (event.metadata) {
                    job.rateLimit.remaining = event.metadata.remaining;
                    job.rateLimit.limit = event.metadata.limit;
                    job.rateLimit.consecutive429s = 0;
                }
                job.rateLimit.lastUpdated = job.updatedAt;
                break;
                
            case 'AGENT_HEARTBEAT':
                const agentKey = (event.agentType || '').toLowerCase();
                if (job[agentKey]) {
                    job[agentKey].lastHeartbeat = job.updatedAt;
                    job[agentKey].status = 'RUNNING';
                }
                break;
                
            case AGENT_EVENT_TYPES.AGENT_FAILED:
                job.status = 'FAILED';
                const fAgentKey = (event.agentType || '').toLowerCase();
                if (job[fAgentKey]) {
                    job[fAgentKey].status = 'FAILED';
                }
                break;
                
            case AGENT_EVENT_TYPES.AGENT_COMPLETED:
            case 'JOB_COMPLETED':
                // Check if all are complete or just one agent
                if (event.eventType === 'JOB_COMPLETED' || !event.agentType) {
                    job.status = 'COMPLETED';
                } else {
                    const cAgentKey = (event.agentType || '').toLowerCase();
                    if (job[cAgentKey]) {
                        job[cAgentKey].status = 'COMPLETED';
                    }
                }
                break;
        }
    }

    checkLiveness(job) {
        if (!job) return 'UNKNOWN';
        const now = new Date().getTime();
        const updated = new Date(job.updatedAt).getTime();
        const diff = now - updated;
        if (diff < this.LIVE_THRESHOLD) return 'LIVE';
        if (diff < this.LIVE_THRESHOLD * 4) return 'STALE';
        return 'UNKNOWN';
    }

    getActiveJobSnapshot(jobId = null) {
        let job = null;
        if (jobId && this.activeJobs.has(jobId)) {
            job = this.activeJobs.get(jobId);
        } else if (this.activeJobs.size === 1) {
            job = this.activeJobs.values().next().value;
        } else if (this.activeJobs.size > 1) {
            // Pick most recently updated job if no ID provided
            let latest = null;
            let latestTime = 0;
            for (const j of this.activeJobs.values()) {
                const t = new Date(j.updatedAt).getTime();
                if (t > latestTime) {
                    latestTime = t;
                    latest = j;
                }
            }
            job = latest;
        }

        if (!job) return null;

        const liveness = this.checkLiveness(job);
        
        // Agent stall check
        ['cleaner', 'cloner', 'tester'].forEach(agent => {
            if (job[agent].status === 'RUNNING' && job[agent].lastHeartbeat) {
                const hbDiff = new Date().getTime() - new Date(job[agent].lastHeartbeat).getTime();
                if (hbDiff > this.LIVE_THRESHOLD) {
                    job[agent].status = 'SUSPECTED_STALL';
                }
            }
        });

        // Filter recent events summary
        const successCount = job.recentEvents.filter(e => e.status === 'SUCCESS' || e.eventType === AGENT_EVENT_TYPES.RESOURCE_CREATED).length;
        const failCount = job.recentEvents.filter(e => e.status === 'ERROR' || e.eventType === AGENT_EVENT_TYPES.RESOURCE_FAILED).length;
        const skipCount = job.recentEvents.filter(e => e.status === 'SKIPPED' || e.eventType === AGENT_EVENT_TYPES.RESOURCE_SKIPPED).length;

        const recentSummary = `Last ${job.recentEvents.length} events: ${successCount} succeeded, ${skipCount} skipped, ${failCount} failed.`;

        return {
            ...job,
            liveness,
            recentSummary
        };
    }

    getAllActiveJobs() {
        const jobs = [];
        for (const job of this.activeJobs.values()) {
            jobs.push({
                jobId: job.jobId,
                status: job.status,
                phase: job.phase,
                progress: job.progress || 0,
                liveness: this.checkLiveness(job)
            });
        }
        return jobs;
    }
}

export const assistantContextManager = new AssistantContextManager();
