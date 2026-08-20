/**
 * Clone Intelligence - AI Operation Tools
 * Controlled internal tools enabling AI Copilot to query state, run diagnostics,
 * and execute operational analyses with a multi-model soft-retry mechanism
 * before gracefully falling back to deterministic heuristics.
 */

import { sanitizeAiContext, sanitizeSensitiveText, sanitizeText } from './sanitizer.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';
import { classifyError, getFriendlyErrorMessage } from '../reliability/index.js';
import { fetchUserGuilds } from '../guildService.js';
import { predictMigrationOutcome } from './predictionEngine.js';
import { RecoveryIntelligence } from './recoveryIntelligence.js';
import { runDeepVerification } from './deepVerification.js';
import { SheetOptimizerAgent } from './sheetOptimizerAgent.js';

export class IntelligenceToolsRegistry {
    constructor(jobManager = null, aiModelRouter = null) {
        this.jobManager = jobManager;
        this.aiModelRouter = aiModelRouter;
    }

    setJobManager(jm) {
        this.jobManager = jm;
    }

    setAiModelRouter(router) {
        this.aiModelRouter = router;
    }

    /**
     * Executes an AI-powered operational task with multi-model soft-retry
     * before falling back to deterministic algorithms.
     */
    async executeAiOperationWithSoftRetry({
        taskName,
        taskType = TASK_TYPES.COMPLEX,
        systemPrompt,
        userPrompt,
        jobId = null,
        currentJob = null,
        deterministicFallback,
        jsonMode = false
    }) {
        if (this.aiModelRouter && this.aiModelRouter.isAiAvailable()) {
            try {
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ];

                const aiResult = await this.aiModelRouter.executePrompt(messages, {
                    taskType,
                    jsonMode,
                    jobId,
                    temperature: 0.2,
                    maxTokens: 1024,
                    timeoutMs: 16000
                });

                if (aiResult.success && aiResult.text) {
                    let parsedJson = null;
                    if (jsonMode) {
                        try {
                            parsedJson = JSON.parse(aiResult.text.replace(/```json|```/g, '').trim());
                        } catch (e) {
                            // If JSON parse fails, fall through to text or deterministic
                        }
                    }

                    return {
                        success: true,
                        isAiGenerated: true,
                        taskName,
                        output: parsedJson || aiResult.text,
                        modelUsed: aiResult.modelUsed,
                        modelName: aiResult.modelName || aiResult.modelUsed,
                        latencyMs: aiResult.latencyMs,
                        autoSwitched: aiResult.autoSwitched || false,
                        failoverChain: aiResult.failoverChain || null,
                        taskType
                    };
                }
            } catch (err) {
                console.warn(`[AI Tool: ${taskName}] Soft-retry cascade error, falling back to deterministic mode:`, err.message);
            }
        }

        // Graceful deterministic fallback
        const deterministicOutput = await deterministicFallback();
        return {
            success: true,
            isAiGenerated: false,
            fallbackToDeterministic: true,
            taskName,
            output: deterministicOutput
        };
    }

    /**
     * Executes a tool invocation requested by the AI or user
     * @param {string} toolName Name of the tool
     * @param {Object} args Arguments
     * @param {string} jobId Active migration job ID
     * @returns {Object} Result of tool execution
     */
    async executeTool(toolName, args = {}, jobId = null) {
        const job = jobId && this.jobManager ? this.jobManager.getJob(jobId) : null;

        switch (toolName) {
            case 'getMigrationStatus': {
                if (!job) return { error: 'No active job found' };
                return {
                    status: job.status,
                    stage: job.stage,
                    progress: job.progress,
                    stats: job.statCounters,
                    createdAt: job.createdAt,
                    error: job.error
                };
            }

            case 'getMigrationErrors': {
                if (!job) return { errors: [] };
                return {
                    errors: (job.logs || []).filter(l => l.type === 'error' || l.type === 'warning'),
                    failedCount: job.failedQueue?.getStats()?.totalFailed || 0
                };
            }

            case 'getFailedResources': {
                if (!job || !job.failedQueue) return { failedItems: [], count: 0 };
                return job.failedQueue.getStats();
            }

            case 'getCleanupPlan': {
                if (!job || !job.intelligenceContext?.cleanupPlan) {
                    return { message: 'Cleanup plan not generated for current job' };
                }
                return job.intelligenceContext.cleanupPlan.summary;
            }

            case 'getVerificationReport': {
                if (!job || !job.verificationReport) {
                    return { message: 'Verification not yet executed for this job' };
                }
                return {
                    status: job.verificationReport.status,
                    score: job.verificationReport.score,
                    summary: job.verificationReport.summary,
                    mismatches: job.verificationReport.mismatches
                };
            }

            case 'getRateLimitStatus': {
                if (!job || !job.adaptiveRateLimiter) {
                    return { status: 'OPTIMAL', activeCooldownMs: 0, total429Events: 0 };
                }
                return job.adaptiveRateLimiter.getStats();
            }

            case 'retryFailedResources': {
                if (!job) return { success: false, message: 'No active job found' };
                if (!job.failedQueue || job.failedQueue.getStats().totalFailed === 0) {
                    return { success: true, message: 'No failed resources to retry.' };
                }
                return {
                    success: true,
                    requiresConfirmation: true,
                    message: `Ready to retry ${job.failedQueue.getStats().totalFailed} failed items.`,
                    pendingItems: job.failedQueue.getPendingRetries().map(i => `${i.type}: ${i.name}`)
                };
            }

            case 'scanUserServers': {
                const userToken = args.userToken;
                if (!userToken) {
                    return { success: false, error: 'User token is required to scan servers.' };
                }
                try {
                    const result = await fetchUserGuilds(userToken);
                    return {
                        success: true,
                        guildCount: result.guilds?.length || 0,
                        guilds: result.guilds || []
                    };
                } catch (err) {
                    return { success: false, error: sanitizeText(err.message || 'Failed to scan servers with user token.') };
                }
            }

            // AI Operational Tool 1: Deep Failure Diagnostics with Soft-Retry
            case 'diagnoseMigrationFailure': {
                const logs = job ? (job.logs || []).filter(l => l.type === 'error') : [];
                const failedItems = job?.failedQueue?.getPendingRetries() || [];
                const lastError = job?.error || (logs[logs.length - 1]?.message);

                return this.executeAiOperationWithSoftRetry({
                    taskName: 'diagnoseMigrationFailure',
                    taskType: TASK_TYPES.DEEP_REASONING,
                    jobId,
                    currentJob: job,
                    systemPrompt: 'You are an expert Discord API diagnostics engineer. Analyze the error logs and failed migration items, explain the root causes (e.g. missing permissions, rate limits, hierarchy conflicts), and provide a concise step-by-step resolution list.',
                    userPrompt: `Migration Error Analysis Request:\nLast Error: ${lastError || 'None'}\nFailed Items Count: ${failedItems.length}\nRecent Error Logs:\n${logs.slice(-5).map(l => `[${l.stage}] ${l.message}`).join('\n')}`,
                    deterministicFallback: async () => {
                        const classified = lastError ? classifyError(lastError) : null;
                        const friendly = lastError ? getFriendlyErrorMessage(lastError) : 'No error recorded.';
                        return {
                            rootCause: classified?.reason || 'Unknown issue',
                            category: classified?.category || 'TRANSIENT',
                            isRetryable: classified?.isRetryable ?? true,
                            actionableSteps: [
                                friendly,
                                'Ensure your bot role is positioned above all roles it needs to assign.',
                                'Verify the bot has MANAGE_ROLES, MANAGE_CHANNELS, and ADMINISTRATOR permissions on the target server.',
                                'Click "Retry Failed Only" to re-process failed items with exponential backoff.'
                            ]
                        };
                    }
                });
            }

            // AI Operational Tool 2: Permission Conflict Analysis with Soft-Retry
            case 'analyzePermissionConflicts': {
                const sourceRoles = job?.sourceAnalysis?.roles || [];
                const targetRoles = job?.targetAnalysis?.roles || [];

                return this.executeAiOperationWithSoftRetry({
                    taskName: 'analyzePermissionConflicts',
                    taskType: TASK_TYPES.COMPLEX,
                    jobId,
                    currentJob: job,
                    systemPrompt: 'You are a Discord security specialist. Analyze the source and target server role structures for permission conflicts, hierarchy violations, or administrator privilege risks.',
                    userPrompt: `Source Roles Count: ${sourceRoles.length}\nTarget Roles Count: ${targetRoles.length}\nMissing Permissions: ${JSON.stringify(job?.targetAnalysis?.missingPermissions || [])}`,
                    deterministicFallback: async () => {
                        const missing = job?.targetAnalysis?.missingPermissions || [];
                        return {
                            hasConflicts: missing.length > 0,
                            missingPermissions: missing,
                            advice: missing.length > 0
                                ? `The target bot token is missing critical permissions: ${missing.join(', ')}. Grant these in Server Settings -> Roles.`
                                : 'Role permissions are fully aligned with no detected conflicts.'
                        };
                    }
                });
            }

            // AI Operational Tool 3: Channel Structure Optimization with Soft-Retry
            case 'optimizeChannelStructure': {
                const channels = job?.sourceAnalysis?.rawResources?.channels || [];

                return this.executeAiOperationWithSoftRetry({
                    taskName: 'optimizeChannelStructure',
                    taskType: TASK_TYPES.STRUCTURED_JSON,
                    jobId,
                    currentJob: job,
                    systemPrompt: 'Analyze the channel and category layout of the source Discord server. Suggest optimizations such as grouping uncategorized channels and organizing permission overrides.',
                    userPrompt: `Total Channels: ${channels.length}\nCategories: ${channels.filter(c => c.type === 4 || c.type === 'GUILD_CATEGORY').length}`,
                    deterministicFallback: async () => {
                        const total = channels.length || job?.sourceAnalysis?.totalChannels || 0;
                        return {
                            totalChannels: total,
                            recommendations: [
                                'Ensure all text channels belong to a category for consistent permission inheritance.',
                                'Keep announcement and rules channels at the top of the category hierarchy.',
                                'Prune ephemeral ticket channels before starting synchronization.'
                            ]
                        };
                    }
                });
            }

            // AI Operational Tool 4: Predict Migration Outcome & Time
            case 'predictMigrationDuration': {
                const source = job?.sourceAnalysis;
                const target = job?.targetAnalysis;
                const comp = job?.compatibility;

                if (!source || !target) {
                    return { error: 'Source and target server analysis required to compute predictions.' };
                }

                const prediction = predictMigrationOutcome(source, target, comp || {});
                return {
                    success: true,
                    expectedAccuracy: prediction.expectedAccuracy,
                    accuracyStr: prediction.accuracyPercentageStr,
                    reasonsForDeduction: prediction.reasonsForDeduction || [],
                    estimatedDurationSec: Math.ceil((source.channelsCount || 0) * 1.2 + (source.customRolesCount || 0) * 0.8) + 15
                };
            }

            // AI Operational Tool 5: Generate Recovery Plan
            case 'generateRecoveryPlan': {
                const recovery = new RecoveryIntelligence();
                const failedItems = job?.failedQueue?.getPendingRetries() || [];
                const lastError = job?.error;

                return this.executeAiOperationWithSoftRetry({
                    taskName: 'generateRecoveryPlan',
                    taskType: TASK_TYPES.DEEP_REASONING,
                    jobId,
                    currentJob: job,
                    systemPrompt: 'You are an AI Migration Recovery Engineer. Generate a tailored recovery plan for a stalled or degraded Discord migration.',
                    userPrompt: `Migration Job ID: ${jobId || 'N/A'}\nFailed Items: ${failedItems.length}\nLast Error: ${lastError || 'None'}`,
                    deterministicFallback: async () => {
                        return {
                            recoverySteps: [
                                'Pause current migration pipeline if active.',
                                'Verify bot token retains Administrator and Manage Roles privileges.',
                                `Enqueue ${failedItems.length} failed items into bounded retry queue.`,
                                'Resume migration with exponential backoff and rate-limit pacing.'
                            ],
                            canAutoRecover: failedItems.length > 0
                        };
                    }
                });
            }

            // AI Operational Tool 6: Audit Guild Permissions
            case 'auditGuildPermissions': {
                const target = job?.targetAnalysis || {};
                const missing = target.missingPermissions || [];
                const isOwner = target.isOwner || false;

                return {
                    success: true,
                    isTargetOwner: isOwner,
                    highestRolePosition: target.highestRolePosition || 0,
                    missingPermissions: missing,
                    isFullyConfigured: missing.length === 0,
                    securityWarnings: missing.length > 0 ? [`Missing required grants: ${missing.join(', ')}`] : []
                };
            }

            // AI Operational Tool 7: Verify Deep Fidelity
            case 'verifyDeepFidelity': {
                if (!job || !job.sourceAnalysis || !job.targetGuild) {
                    return { success: false, error: 'Migration job and target guild reference required for deep verification.' };
                }
                const report = runDeepVerification(job.sourceAnalysis, job.targetGuild);
                job.verificationReport = report;
                return {
                    success: true,
                    status: report.status,
                    score: report.score,
                    summary: report.summary,
                    mismatches: report.mismatches || []
                };
            }

            // AI Operational Tool 8: Optimize Google Sheet / History Data
            case 'optimizeSheetData': {
                const sheetAgent = new SheetOptimizerAgent(this.aiModelRouter);
                const result = await sheetAgent.optimizeLocalHistory();
                const audit = await sheetAgent.auditSyncConnection();
                return {
                    success: true,
                    ...result,
                    syncAudit: audit
                };
            }

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    }
}

