/**
 * Clone Intelligence - Unified Subsystem Index
 * Main entry point exporting analyzers, compatibility engine, ticket detector,
 * rate limit intelligence, recovery, AI model router, and copilot chat service.
 */

export * from './sanitizer.js';
export * from './sourceAnalyzer.js';
export * from './targetAnalyzer.js';
export * from './ticketDetector.js';
export * from './compatibilityEngine.js';
export * from './conflictDetector.js';
export * from './cleanupIntelligence.js';
export * from './migrationPlanner.js';
export * from './predictionEngine.js';
export * from './errorIntelligence.js';
export * from './recoveryIntelligence.js';
export * from './failedRetryQueue.js';
export * from './deepVerification.js';
export * from './migrationScore.js';
export * from './diffEngine.js';
export * from './modelCapabilityRegistry.js';
export * from './aiModelRouter.js';
export * from './aiValidator.js';
export * from './aiTools.js';
export * from './aiChatService.js';
export * from './cleanerAgent.js';
export * from './clonerAgent.js';
export * from './assistantAgent.js';
export * from './agentSwarm.js';
export * from './reportGenerator.js';

import { AiModelRouter } from './aiModelRouter.js';
import { IntelligenceToolsRegistry } from './aiTools.js';
import { AiChatService } from './aiChatService.js';
import { AgentSwarmCoordinator } from './agentSwarm.js';

// Instantiate singletons for server runtime
export const aiModelRouter = new AiModelRouter();
export const intelligenceTools = new IntelligenceToolsRegistry(null, aiModelRouter);
export const agentSwarmCoordinator = new AgentSwarmCoordinator(aiModelRouter, intelligenceTools);
export const aiChatService = new AiChatService(aiModelRouter, intelligenceTools, agentSwarmCoordinator);
