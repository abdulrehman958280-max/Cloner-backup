/**
 * Clone Intelligence - Assistant Agent (Orchestrator)
 * Master conversational agent and central coordinator powering the Copilot UI.
 * Integrates live job/agent telemetry, rate limit stats, verification scores,
 * and multi-agent event history to provide accurate responses without hallucinating.
 */

import { BaseAgent } from './baseAgent.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';
import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';

export class AssistantAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'assistant_agent_01',
            name: 'Autonomous AI Orchestrator 🤖',
            type: 'ASSISTANT',
            capabilities: [
                'SWARM_ORCHESTRATION',
                'AUTONOMOUS_EXECUTION',
                'COPILOT_CHAT',
                'REALTIME_TELEMETRY',
                'USER_CONTROL_DISPATCH'
            ],
            systemPrompt: `You are the Autonomous AI Orchestrator & Copilot for Discloner Studio.
You have the power to autonomously operate the entire migration suite using user tokens.
You can:
1. Scan and inspect user servers (detecting Source and Target servers).
2. Initiate automated server migrations with custom options (roles, channels, emojis, permissions, messages).
3. Diagnose and fix errors, trigger retry queues for failed items.
4. Safely plan and preview target server cleanups.
5. Provide actionable guidance in clean markdown (with bullet points and bolding).

When the user asks you to perform an action (e.g. "Clone my server", "Start migration", "Scan servers", "Retry failed"), explain what you are doing clearly and state your plan concisely. Never hallucinate fake stats. Always speak in a professional, helpful tone.`,
            modelRouter: aiModelRouter
        });
    }

    async execute(query, sharedState = {}) {
        const cleanQuery = sanitizeSensitiveText(query).trim();
        if (!this.modelRouter || !this.modelRouter.isAiAvailable()) {
            return {
                success: true,
                isAiGenerated: false,
                agentName: this.name,
                reply: 'I am your Autonomous AI Assistant. Enter your User Token and ask me to scan your servers, audit security, or execute full migrations.'
            };
        }

        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: `Live Migration State Context:\n${JSON.stringify(sanitizeAiContext(sharedState))}\n\nUser Prompt:\n${cleanQuery}` }
        ];

        const aiResult = await this.modelRouter.executePrompt(messages, {
            taskType: TASK_TYPES.FAST_CHAT,
            temperature: 0.3,
            maxTokens: 800
        });

        return {
            success: aiResult.success,
            isAiGenerated: true,
            agentName: this.name,
            reply: aiResult.text || 'Autonomous response generated.',
            modelUsed: aiResult.modelUsed,
            latencyMs: aiResult.latencyMs
        };
    }
}
