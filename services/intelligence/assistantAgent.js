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
            name: 'Assistant Agent 🤖',
            type: 'ASSISTANT',
            capabilities: [
                'SWARM_ORCHESTRATION',
                'COPILOT_CHAT',
                'REALTIME_TELEMETRY',
                'USER_CONTROL_DISPATCH'
            ],
            systemPrompt: 'You are the Master Assistant Agent & Orchestrator for Discloner Studio. You assist users with server cloning, target cleanup safety, error diagnostics, and post-migration verification. You have real-time visibility into the actual live migration state. Speak concisely, clearly, and never hallucinate permissions or cloning facts.',
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
                reply: 'I am your Assistant Agent. Configure your Neural API key for advanced multi-agent intelligence, or use the quick action buttons to manage your migration.'
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
            reply: aiResult.text || 'Assistant response generated.',
            modelUsed: aiResult.modelUsed,
            latencyMs: aiResult.latencyMs
        };
    }
}
