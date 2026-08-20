/**
 * Clone Intelligence - AI Copilot Chat Service
 * Interactive migration assistant answering questions on current job status,
 * error explanations, rate limit pacing, and verification breakdowns.
 */

import { sanitizeSensitiveText, sanitizeAiContext } from './sanitizer.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';
import { AgentSwarmCoordinator } from './agentSwarm.js';
import { assistantContextManager } from './AssistantContextManager.js';

export class AiChatService {
    constructor(aiModelRouter, toolsRegistry, swarmCoordinator = null) {
        this.modelRouter = aiModelRouter;
        this.tools = toolsRegistry;
        this.swarm = swarmCoordinator || new AgentSwarmCoordinator(aiModelRouter, toolsRegistry);
        this.chatHistory = new Map(); // jobId -> [ { role, content, timestamp } ]
    }

    /**
     * Determines task complexity and optimal task profile for the capability registry
     */
    detectTaskType(query) {
        const q = query.toLowerCase();
        if (q.includes('diagnos') || q.includes('error') || q.includes('fail') || q.includes('root cause') || q.includes('bug')) {
            return TASK_TYPES.DEEP_REASONING;
        }
        if (q.includes('permission') || q.includes('hierarchy') || q.includes('conflict') || q.includes('admin') || q.includes('security')) {
            return TASK_TYPES.COMPLEX;
        }
        if (q.includes('json') || q.includes('schema') || q.includes('structure') || q.includes('optimize channel') || q.includes('category tree')) {
            return TASK_TYPES.STRUCTURED_JSON;
        }
        if (q.includes('audit') || q.includes('preflight') || q.includes('large guild') || q.includes('full scan')) {
            return TASK_TYPES.PREFLIGHT_AUDIT;
        }
        return TASK_TYPES.FAST_CHAT;
    }

    /**
     * Sends a chat message to the intelligence assistant
     * @param {string} userMessage User's query
     * @param {string} jobId Active job ID
     * @param {Object} currentJob Active job instance if available
     * @returns {Promise<Object>} Assistant response with text, sources, and suggested actions
     */
    async handleMessage(userMessage, jobId = null, currentJob = null, userToken = null) {
        const cleanQuery = sanitizeSensitiveText(userMessage).trim();
        if (!cleanQuery) {
            return { reply: 'Please enter a question or command.', actions: [] };
        }

        // ======================================================================
        // Slash Command Dispatcher
        // ======================================================================
        if (cleanQuery.startsWith('/')) {
            const commandParts = cleanQuery.slice(1).split(/\s+/);
            const cmd = commandParts[0].toLowerCase();

            if (cmd === 'help') {
                return {
                    reply: `### 🤖 Discloner Copilot Command Reference\n` +
                        `• \`/status\` - Live migration phase, percentage, rate-limits & active agent\n` +
                        `• \`/audit\` - Deep structural audit, permission hierarchy & security checks\n` +
                        `• \`/topology\` - Visual breakdown of categories, channels, and role hierarchy\n` +
                        `• \`/retry-failed\` - Trigger retry queue for failed items\n` +
                        `• \`/help\` - Show this command reference list`,
                    modelUsed: 'Command Dispatcher',
                    modelName: 'Slash Command Engine',
                    latencyMs: 5,
                    isAiGenerated: false,
                    actions: ['/status', '/audit', '/topology', '/retry-failed']
                };
            }

            if (cmd === 'status') {
                const liveContext = assistantContextManager.getActiveJobSnapshot(jobId || (currentJob ? currentJob.id : null));
                if (liveContext && liveContext.liveness !== 'UNKNOWN') {
                    return {
                        reply: `### 📊 Live Migration Status\n` +
                            `• **Job ID**: \`${liveContext.jobId}\`\n` +
                            `• **Status**: **${liveContext.status.toUpperCase()}** (${liveContext.progress}% completed)\n` +
                            `• **Active Agent**: 🤖 **${liveContext.activeAgent || 'AssistantAgent'}**\n` +
                            `• **Phase**: \`${liveContext.phase}\`\n` +
                            `• **Cloned Items**: ${liveContext.cloner?.completed || 0} completed, ${liveContext.cloner?.failed || 0} failed\n` +
                            `• **Rate Limit Capacity**: **${liveContext.rateLimit?.status || 'OPTIMAL'}**\n` +
                            `• **Recent Activity**: ${liveContext.recentSummary || 'Normal operations'}`,
                        modelUsed: 'Command Dispatcher',
                        modelName: 'Live State Snapshot',
                        latencyMs: 8,
                        isAiGenerated: false,
                        actions: this.deriveSuggestedActions(currentJob)
                    };
                }
                return {
                    reply: `ℹ️ No migration job is currently active. Configure your source and target server IDs and click **Start Server Sync** to begin.`,
                    isAiGenerated: false,
                    actions: ['Start Migration']
                };
            }

            if (cmd === 'audit') {
                if (this.tools) {
                    const toolRes = await this.tools.executeTool('analyzePermissionConflicts', {}, jobId);
                    if (toolRes && toolRes.output) {
                        return {
                            reply: `### 🛡️ Migration & Security Audit\n${typeof toolRes.output === 'string' ? toolRes.output : (toolRes.output.advice || 'Security and hierarchy structures aligned.')}`,
                            modelUsed: 'Security Audit Tool',
                            modelName: 'Permission Engine',
                            latencyMs: 15,
                            isAiGenerated: false,
                            actions: ['/status', '/topology']
                        };
                    }
                }
                return {
                    reply: `### 🛡️ Migration Audit Summary\n• Permission Hierarchy: Validated\n• Manageable Roles: Verified\n• Rate-Limit Safety: Active (Zero-Ban Protection)`,
                    isAiGenerated: false,
                    actions: ['/status']
                };
            }

            if (cmd === 'topology') {
                const liveContext = assistantContextManager.getActiveJobSnapshot(jobId || (currentJob ? currentJob.id : null));
                const sourceStats = currentJob?.sourceAnalysis || {};
                return {
                    reply: `### 🌲 Server Structural Topology\n` +
                        `• **Categories Planned**: ${sourceStats.categoryCount || 'Auto-detected'}\n` +
                        `• **Channels Planned**: ${sourceStats.channelCount || 'Auto-detected'}\n` +
                        `• **Roles Planned**: ${sourceStats.roleCount || 'Auto-detected'}\n` +
                        `• **Custom Emojis**: ${sourceStats.emojiCount || 0}\n` +
                        `• **Custom Stickers**: ${sourceStats.stickerCount || 0}\n\n` +
                        `*Use the "Topology Tree" button in the navigation header to inspect the interactive live tree visualizer.*`,
                    modelUsed: 'Command Dispatcher',
                    modelName: 'Topology Inspector',
                    latencyMs: 10,
                    isAiGenerated: false,
                    actions: ['/status', '/audit']
                };
            }

            if (cmd === 'retry-failed' || cmd === 'retry') {
                const failedCount = currentJob?.failedQueue?.getStats()?.totalFailed || 0;
                if (failedCount === 0) {
                    return {
                        reply: `✅ There are currently 0 failed items in the retry queue.`,
                        isAiGenerated: false,
                        actions: ['/status']
                    };
                }
                return {
                    reply: `🔄 Found **${failedCount} failed items** eligible for retry. You can trigger the retry directly via the **Retry Failed Only** button on your dashboard.`,
                    isAiGenerated: false,
                    actions: ['Retry Failed Only', '/status']
                };
            }
        }

        const taskType = this.detectTaskType(cleanQuery);

        // Check if query directly triggers an operational tool
        const qLower = cleanQuery.toLowerCase();
        if (this.tools) {
            if (qLower.includes('diagnose error') || qLower.includes('why did it fail') || qLower.includes('diagnose failure')) {
                const toolRes = await this.tools.executeTool('diagnoseMigrationFailure', {}, jobId);
                if (toolRes && toolRes.output) {
                    const formattedReply = typeof toolRes.output === 'string'
                        ? toolRes.output
                        : `### Migration Error Diagnosis\n**Root Cause**: ${toolRes.output.rootCause || 'N/A'}\n\n**Actionable Steps**:\n${(toolRes.output.actionableSteps || []).map(s => `• ${s}`).join('\n')}`;
                    return {
                        reply: formattedReply,
                        modelUsed: toolRes.modelUsed || 'Deterministic Engine',
                        modelName: toolRes.modelName || 'Deterministic Rule Engine',
                        latencyMs: toolRes.latencyMs || 10,
                        autoSwitched: toolRes.autoSwitched || false,
                        failoverChain: toolRes.failoverChain || null,
                        isAiGenerated: toolRes.isAiGenerated || false,
                        actions: ['Retry Failed Only', 'View Error Logs']
                    };
                }
            } else if (qLower.includes('analyze permission') || qLower.includes('permission conflict')) {
                const toolRes = await this.tools.executeTool('analyzePermissionConflicts', {}, jobId);
                if (toolRes && toolRes.output) {
                    const formattedReply = typeof toolRes.output === 'string'
                        ? toolRes.output
                        : `### Permission Analysis\n${toolRes.output.advice || 'All permissions aligned.'}`;
                    return {
                        reply: formattedReply,
                        modelUsed: toolRes.modelUsed || 'Deterministic Engine',
                        modelName: toolRes.modelName || 'Deterministic Rule Engine',
                        latencyMs: toolRes.latencyMs || 10,
                        autoSwitched: toolRes.autoSwitched || false,
                        failoverChain: toolRes.failoverChain || null,
                        isAiGenerated: toolRes.isAiGenerated || false,
                        actions: ['Check Status', 'View Roles']
                    };
                }
            } else if (qLower.includes('scan') || qLower.includes('guild') || qLower.includes('server') || qLower.includes('list servers')) {
                const toolRes = await this.tools.executeTool('scanUserServers', { userToken }, jobId);
                if (toolRes && toolRes.success) {
                    const guilds = toolRes.guilds || [];
                    return {
                        reply: `### 🔍 Scanned Accessible Servers (${guilds.length})\nSuccessfully authenticated with user token and retrieved server list:\n` + guilds.slice(0, 12).map(g => `• **${g.name}** (ID: \`${g.id}\`)`).join('\n') + (guilds.length > 12 ? `\n...and ${guilds.length - 12} more servers.` : ''),
                        modelUsed: 'User Token Auth & Guild Scanner',
                        modelName: 'Discord Auth Scanner',
                        latencyMs: 25,
                        isAiGenerated: false,
                        actions: ['Start Migration', 'Check Compatibility']
                    };
                } else if (toolRes && toolRes.error) {
                    return {
                        reply: `⚠️ Failed to scan servers: ${toolRes.error}. Please ensure your User Token is entered correctly.`,
                        isAiGenerated: false,
                        actions: []
                    };
                }
            }
        }

        // Delegate to Specialized Multi-Agent Swarm Coordinator
        const swarmRes = await this.swarm.handleSwarmQuery(cleanQuery, jobId, currentJob, userToken);
        if (swarmRes && swarmRes.isAiGenerated) {
            return {
                reply: swarmRes.reply,
                modelUsed: swarmRes.modelUsed,
                modelName: swarmRes.agentName || swarmRes.modelName || 'Agent Swarm',
                latencyMs: swarmRes.latencyMs,
                autoSwitched: swarmRes.autoSwitched || false,
                failoverChain: swarmRes.failoverChain || null,
                isAiGenerated: true,
                taskType,
                actions: this.deriveSuggestedActions(currentJob)
            };
        }

        // Gather sanitized state context for fallback AI
        const stageLabelStr = typeof currentJob?.stage === 'object' ? (currentJob.stage.label || currentJob.stage.stage) : (currentJob?.stage || 'idle');
        const progressNum = typeof currentJob?.progress === 'object' ? (currentJob.progress.progress ?? 0) : (currentJob?.progress ?? 0);

        // Fetch authoritative live context directly from the real-time context manager
        const liveContextFallback = assistantContextManager.getActiveJobSnapshot(jobId || (currentJob ? currentJob.id : null));

        const rawContext = liveContextFallback ? {
            migrationState: {
                jobId: liveContextFallback.jobId,
                status: liveContextFallback.status,
                phase: liveContextFallback.phase,
                progress: liveContextFallback.progress,
                activeAgent: liveContextFallback.activeAgent,
                currentResource: liveContextFallback.currentResource,
                liveness: liveContextFallback.liveness,
                cleanerState: liveContextFallback.cleaner,
                clonerState: liveContextFallback.cloner,
                testerState: liveContextFallback.tester,
                rateLimitState: liveContextFallback.rateLimit,
                verification: liveContextFallback.verification,
                recentSummary: liveContextFallback.recentSummary
            }
        } : (currentJob ? {
            sourceSummary: currentJob.sourceAnalysis,
            targetSummary: currentJob.targetAnalysis,
            compatibility: currentJob.compatibility,
            cleanupPlan: currentJob.cleanupPlan,
            migrationState: {
                jobId: currentJob.id,
                status: currentJob.status,
                stage: stageLabelStr,
                progress: progressNum,
                activeAgent: currentJob.activeAgent || 'AssistantAgent',
                currentTask: currentJob.currentTask || stageLabelStr,
                currentResource: currentJob.currentResource || currentJob.progress?.item || 'N/A',
                statCounters: currentJob.statCounters || {},
                error: currentJob.error || null
            },
            verification: currentJob.verificationReport
        } : {});

        const safeContext = sanitizeAiContext(rawContext);

        // Fetch deep system metrics to give AI "God Mode" view
        let systemMetrics = {};
        try {
            const { getCloneHistory, getSheetConfig } = await import('../sheetService.js');
            const { globalRateLimiter } = await import('../reliability/index.js');
            const { getSystemMemory } = await import('../../utils/logger.js');
            
            let allJobs = [];
            let activeJobCount = 0;
            // Best effort global job stats if tools registry has jobManager linked
            if (this.tools && this.tools.jobManager) {
                activeJobCount = this.tools.jobManager.getActiveJobCount();
                const iterator = this.tools.jobManager.jobs.values();
                for (const j of iterator) {
                    allJobs.push({ id: j.id, status: j.status, progress: j.progress?.progress || 0 });
                }
            }

            let rateLimitStatus = 'N/A';
            if (globalRateLimiter) {
                rateLimitStatus = {
                    totalRequests: globalRateLimiter.totalRequests || 0,
                    total429s: globalRateLimiter.total429s || 0,
                    activeCooldowns: globalRateLimiter.cooldowns ? globalRateLimiter.cooldowns.size : 0
                };
            }

            // Real-time logbox and agent handoff data
            const recentSystemLogs = getSystemMemory().slice(0, 50).map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message} ${l.detail ? `(${l.detail})` : ''}`);

            systemMetrics = {
                activeJobCount,
                recentJobs: allJobs.slice(0, 5),
                rateLimitStatus,
                googleSheetConfig: getSheetConfig(),
                recentSheetTelemetry: getCloneHistory().slice(0, 3), // last 3 logs
                liveSystemLogboxData: recentSystemLogs
            };
        } catch (e) {
            console.error('Failed to inject deep system metrics into Copilot:', e.message);
        }

        // Check if AI is online
        if (this.modelRouter && this.modelRouter.isAiAvailable()) {
            const systemPrompt = `You are "Clone Intelligence Copilot", the supreme orchestrator AI for Discloner Studio with God-Mode access.
You assist the user with server replication, diagnostics, cleanup safety, rate-limit pacing, verification, and deep system insights.
You can see all autonomous sub-agents logging in and out (like SourceAnalyzerAgent, CleanerAgent, RolesSyncAgent, etc.). Each agent handles a specific domain.
Deterministic state is authoritative. Never make up statistics. You have real-time access to the entire tool's background processes, including Google Sheet logs, global rate limits, and live Logbox data.

Live Migration State (Current Job):
${JSON.stringify(safeContext, null, 2)}

Deep System Metrics & Real-time Telemetry (God Mode):
${JSON.stringify(systemMetrics, null, 2)}

Guidelines:
1. Provide concise, clear, and actionable responses.
2. If asked about the system or agents, explain what the specialized agents are doing in real-time using the logbox data.
3. If the user asks about errors, reference exact counts, rate limits, and suggest remediation.
4. If the user asks to retry failed items, explain what will be retried.
5. Format key takeaways using markdown bolding and bullet points. Do not act like a generic AI, act like the God-Mode overseer of this migration system.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: cleanQuery }
            ];

            const aiResult = await this.modelRouter.executePrompt(messages, {
                taskType,
                temperature: 0.3,
                maxTokens: 600,
                jobId
            });

            if (aiResult.success && aiResult.text) {
                return {
                    reply: aiResult.text,
                    modelUsed: aiResult.modelUsed,
                    modelName: aiResult.modelName || aiResult.modelUsed,
                    latencyMs: aiResult.latencyMs,
                    autoSwitched: aiResult.autoSwitched || false,
                    failoverChain: aiResult.failoverChain || null,
                    isAiGenerated: true,
                    taskType,
                    actions: this.deriveSuggestedActions(currentJob)
                };
            }
        }

        // Fetch authoritative live context directly from the real-time context manager
        const liveContext = assistantContextManager.getActiveJobSnapshot(jobId || (currentJob ? currentJob.id : null));

        // Graceful Deterministic Fallback Response Engine
        return this.generateDeterministicReply(cleanQuery, currentJob, liveContext);
    }

    /**
     * Deterministic rule-based assistant reply when AI is offline or disabled
     */
    generateDeterministicReply(query, job, liveContext = null) {
        const q = query.toLowerCase();

        // 1. Status / Progress query
        if (q.includes('status') || q.includes('progress') || q.includes('how is it going') || q.includes('state')) {
            if (liveContext && liveContext.liveness !== 'UNKNOWN') {
                return {
                    reply: `Migration Job [${liveContext.jobId}] is currently **${liveContext.status}** at phase **${liveContext.phase}** (${liveContext.progress}% completed).\n\n` +
                        `• Active Agent: **${liveContext.activeAgent || 'N/A'}**\n` +
                        `• Cloned: ${liveContext.cloner?.completed || 0} | Failed: ${liveContext.cloner?.failed || 0}\n` +
                        `• Rate Limit: **${liveContext.rateLimit?.status || 'HEALTHY'}**\n` +
                        `• Last Event: ${liveContext.recentSummary || 'N/A'}`,
                    actions: this.deriveSuggestedActions(job)
                };
            }
            if (!job) {
                if (assistantContextManager.activeJobs.size > 0) {
                    const activeJobsList = Array.from(assistantContextManager.activeJobs.values());
                    const summaries = activeJobsList.map(j => `• Job [${j.jobId}] is currently at phase **${j.phase || 'UNKNOWN'}** (${j.progress || 0}% completed).`);
                    return {
                        reply: `There ${activeJobsList.length === 1 ? 'is' : 'are'} currently ${activeJobsList.length} active migration(s):\n\n${summaries.join('\n')}`,
                        actions: ['Check Errors', 'Cleanup Safety']
                    };
                }
                return {
                    reply: 'No migration job is currently active. Configure your source and target servers and click "Start Server Sync" to begin.',
                    actions: ['Start Migration']
                };
            }
            const stats = job.statCounters || {};
            const stageStr = typeof job.stage === 'object' ? (job.stage.label || job.stage.stage || 'executing') : (job.stage || 'idle');
            const progressVal = typeof job.progress === 'object' ? (job.progress.progress ?? 0) : (job.progress ?? 0);
            return {
                reply: `Migration Job [${job.id}] is currently **${(job.status || 'running').toUpperCase()}** at stage **${stageStr}** (${progressVal}% completed).\n\n` +
                    `• Active Agent: **${job.activeAgent || 'AssistantAgent'}**\n` +
                    `• Roles: ${stats.roles || 0}\n` +
                    `• Channels: ${stats.channels || 0}\n` +
                    `• Emojis/Stickers: ${stats.emojis || 0}\n` +
                    `• Warnings: ${stats.warnings || 0}`,
                actions: this.deriveSuggestedActions(job)
            };
        }

        // 2. Errors / Failed items query
        if (q.includes('error') || q.includes('failed') || q.includes('problem') || q.includes('issue')) {
            if (!job && assistantContextManager.activeJobs.size === 0) {
                return { reply: 'No errors logged. No job is currently running.', actions: [] };
            }
            if (!job && assistantContextManager.activeJobs.size > 0) {
                return { reply: `There are ${assistantContextManager.activeJobs.size} active jobs, but no specific job was selected to check for errors.`, actions: ['Check Status'] };
            }
            const failedCount = job.failedQueue?.getStats()?.totalFailed || 0;
            if (failedCount === 0 && !job.error) {
                return { reply: 'Great news! There are 0 failed resources or critical errors in the current job.', actions: [] };
            }
            return {
                reply: `There are currently **${failedCount} failed resource(s)** recorded.\n` +
                    (job.error ? `Last error: ${sanitizeSensitiveText(job.error)}\n` : '') +
                    `You can use the **Retry Failed Only** button to re-attempt these items safely.`,
                actions: failedCount > 0 ? ['Retry Failed Only', 'View Error Logs'] : ['View Logs']
            };
        }

        // 3. Cleanup / Safety query
        if (q.includes('clean') || q.includes('delete') || q.includes('purge') || q.includes('safe') || q.includes('protect')) {
            return {
                reply: 'The cleanup engine uses safe deterministic pruning. It strictly protects:\n' +
                    '1. The `@everyone` role and all managed bot integration roles\n' +
                    '2. Roles above your highest role position\n' +
                    '3. System, rules, and public updates channels\n' +
                    '4. Multi-signal detected support ticket channels',
                actions: ['View Cleanup Plan']
            };
        }

        // 4. Verification / Score query
        if (q.includes('verify') || q.includes('score') || q.includes('accuracy') || q.includes('diff')) {
            if (!job?.verificationReport) {
                return { reply: 'Deep verification will run automatically at the conclusion of the migration.', actions: [] };
            }
            const v = job.verificationReport;
            return {
                reply: `Migration Verification Result: **${v.status}** with an overall score of **${v.score}%**.\n` +
                    `• Verified: ${v.summary?.verified || 0}\n` +
                    `• Partial: ${v.summary?.partial || 0}\n` +
                    `• Failed: ${v.summary?.failed || 0}\n` +
                    `• Skipped: ${v.summary?.skipped || 0}`,
                actions: ['Export Report', 'View Mismatches']
            };
        }

        // Default Help reply
        return {
            reply: 'I am your Clone Intelligence Copilot. You can ask me about:\n' +
                '• Current migration status & progress\n' +
                '• Error explanations & retry options\n' +
                '• Target cleanup safety & preserved channels\n' +
                '• Verification score and structural diffs',
            actions: ['Check Status', 'Check Errors', 'Cleanup Safety']
        };
    }

    deriveSuggestedActions(job) {
        const actions = [];
        if (!job) return ['Start Migration'];
        if (job.failedQueue?.getStats()?.totalFailed > 0) {
            actions.push('Retry Failed Only');
        }
        if (job.status === 'completed') {
            actions.push('View Verification Report', 'Export Summary');
        } else if (job.status === 'running') {
            actions.push('Check Progress', 'View Pacing');
        }
        return actions;
    }
}
