/**
 * Clone Intelligence - Multi-Agent Swarm Coordinator
 * Master orchestrator managing CleanerAgent, ClonerAgent, TesterAgent, DiagnosticsAgent,
 * and AssistantAgent across job lifecycles and real-time user Copilot interactions.
 */

import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';
import { CleanerAgent } from './cleanerAgent.js';
import { ClonerAgent } from './clonerAgent.js';
import { AssistantAgent } from './assistantAgent.js';
import { TesterAgent } from './testerAgent.js';
import { SheetOptimizerAgent } from './sheetOptimizerAgent.js';
import { BaseAgent } from './baseAgent.js';
import { agentEventBus } from './agentEventBus.js';

export class DiagnosticsAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'diagnostics_agent_01',
            name: 'Diagnostics Agent 🩺',
            type: 'DIAGNOSTICS',
            capabilities: ['ERROR_CLASSIFICATION', 'RETRY_ANALYSIS', 'RATE_LIMIT_ADVICE'],
            systemPrompt: 'You are the specialized Diagnostics & Error Agent for Discloner Studio. Your expertise is in Discord API error classification (429 rate limits, missing permissions, hierarchy conflicts) and guiding robust retry queues.',
            modelRouter: aiModelRouter
        });
    }
}

export class AgentSwarmCoordinator {
    constructor(aiModelRouter, toolsRegistry) {
        this.modelRouter = aiModelRouter;
        this.tools = toolsRegistry;
        
        // Specialized Agent Instances
        this.cleanerAgent = new CleanerAgent(aiModelRouter);
        this.clonerAgent = new ClonerAgent(aiModelRouter);
        this.testerAgent = new TesterAgent(aiModelRouter);
        this.assistantAgent = new AssistantAgent(aiModelRouter);
        this.diagnosticsAgent = new DiagnosticsAgent(aiModelRouter);
        this.sheetAgent = new SheetOptimizerAgent(aiModelRouter);

        this.agentsMap = new Map([
            ['CLEANER', this.cleanerAgent],
            ['CLONER', this.clonerAgent],
            ['TESTER', this.testerAgent],
            ['ASSISTANT', this.assistantAgent],
            ['DIAGNOSTICS', this.diagnosticsAgent],
            ['SHEET', this.sheetAgent]
        ]);
    }

    getAgent(type) {
        return this.agentsMap.get(type?.toUpperCase()) || this.assistantAgent;
    }

    getSwarmSnapshot(jobId = null) {
        const events = jobId ? agentEventBus.getJobEventHistory(jobId) : [];
        const snapshot = {};
        for (const [key, agent] of this.agentsMap.entries()) {
            snapshot[key.toLowerCase()] = {
                id: agent.id,
                name: agent.name,
                type: agent.type,
                state: agent.state,
                capabilities: agent.capabilities,
                metrics: agent.metrics
            };
        }
        return {
            agents: snapshot,
            recentEvents: events.slice(-20)
        };
    }

    // Determine if query requires a specialized agent's deep expertise
    routeSpecializedAgent(query) {
        const q = query.toLowerCase();
        if (q.includes('clean') || q.includes('purge') || q.includes('delete') || q.includes('ticket') || q.includes('safety')) {
            return { agent: this.cleanerAgent, domain: 'Cleaner' };
        }
        if (q.includes('clone') || q.includes('preflight') || q.includes('sync') || q.includes('compatibility') || q.includes('map') || q.includes('scan')) {
            return { agent: this.clonerAgent, domain: 'Cloner' };
        }
        if (q.includes('error') || q.includes('fail') || q.includes('bug') || q.includes('rate limit') || q.includes('retry') || q.includes('diagnos')) {
            return { agent: this.diagnosticsAgent, domain: 'Diagnostics' };
        }
        if (q.includes('sheet') || q.includes('excel') || q.includes('google script') || q.includes('export') || q.includes('history')) {
            return { agent: this.sheetAgent, domain: 'Sheet Optimizer' };
        }
        if (q.includes('verify') || q.includes('score') || q.includes('diff') || q.includes('audit') || q.includes('test') || q.includes('report')) {
            return { agent: this.testerAgent, domain: 'Tester' };
        }
        return null;
    }

    async handleSwarmQuery(query, jobId = null, currentJob = null, userToken = null) {
        const cleanQuery = sanitizeSensitiveText(query).trim();
        if (!cleanQuery) {
            return { reply: 'Please enter a query for the assistant agent.', agentName: this.assistantAgent.name };
        }

        // Tool invocation check for scanning servers
        const qLower = cleanQuery.toLowerCase();
        if (qLower.includes('scan') || qLower.includes('server') || qLower.includes('guild')) {
            if (this.tools) {
                const toolRes = await this.tools.executeTool('scanUserServers', { userToken }, jobId);
                if (toolRes && toolRes.success) {
                    const guilds = toolRes.guilds || [];
                    return {
                        reply: `### 🔍 Cloner Agent (Specialized Task): Scanned Servers (${guilds.length})\nSuccessfully authenticated with user token:\n` + guilds.slice(0, 12).map(g => `• **${g.name}** (ID: \`${g.id}\`)`).join('\n'),
                        agentName: this.assistantAgent.name,
                        modelUsed: 'User Token Discord API',
                        latencyMs: 20,
                        isAiGenerated: false
                    };
                }
            }
        }

        // Construct shared state context across agents
        const sharedState = currentJob ? {
            jobId: currentJob.id,
            status: currentJob.status,
            stage: currentJob.stage,
            progress: currentJob.progress,
            stats: currentJob.statCounters,
            error: currentJob.error,
            sourceSummary: currentJob.sourceAnalysis,
            targetSummary: currentJob.targetAnalysis,
            cleanupPlan: currentJob.intelligenceContext?.cleanupPlan,
            verification: currentJob.verificationReport,
            swarmState: this.getSwarmSnapshot(currentJob.id)
        } : {
            note: 'No active migration job currently running. Standby mode.',
            swarmState: this.getSwarmSnapshot(null)
        };

        // Check if a specialized agent should perform domain-specific analysis
        const specializedMatch = this.routeSpecializedAgent(cleanQuery);
        let specializedInsight = null;
        if (specializedMatch) {
            const specRes = await specializedMatch.agent.execute(cleanQuery, { sharedState });
            if (specRes && specRes.reply) {
                specializedInsight = `[Specialized ${specRes.agentName} Report]:\n${specRes.reply}`;
            }
        }

        const assistantQuery = specializedInsight
            ? `${cleanQuery}\n\nContext from specialized domain expert:\n${specializedInsight}`
            : cleanQuery;

        const aiRes = await this.assistantAgent.execute(assistantQuery, sharedState);

        if (aiRes && aiRes.reply) {
            return {
                reply: aiRes.reply,
                agentName: this.assistantAgent.name,
                modelUsed: aiRes.modelUsed || 'Neural Multi-Agent Swarm',
                modelName: this.assistantAgent.name,
                latencyMs: aiRes.latencyMs || 25,
                autoSwitched: false,
                failoverChain: null,
                isAiGenerated: aiRes.isAiGenerated !== false
            };
        }

        return {
            reply: `*[${this.assistantAgent.name} - Offline Mode]*\nI am operating in deterministic assistant mode. Configure your Neural API key for advanced multi-agent coordination.`,
            agentName: this.assistantAgent.name,
            isAiGenerated: false
        };
    }
}
