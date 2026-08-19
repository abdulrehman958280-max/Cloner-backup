/**
 * Assistant Agent Module
 * Master conversational agent that coordinates swarm intent routing across Cleaner and Cloner agents
 * while maintaining unified shared state context.
 */
import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';

export class AssistantAgent {
    constructor(aiModelRouter) {
        this.name = 'Assistant Agent 🤖';
        this.modelRouter = aiModelRouter;
        this.systemPrompt = 'You are the Master Assistant Agent for Discloner Studio. You guide users across server cloning, cleanup safety, diagnostics, and verification, maintaining complete synchronization with the shared migration state.';
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
            { role: 'user', content: `Shared Migration State:\n${JSON.stringify(sanitizeAiContext(sharedState))}\n\nUser Query:\n${cleanQuery}` }
        ];

        const aiResult = await this.modelRouter.executePrompt(messages, {
            taskType: TASK_TYPES.FAST_CHAT,
            temperature: 0.3,
            maxTokens: 700
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
