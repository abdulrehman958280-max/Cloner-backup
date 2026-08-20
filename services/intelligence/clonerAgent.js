/**
 * Clone Intelligence - Cloner Agent
 * Specialized worker agent responsible for pre-flight server scanning, compatibility scoring,
 * role/channel pipeline execution, asset replication, permission mapping, and publishing progress events.
 */

import { BaseAgent, AGENT_STATES } from './baseAgent.js';
import { TASK_TYPES } from './modelCapabilityRegistry.js';
import { checkGuildCompatibility } from './compatibilityEngine.js';
import { buildMigrationPlan } from './migrationPlanner.js';
import { agentEventBus, AGENT_EVENT_TYPES } from './agentEventBus.js';

export class ClonerAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'cloner_agent_01',
            name: 'Cloner Agent ⚡',
            type: 'CLONER',
            capabilities: [
                'SOURCE_TARGET_ANALYSIS',
                'COMPATIBILITY_CHECK',
                'MIGRATION_PLANNING',
                'PIPELINE_EXECUTION',
                'DEGRADATION_TRACKING'
            ],
            systemPrompt: 'You are the specialized Cloner Agent for Discloner Studio. Your core responsibility is source/target structure analysis, pre-flight compatibility checks, role and channel dependency mapping, and executing replication orchestration smoothly.',
            modelRouter: aiModelRouter
        });
    }

    /**
     * Conducts pre-flight analysis and builds migration replication plan
     */
    async buildReplicationPlan(sourceGuildSnapshot, targetGuildSnapshot, options = {}) {
        await this.start(options.jobId || 'cloner_job');
        this.setState(AGENT_STATES.PREFLIGHT, 'Cloner Agent analyzing source and target server structural compatibility...');

        try {
            if (!sourceGuildSnapshot || !targetGuildSnapshot) {
                this.setState(AGENT_STATES.FAILED, 'Source or target server snapshot missing for migration planning.');
                return { success: false, error: 'Source and target server snapshots required.' };
            }

            // 1. Compatibility check
            const compatibility = checkGuildCompatibility(sourceGuildSnapshot, targetGuildSnapshot);

            // 2. Migration plan
            const plan = buildMigrationPlan(sourceGuildSnapshot, targetGuildSnapshot, options);

            this.setState(AGENT_STATES.READY, `Migration replication plan built: ${plan.pipelineSequence.length} pipeline stages ready. Score: ${compatibility.compatibilityScore}%`);

            agentEventBus.publish({
                jobId: this.jobId,
                agentId: this.id,
                agentType: this.type,
                eventType: AGENT_EVENT_TYPES.PLAN_CREATED,
                stage: 'PLAN_CREATED',
                status: 'INFO',
                progress: 100,
                message: `Cloning plan ready: ${plan.rolesToCreate.length} roles, ${plan.categoriesToCreate.length} categories, ${plan.channelsToCreate.length} channels scheduled.`,
                metadata: {
                    rolesCount: plan.rolesToCreate.length,
                    channelsCount: plan.channelsToCreate.length,
                    compatibilityScore: compatibility.compatibilityScore
                }
            });

            return {
                success: true,
                compatibility,
                plan
            };
        } catch (err) {
            await this.recover(err);
            this.setState(AGENT_STATES.FAILED, `Cloner Agent planning error: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Legacy / Chat interface execution method
     */
    async execute(query, sharedState = {}) {
        return super.execute(query, { sharedState, taskType: TASK_TYPES.PREFLIGHT_AUDIT });
    }
}
