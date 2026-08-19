/**
 * Clone Intelligence - Model Capability Registry
 * Evaluates available neural models based on latency, structured output support,
 * context window size, and reasoning depth to make intelligent routing decisions
 * for simple vs. complex migration tasks.
 */

export const TASK_TYPES = {
    SIMPLE: 'simple',                     // Quick status checks, short clarifications, greeting
    FAST_CHAT: 'fast_chat',               // Conversational user questions
    COMPLEX: 'complex',                   // Deep root-cause error diagnosis, architecture analysis
    DEEP_REASONING: 'deep_reasoning',     // Permission hierarchy conflicts, recovery strategy
    STRUCTURED_JSON: 'structured_json',   // JSON diffs, permission bitmasks, schema outputs
    CODE_STRUCTURE: 'code_structure',     // Channel tree optimization, webhook/role mapping
    PREFLIGHT_AUDIT: 'preflight_audit',   // Pre-migration deep scan across entire guild
    LARGE_GUILD: 'large_guild'            // Massive guilds with 100+ channels and roles
};

export const BASE_CAPABILITY_PROFILES = {
    'google/gemini-2.0-flash-exp:free': {
        contextWindow: 1048576,
        structuredOutputSupport: 0.96,
        reasoningDepth: 0.94,
        nativeJsonMode: true,
        baselineLatencyMs: 320,
        recommendedTasks: [TASK_TYPES.SIMPLE, TASK_TYPES.FAST_CHAT, TASK_TYPES.LARGE_GUILD, TASK_TYPES.PREFLIGHT_AUDIT, TASK_TYPES.STRUCTURED_JSON]
    },
    'google/gemini-2.0-flash-thinking-exp:free': {
        contextWindow: 1048576,
        structuredOutputSupport: 0.95,
        reasoningDepth: 0.98,
        nativeJsonMode: true,
        baselineLatencyMs: 680,
        recommendedTasks: [TASK_TYPES.COMPLEX, TASK_TYPES.DEEP_REASONING, TASK_TYPES.PREFLIGHT_AUDIT]
    },
    'meta-llama/llama-3.3-70b-instruct:free': {
        contextWindow: 131072,
        structuredOutputSupport: 0.94,
        reasoningDepth: 0.96,
        nativeJsonMode: true,
        baselineLatencyMs: 480,
        recommendedTasks: [TASK_TYPES.COMPLEX, TASK_TYPES.DEEP_REASONING, TASK_TYPES.FAST_CHAT, TASK_TYPES.LARGE_GUILD]
    },
    'qwen/qwen-2.5-coder-32b-instruct:free': {
        contextWindow: 32768,
        structuredOutputSupport: 0.99,
        reasoningDepth: 0.95,
        nativeJsonMode: true,
        baselineLatencyMs: 390,
        recommendedTasks: [TASK_TYPES.STRUCTURED_JSON, TASK_TYPES.CODE_STRUCTURE, TASK_TYPES.COMPLEX]
    },
    'qwen/qwen-2.5-72b-instruct:free': {
        contextWindow: 131072,
        structuredOutputSupport: 0.95,
        reasoningDepth: 0.95,
        nativeJsonMode: true,
        baselineLatencyMs: 520,
        recommendedTasks: [TASK_TYPES.COMPLEX, TASK_TYPES.DEEP_REASONING, TASK_TYPES.LARGE_GUILD]
    },
    'mistralai/mistral-small-24b-instruct-2501:free': {
        contextWindow: 32768,
        structuredOutputSupport: 0.92,
        reasoningDepth: 0.90,
        nativeJsonMode: true,
        baselineLatencyMs: 310,
        recommendedTasks: [TASK_TYPES.SIMPLE, TASK_TYPES.FAST_CHAT]
    },
    'deepseek/deepseek-r1:free': {
        contextWindow: 65536,
        structuredOutputSupport: 0.93,
        reasoningDepth: 0.99,
        nativeJsonMode: true,
        baselineLatencyMs: 890,
        recommendedTasks: [TASK_TYPES.COMPLEX, TASK_TYPES.DEEP_REASONING]
    },
    'deepseek/deepseek-chat:free': {
        contextWindow: 65536,
        structuredOutputSupport: 0.92,
        reasoningDepth: 0.91,
        nativeJsonMode: true,
        baselineLatencyMs: 340,
        recommendedTasks: [TASK_TYPES.SIMPLE, TASK_TYPES.FAST_CHAT]
    },
    'meta-llama/llama-3.1-8b-instruct:free': {
        contextWindow: 131072,
        structuredOutputSupport: 0.88,
        reasoningDepth: 0.86,
        nativeJsonMode: true,
        baselineLatencyMs: 260,
        recommendedTasks: [TASK_TYPES.SIMPLE, TASK_TYPES.FAST_CHAT]
    },
    'meta-llama/llama-3.2-3b-instruct:free': {
        contextWindow: 131072,
        structuredOutputSupport: 0.84,
        reasoningDepth: 0.82,
        nativeJsonMode: false,
        baselineLatencyMs: 190,
        recommendedTasks: [TASK_TYPES.SIMPLE]
    },
    'microsoft/phi-3-medium-128k-instruct:free': {
        contextWindow: 128000,
        structuredOutputSupport: 0.89,
        reasoningDepth: 0.88,
        nativeJsonMode: true,
        baselineLatencyMs: 410,
        recommendedTasks: [TASK_TYPES.STRUCTURED_JSON, TASK_TYPES.LARGE_GUILD]
    },
    'nousresearch/hermes-3-llama-3.1-405b:free': {
        contextWindow: 131072,
        structuredOutputSupport: 0.94,
        reasoningDepth: 0.97,
        nativeJsonMode: true,
        baselineLatencyMs: 750,
        recommendedTasks: [TASK_TYPES.COMPLEX, TASK_TYPES.DEEP_REASONING, TASK_TYPES.LARGE_GUILD]
    }
};

export class ModelCapabilityRegistry {
    constructor() {
        this.registry = new Map(); // modelId -> CapabilityProfile
        this.lastUpdated = new Date().toISOString();
        this.updateIntervalTimer = null;

        this.initializeDefaults();
        this.startPeriodicUpdates();
    }

    /**
     * Initializes default capability profiles for curated free models
     */
    initializeDefaults() {
        for (const [modelId, profile] of Object.entries(BASE_CAPABILITY_PROFILES)) {
            this.registerModel(modelId, profile);
        }
    }

    /**
     * Registers or updates a model capability profile
     */
    registerModel(modelId, profile = {}) {
        const existing = this.registry.get(modelId) || {};
        const contextWindow = profile.contextWindow || profile.context_length || existing.contextWindow || 32768;
        const baselineLatencyMs = profile.baselineLatencyMs || existing.baselineLatencyMs || 400;

        const updatedProfile = {
            modelId,
            contextWindow,
            structuredOutputSupport: profile.structuredOutputSupport ?? existing.structuredOutputSupport ?? 0.88,
            reasoningDepth: profile.reasoningDepth ?? existing.reasoningDepth ?? 0.85,
            nativeJsonMode: profile.nativeJsonMode ?? existing.nativeJsonMode ?? true,
            baselineLatencyMs,
            rollingAvgLatencyMs: existing.rollingAvgLatencyMs || baselineLatencyMs,
            latencySamples: existing.latencySamples || 0,
            recommendedTasks: profile.recommendedTasks || existing.recommendedTasks || [TASK_TYPES.SIMPLE, TASK_TYPES.FAST_CHAT],
            lastEvaluatedAt: new Date().toISOString()
        };

        this.registry.set(modelId, updatedProfile);
        this.lastUpdated = new Date().toISOString();
        return updatedProfile;
    }

    /**
     * Records real-world latency and execution metrics to adaptively refine capability scoring
     */
    recordExecutionMetric(modelId, { latencyMs, success, error, isStructuredOutput }) {
        let profile = this.registry.get(modelId);
        if (!profile) {
            profile = this.registerModel(modelId);
        }

        if (typeof latencyMs === 'number' && latencyMs > 0) {
            profile.latencySamples = (profile.latencySamples || 0) + 1;
            // Exponential moving average for latency
            profile.rollingAvgLatencyMs = Math.round((profile.rollingAvgLatencyMs * 0.7) + (latencyMs * 0.3));
        }

        if (isStructuredOutput && success) {
            profile.structuredOutputSupport = Math.min(1.0, profile.structuredOutputSupport + 0.005);
        } else if (isStructuredOutput && !success && error && error.includes('JSON')) {
            profile.structuredOutputSupport = Math.max(0.6, profile.structuredOutputSupport - 0.02);
        }

        profile.lastEvaluatedAt = new Date().toISOString();
    }

    /**
     * Evaluates the suitability score (0 to 100) of a model for a specific task type
     */
    evaluateSuitability(modelId, taskType = TASK_TYPES.SIMPLE, constraints = {}) {
        const profile = this.registry.get(modelId);
        if (!profile) {
            return {
                score: 50,
                latencyTier: 'standard',
                contextSuitability: 'moderate',
                structuredOutputGrade: 'B'
            };
        }

        const minContextRequired = constraints.minTokens || 4000;
        if (profile.contextWindow < minContextRequired) {
            return { score: 10, disqualified: true, reason: `Context window (${profile.contextWindow}) is smaller than required (${minContextRequired})` };
        }

        const latency = profile.rollingAvgLatencyMs || profile.baselineLatencyMs || 400;
        let speedScore = 1.0;
        if (latency <= 300) speedScore = 1.0;
        else if (latency <= 600) speedScore = 0.85;
        else if (latency <= 1200) speedScore = 0.70;
        else speedScore = 0.50;

        let contextScore = Math.min(1.0, profile.contextWindow / 131072);
        if (profile.contextWindow >= 1048576) contextScore = 1.0;

        let score = 50;

        switch (taskType) {
            case TASK_TYPES.SIMPLE:
            case TASK_TYPES.FAST_CHAT:
                // Prioritize low latency, high responsiveness
                score = (speedScore * 50) + (profile.reasoningDepth * 30) + (profile.structuredOutputSupport * 20);
                break;

            case TASK_TYPES.COMPLEX:
            case TASK_TYPES.DEEP_REASONING:
                // Prioritize deep analytical reasoning and broad context
                score = (profile.reasoningDepth * 50) + (profile.structuredOutputSupport * 25) + (contextScore * 15) + (speedScore * 10);
                break;

            case TASK_TYPES.STRUCTURED_JSON:
            case TASK_TYPES.CODE_STRUCTURE:
                // Prioritize high schema fidelity and precision
                score = (profile.structuredOutputSupport * 55) + (profile.reasoningDepth * 25) + (speedScore * 10) + (contextScore * 10);
                break;

            case TASK_TYPES.PREFLIGHT_AUDIT:
            case TASK_TYPES.LARGE_GUILD:
                // Prioritize huge context window, structured output and deep reasoning
                score = (contextScore * 40) + (profile.reasoningDepth * 30) + (profile.structuredOutputSupport * 20) + (speedScore * 10);
                break;

            default:
                score = (profile.reasoningDepth * 40) + (speedScore * 30) + (profile.structuredOutputSupport * 30);
                break;
        }

        // Boost if explicitly recommended for this task
        if (profile.recommendedTasks.includes(taskType)) {
            score = Math.min(100, score + 8);
        }

        const latencyTier = latency < 350 ? 'ultra_fast' : (latency < 750 ? 'fast' : (latency < 1500 ? 'standard' : 'heavy'));
        const structuredOutputGrade = profile.structuredOutputSupport >= 0.95 ? 'A+' : (profile.structuredOutputSupport >= 0.90 ? 'A' : 'B');

        return {
            score: Math.round(score),
            latencyTier,
            latencyMs: latency,
            contextWindow: profile.contextWindow,
            structuredOutputSupport: profile.structuredOutputSupport,
            reasoningDepth: profile.reasoningDepth,
            structuredOutputGrade,
            nativeJsonMode: profile.nativeJsonMode
        };
    }

    /**
     * Ranks a list of candidate model objects by task suitability
     */
    rankModelsForTask(candidateModels = [], taskType = TASK_TYPES.SIMPLE, constraints = {}) {
        return [...candidateModels].sort((a, b) => {
            const evalA = this.evaluateSuitability(a.id, taskType, constraints);
            const evalB = this.evaluateSuitability(b.id, taskType, constraints);
            return evalB.score - evalA.score;
        });
    }

    /**
     * Generates a comprehensive capability report of all registered models
     */
    getRegistryReport() {
        const models = [];
        for (const [modelId, profile] of this.registry.entries()) {
            const simpleEval = this.evaluateSuitability(modelId, TASK_TYPES.SIMPLE);
            const complexEval = this.evaluateSuitability(modelId, TASK_TYPES.COMPLEX);
            const structuredEval = this.evaluateSuitability(modelId, TASK_TYPES.STRUCTURED_JSON);

            models.push({
                modelId,
                contextWindow: profile.contextWindow,
                avgLatencyMs: profile.rollingAvgLatencyMs,
                structuredOutputGrade: simpleEval.structuredOutputGrade,
                structuredSupport: profile.structuredOutputSupport,
                reasoningDepth: profile.reasoningDepth,
                nativeJsonMode: profile.nativeJsonMode,
                recommendedTasks: profile.recommendedTasks,
                scores: {
                    simple: simpleEval.score,
                    complex: complexEval.score,
                    structured: structuredEval.score
                }
            });
        }

        return {
            totalRegistered: this.registry.size,
            lastUpdated: this.lastUpdated,
            models
        };
    }

    /**
     * Starts periodic refresh of registry metrics
     */
    startPeriodicUpdates() {
        if (this.updateIntervalTimer) return;
        // Periodic hygiene every 10 minutes to decay latency drift
        this.updateIntervalTimer = setInterval(() => {
            this.performPeriodicMaintenance();
        }, 10 * 60 * 1000);

        if (this.updateIntervalTimer.unref) {
            this.updateIntervalTimer.unref();
        }
    }

    performPeriodicMaintenance() {
        for (const profile of this.registry.values()) {
            // Gradually decay rolling latency towards baseline if no recent samples
            if (profile.baselineLatencyMs && profile.rollingAvgLatencyMs) {
                profile.rollingAvgLatencyMs = Math.round((profile.rollingAvgLatencyMs * 0.9) + (profile.baselineLatencyMs * 0.1));
            }
        }
        this.lastUpdated = new Date().toISOString();
    }

    stopPeriodicUpdates() {
        if (this.updateIntervalTimer) {
            clearInterval(this.updateIntervalTimer);
            this.updateIntervalTimer = null;
        }
    }
}
