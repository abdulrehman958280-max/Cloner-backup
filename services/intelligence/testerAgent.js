/**
 * Clone Intelligence - Tester Agent (Deep Verification Agent)
 * Independent verification agent that evaluates post-migration structural accuracy,
 * generates precision diff reports, detects degraded or missing resources,
 * and calculates a deterministic migration fidelity score.
 */

import { BaseAgent, AGENT_STATES } from './baseAgent.js';
import { runDeepVerification } from './deepVerification.js';
import { calculateMigrationScore } from './migrationScore.js';
import { generateBeforeAfterDiff } from './diffEngine.js';
import { agentEventBus, AGENT_EVENT_TYPES } from './agentEventBus.js';

export const VERIFICATION_RESULT_STATES = {
    VERIFIED: 'VERIFIED',
    PARTIAL: 'PARTIAL',
    DEGRADED: 'DEGRADED',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED'
};

export class TesterAgent extends BaseAgent {
    constructor(aiModelRouter) {
        super({
            id: 'tester_agent_01',
            name: 'Tester Agent 🧪',
            type: 'TESTER',
            capabilities: [
                'INDEPENDENT_VERIFICATION',
                'SNAPSHOT_COMPARISON',
                'STRUCTURAL_DIFF',
                'PERMISSION_AUDIT',
                'FIDELITY_SCORE'
            ],
            systemPrompt: 'You are the specialized Tester Agent for Discloner Studio. Your sole purpose is independent, hyper-strict structural verification of cloned Discord servers. You calculate mathematical migration accuracy scores, highlight missing/degraded items, and never claim 100% unless every resource matches perfectly.',
            modelRouter: aiModelRouter
        });
    }

    /**
     * Executes independent post-migration deep verification
     * @param {Object} verificationData { sourceGuild, targetGuild, manifest, jobStats }
     * @returns {Promise<Object>} Verification report with score, diff, missing items, and AI summary
     */
    async executeVerification(verificationData = {}, options = {}) {
        await this.start(options.jobId || 'test_job');
        
        try {
            this.setState(AGENT_STATES.PREFLIGHT, 'Tester Agent verifying access to source and target servers...');
            
            const { sourceGuild, targetGuild, manifest, jobStats } = verificationData;

            if (!sourceGuild || !targetGuild) {
                this.setState(AGENT_STATES.FAILED, 'Missing source or target server snapshot for verification.');
                return {
                    success: false,
                    resultState: VERIFICATION_RESULT_STATES.FAILED,
                    score: 0,
                    error: 'Source or target server metadata is missing.'
                };
            }

            this.setState(AGENT_STATES.VERIFYING, 'Tester Agent conducting deep structural comparison across roles, channels, overwrites, webhooks & assets...');

            // 1. Run deterministic deep structural audit
            const deepReport = runDeepVerification(sourceGuild, targetGuild, manifest || {});

            // 2. Generate Before/After Diff
            const diffReport = generateBeforeAfterDiff(sourceGuild, targetGuild, manifest || {});

            // 3. Compute deterministic Migration Fidelity Score
            const scoreResult = calculateMigrationScore({
                sourceGuild,
                targetGuild,
                deepReport,
                jobStats: jobStats || {}
            });

            // Determine Result State
            let resultState = VERIFICATION_RESULT_STATES.VERIFIED;
            if (scoreResult.score < 50) {
                resultState = VERIFICATION_RESULT_STATES.FAILED;
            } else if (scoreResult.score < 85 || deepReport.missingCount > 0) {
                resultState = VERIFICATION_RESULT_STATES.PARTIAL;
            } else if (deepReport.degradedCount > 0) {
                resultState = VERIFICATION_RESULT_STATES.DEGRADED;
            }

            // Ensure 100% score is NEVER reported if missing/degraded resources exist
            let finalScore = scoreResult.score;
            if ((deepReport.missingCount > 0 || deepReport.degradedCount > 0) && finalScore >= 100) {
                finalScore = 98;
            }

            this.setState(AGENT_STATES.EXECUTING, 'Tester Agent generating AI structural evaluation report...');

            // 4. Generate AI summary analysis if model router is available
            let aiSummary = null;
            if (this.modelRouter && this.modelRouter.isAiAvailable()) {
                const prompt = `Perform a strict quality audit for this Discord server clone operation:
Score: ${finalScore}/100 (${resultState})
Roles (Source: ${deepReport.roles.sourceCount}, Target: ${deepReport.roles.targetCount}, Missing: ${deepReport.roles.missing.length})
Channels (Source: ${deepReport.channels.sourceCount}, Target: ${deepReport.channels.targetCount}, Missing: ${deepReport.channels.missing.length})
Permission Overwrites Match: ${deepReport.permissions.match ? 'YES' : 'NO'} (${deepReport.permissions.mismatches.length} mismatches)
Webhooks Cloned: ${deepReport.webhooks.cloned}
Emojis Cloned: ${deepReport.emojis.cloned}

Summarize key findings, missing items, and verification status concisely.`;

                const aiRes = await this.modelRouter.executePrompt([
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: prompt }
                ], { taskType: 'complex', jobId: this.jobId });

                if (aiRes && aiRes.success) {
                    aiSummary = aiRes.text;
                }
            }

            const finalReport = {
                success: true,
                verifiedAt: new Date().toISOString(),
                resultState,
                score: finalScore,
                scoreBreakdown: scoreResult.breakdown,
                deepReport,
                diffReport,
                aiSummary: aiSummary || `Verification Complete: Score ${finalScore}/100. ${deepReport.missingCount} missing resource(s), ${deepReport.degradedCount} degraded item(s).`,
                agentId: this.id,
                agentName: this.name
            };

            agentEventBus.publish({
                jobId: this.jobId,
                agentId: this.id,
                agentType: this.type,
                eventType: AGENT_EVENT_TYPES.VERIFICATION_COMPLETED,
                stage: 'VERIFIED',
                status: resultState === VERIFICATION_RESULT_STATES.VERIFIED ? 'SUCCESS' : 'WARNING',
                progress: 100,
                message: `Verification complete: Score ${finalScore}/100 (${resultState})`,
                metadata: { score: finalScore, resultState }
            });

            this.setState(AGENT_STATES.COMPLETED, `Tester Agent completed verification. Final Score: ${finalScore}/100 (${resultState})`);
            await this.logout();

            return finalReport;
        } catch (err) {
            await this.recover(err);
            this.setState(AGENT_STATES.FAILED, `Tester Agent error: ${err.message}`);
            await this.logout();
            return {
                success: false,
                resultState: VERIFICATION_RESULT_STATES.FAILED,
                score: 0,
                error: err.message
            };
        }
    }
}
