/**
 * Cloner Agent Module
 * Specialized agent responsible for pre-flight server scanning, compatibility scoring,
 * role/channel mapping, and replication choreography while sharing live migration state.
 */
import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';

export class ClonerAgent {
    constructor(aiModelRouter) {
        this.name = 'Cloner Agent ⚡';
        this.modelRouter = aiModelRouter;
        this.systemPrompt = 'You are the specialized Cloner Agent for Discloner Studio. Your core responsibility is source/target structure analysis, pre-flight checks, compatibility scoring, and executing replication orchestration smoothly.';
    }

    async execute(query, sharedState = {}) {
        const cleanQuery = sanitizeSensitiveText(query).trim();
        if (!this.modelRouter || !this.modelRouter.isAiAvailable()) {
            return {
                success: true,
                isAiGenerated: false,
                agentName: this.name,
                reply: '[Cloner Agent - Offline Mode] Cloner replication engine is active with deterministic structure mapping.'
            };
        }

        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: `Shared Migration State:\n${JSON.stringify(sanitizeAiContext(sharedState))}\n\nCloning Task/Query:\n${cleanQuery}` }
        ];

        const aiResult = await this.modelRouter.executePrompt(messages, {
            taskType: TASK_TYPES.PREFLIGHT_AUDIT,
            temperature: 0.2,
            maxTokens: 700
        });

        return {
            success: aiResult.success,
            isAiGenerated: true,
            agentName: this.name,
            reply: aiResult.text || 'Cloner agent replication analysis completed.',
            modelUsed: aiResult.modelUsed,
            latencyMs: aiResult.latencyMs
        };
    }
}
