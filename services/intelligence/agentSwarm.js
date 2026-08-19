/**
 * Clone Intelligence - Multi-Agent Swarm Coordinator
 * The Master Assistant Agent operates the Copilot chat UI, coordinating and delegating
 * specialized tasks across the Cleaner, Cloner, Diagnostics, and Verification agents
 * while sharing unified migration state.
 */

import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';
import { CleanerAgent } from './cleanerAgent.js';
import { ClonerAgent } from './clonerAgent.js';
import { AssistantAgent } from './assistantAgent.js';

export class BaseAgent {
    constructor(name, systemPrompt, aiModelRouter) {
        this.name = name;
        this.systemPrompt = systemPrompt;
        this.modelRouter = aiModelRouter;
    }

    async execute(query, sharedState = {}) {
        if (!this.modelRouter || !this.modelRouter.isAiAvailable()) {
            return {
                success: true,
                isAiGenerated: false,
                agentName: this.name,
                reply: `[${this.name} - Offline Mode] Operational with deterministic rules.`
            };
        }

        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: `Shared Migration State:\n${JSON.stringify(sanitizeAiContext(sharedState))}\n\nQuery/Task:\n${sanitizeSensitiveText(query)}` }
        ];

        const aiResult = await this.modelRouter.executePrompt(messages, {
            taskType: 'complex',
            temperature: 0.2,
            maxTokens: 700
        });

        return {
            success: aiResult.success,
            isAiGenerated: true,
            agentName: this.name,
            reply: aiResult.text || 'Agent analysis completed.',
            modelUsed: aiResult.modelUsed,
            latencyMs: aiResult.latencyMs
        };
    }
}

export class DiagnosticsAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super(
            'Diagnostics Agent 🩺',
            'You are the specialized Diagnostics & Error Agent for Discloner Studio. Your expertise is in Discord API error classification (429 rate limits, missing permissions, hierarchy conflicts) and guiding robust retry queues.',
            aiModelRouter
        );
    }
}

export class VerificationAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super(
            'Verification Agent 🛡️',
            'You are the specialized Verification Agent for Discloner Studio. Your expertise is in post-migration deep structural verification, diff accuracy reports, and scoring.',
            aiModelRouter
        );
    }
}

export class AgentSwarmCoordinator {
    constructor(aiModelRouter, toolsRegistry) {
        this.modelRouter = aiModelRouter;
        this.tools = toolsRegistry;
        this.cleanerAgent = new CleanerAgent(aiModelRouter);
        this.clonerAgent = new ClonerAgent(aiModelRouter);
        this.assistantAgent = new AssistantAgent(aiModelRouter);
        this.diagnosticsAgent = new DiagnosticsAgent(aiModelRouter);
        this.verificationAgent = new VerificationAgent(aiModelRouter);
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
        if (q.includes('verify') || q.includes('score') || q.includes('diff') || q.includes('audit') || q.includes('report')) {
            return { agent: this.verificationAgent, domain: 'Verification' };
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

        // Construct shared state context shared across agents
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
            verification: currentJob.verificationReport
        } : { note: 'No active migration job currently running. Standby mode.' };

        // Check if a specialized agent should perform domain-specific analysis
        const specializedMatch = this.routeSpecializedAgent(cleanQuery);
        let specializedInsight = null;
        if (specializedMatch) {
            const specRes = await specializedMatch.agent.execute(cleanQuery, sharedState);
            if (specRes && specRes.reply) {
                specializedInsight = `[Specialized ${specRes.agentName} Report]:\n${specRes.reply}`;
            }
        }

        // The Master Assistant Agent operates the Copilot chat UI, incorporating specialized insights if available
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
