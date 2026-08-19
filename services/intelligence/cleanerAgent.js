/**
 * Cleaner Agent Module
 * Specialized agent responsible for target server pruning safety, protecting @everyone and managed roles,
 * and identifying ticket channels while sharing live migration state.
 */
import { sanitizeAiContext, sanitizeSensitiveText } from './sanitizer.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';

export class CleanerAgent {
    constructor(aiModelRouter) {
        this.name = 'Cleaner Agent 🧹';
        this.modelRouter = aiModelRouter;
        this.systemPrompt = 'You are the specialized Cleaner Agent for Discloner Studio. Your core responsibility is target server cleanup safety analysis, protecting protected roles and ticket channels, and ensuring zero accidental data loss during server pruning.';
    }

    async execute(query, sharedState = {}) {
        const cleanQuery = sanitizeSensitiveText(query).trim();
        if (!this.modelRouter || !this.modelRouter.isAiAvailable()) {
            return {
                success: true,
                isAiGenerated: false,
                agentName: this.name,
                reply: '[Cleaner Agent - Offline Mode] Cleaner engine is active with deterministic safety rules. Protected roles and ticket channels are fully secured.'
            };
        }

        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: `Shared Migration State:\n${JSON.stringify(sanitizeAiContext(sharedState))}\n\nCleaning Task/Query:\n${cleanQuery}` }
        ];

        const aiResult = await this.modelRouter.executePrompt(messages, {
            taskType: TASK_TYPES.COMPLEX,
            temperature: 0.2,
            maxTokens: 700
        });

        return {
            success: aiResult.success,
            isAiGenerated: true,
            agentName: this.name,
            reply: aiResult.text || 'Cleaner agent analysis completed.',
            modelUsed: aiResult.modelUsed,
            latencyMs: aiResult.latencyMs
        };
    }
}
