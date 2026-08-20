/**
 * Clone Intelligence - Cleaner Agent
 * Specialized worker agent responsible for target server pruning safety, protecting @everyone,
 * managed roles, and ticket/support channels while sharing live migration state and publishing lifecycle events.
 */

import { BaseAgent, AGENT_STATES } from './baseAgent.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';
import { evaluateChannelForTicket, scanGuildForTickets } from './ticketDetector.js';
import { generateCleanupPlan } from './cleanupIntelligence.js';
import { agentEventBus, AGENT_EVENT_TYPES } from './agentEventBus.js';

export class CleanerAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'cleaner_agent_01',
            name: 'Cleaner Agent 🧹',
            type: 'CLEANER',
            capabilities: [
                'TARGET_DISCOVERY',
                'PROTECTED_RESOURCE_DETECTION',
                'TICKET_CHANNEL_ANALYSIS',
                'CLEANUP_PLANNING',
                'SAFE_PRUNING_EXECUTION'
            ],
            systemPrompt: 'You are the specialized Cleaner Agent for Discloner Studio. Your core responsibility is target server cleanup safety analysis, protecting default/managed roles and support ticket channels, generating transparent cleanup plans, and ensuring zero accidental data loss.',
            modelRouter: aiModelRouter
        });
    }

    /**
     * Runs full target discovery, ticket detection, and cleanup plan generation
     */
    async discoverAndPlanCleanup(targetGuildSnapshot, options = {}) {
        await this.start(options.jobId || 'cleaner_job');
        this.setState(AGENT_STATES.PREFLIGHT, 'Cleaner Agent running preflight target server discovery...');

        try {
            if (!targetGuildSnapshot) {
                this.setState(AGENT_STATES.FAILED, 'Target server snapshot missing for cleanup discovery.');
                return { success: false, error: 'Target server snapshot required.' };
            }

            // 1. Detect tickets across target channels
            const channels = targetGuildSnapshot.channels || [];
            const ticketScan = scanGuildForTickets(channels);

            // 2. Generate deterministic cleanup plan
            const cleanupPlan = generateCleanupPlan(targetGuildSnapshot, {
                cleanTarget: options.cleanTarget !== false, // default true
                preserveTickets: options.preserveTickets !== false, // default true
                protectedRoleNames: options.protectedRoleNames || []
            });

            this.setState(AGENT_STATES.READY, `Target cleanup plan created. ${cleanupPlan.rolesToDelete.length} roles, ${cleanupPlan.channelsToDelete.length} channels planned for pruning. ${ticketScan.ticketCount} ticket channel(s) protected.`);

            agentEventBus.publish({
                jobId: this.jobId,
                agentId: this.id,
                agentType: this.type,
                eventType: AGENT_EVENT_TYPES.PLAN_CREATED,
                stage: 'PLAN_CREATED',
                status: 'INFO',
                progress: 100,
                message: `Cleanup plan generated: ${cleanupPlan.rolesToDelete.length} roles, ${cleanupPlan.channelsToDelete.length} channels targeted.`,
                metadata: {
                    rolesCount: cleanupPlan.rolesToDelete.length,
                    channelsCount: cleanupPlan.channelsToDelete.length,
                    ticketCount: ticketScan.ticketCount
                }
            });

            return {
                success: true,
                cleanupPlan,
                ticketScan
            };
        } catch (err) {
            await this.recover(err);
            this.setState(AGENT_STATES.FAILED, `Cleaner Agent discovery error: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Legacy / Chat interface execution method
     */
    async execute(query, sharedState = {}) {
        return super.execute(query, { sharedState, taskType: TASK_TYPES.COMPLEX });
    }
}
