/**
 * Clone Intelligence - Neural AI Model Router
 * Dynamic multi-model router supporting all neural free LLMs with
 * automatic quota-exhaustion / rate-limit detection, instant auto-failover
 * to the next best available free model, health tracking, and graceful deterministic fallback.
 */

import { sanitizeAiContext } from './sanitizer.js';
import { ModelCapabilityRegistry, TASK_TYPES } from './modelCapabilityRegistry.js';
import { createLogEntry } from '../../utils/logger.js';
import { GoogleGenAI } from '@google/genai';

// Curated pool of top Neural Free Models ranked by capability and reliability tier
export const CURATED_FREE_MODELS = [
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash (Free)',
        category: 'fast_reasoning',
        tier: 1,
        contextWindow: 1048576,
        reliabilityScore: 0.98,
        description: 'Ultra-fast multimodal reasoning with massive 1M context window'
    },
    {
        id: 'google/gemini-2.0-flash-thinking-exp:free',
        name: 'Gemini 2.0 Flash Thinking (Free)',
        category: 'deep_reasoning',
        tier: 1,
        contextWindow: 1048576,
        reliabilityScore: 0.96,
        description: 'Advanced step-by-step thinking model for complex diagnostics'
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B Instruct (Free)',
        category: 'deep_analysis',
        tier: 1,
        contextWindow: 131072,
        reliabilityScore: 0.97,
        description: 'State-of-the-art 70B open weights model for comprehensive analysis'
    },
    {
        id: 'qwen/qwen-2.5-coder-32b-instruct:free',
        name: 'Qwen 2.5 Coder 32B (Free)',
        category: 'structured_json',
        tier: 2,
        contextWindow: 32768,
        reliabilityScore: 0.95,
        description: 'Specialized for code generation, structural schema validation and diffing'
    },
    {
        id: 'qwen/qwen-2.5-72b-instruct:free',
        name: 'Qwen 2.5 72B Instruct (Free)',
        category: 'deep_analysis',
        tier: 1,
        contextWindow: 131072,
        reliabilityScore: 0.94,
        description: 'Flagship multilingual reasoning and comprehensive instruction following'
    },
    {
        id: 'mistralai/mistral-small-24b-instruct-2501:free',
        name: 'Mistral Small 24B (Free)',
        category: 'fast_reasoning',
        tier: 2,
        contextWindow: 32768,
        reliabilityScore: 0.93,
        description: 'Fast, compact 24B model optimized for high throughput reasoning'
    },
    {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1 (Free)',
        category: 'deep_reasoning',
        tier: 1,
        contextWindow: 65536,
        reliabilityScore: 0.91,
        description: 'Reinforcement-learning reasoning model for root-cause error diagnosis'
    },
    {
        id: 'deepseek/deepseek-chat:free',
        name: 'DeepSeek V3 (Free)',
        category: 'fast_reasoning',
        tier: 2,
        contextWindow: 65536,
        reliabilityScore: 0.90,
        description: 'High-speed conversational architecture for migration support'
    },
    {
        id: 'meta-llama/llama-3.1-8b-instruct:free',
        name: 'Llama 3.1 8B Instruct (Free)',
        category: 'fast_reasoning',
        tier: 3,
        contextWindow: 131072,
        reliabilityScore: 0.89,
        description: 'Lightweight, rapid response model with 128k context'
    },
    {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B Instruct (Free)',
        category: 'lightweight',
        tier: 4,
        contextWindow: 131072,
        reliabilityScore: 0.87,
        description: 'Ultra-low latency model for simple status checks and quick queries'
    },
    {
        id: 'microsoft/phi-3-medium-128k-instruct:free',
        name: 'Phi-3 Medium 128K (Free)',
        category: 'structured_json',
        tier: 3,
        contextWindow: 128000,
        reliabilityScore: 0.86,
        description: 'Compact model with expansive 128k window for JSON context'
    },
    {
        id: 'nousresearch/hermes-3-llama-3.1-405b:free',
        name: 'Hermes 3 Llama 405B (Free)',
        category: 'deep_analysis',
        tier: 1,
        contextWindow: 131072,
        reliabilityScore: 0.85,
        description: 'Ultra-large 405B parameter model for complex planning'
    }
];

export const DEFAULT_FREE_MODELS = CURATED_FREE_MODELS;

export class AiModelRouter {
    constructor(apiKey = process.env.NEURAL_AI_API_KEY || process.env.OPENROUTER_API_KEY) {
        this.apiKey = apiKey || null;
        this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
        this.genaiClient = null;
        if (this.geminiApiKey) {
            try {
                this.genaiClient = new GoogleGenAI({ apiKey: this.geminiApiKey });
            } catch (e) {
                this.genaiClient = null;
            }
        }
        this.capabilityRegistry = new ModelCapabilityRegistry();
        this.models = [...CURATED_FREE_MODELS];
        this.modelHealth = new Map(); // modelId -> HealthState
        this.activeModel = this.geminiApiKey ? 'google/gemini-2.0-flash' : (this.models[0]?.id || 'google/gemini-2.0-flash-exp:free');
        this.autoFailoverEnabled = true;
        this.recentFailovers = []; // History of auto-switches: [ { timestamp, from, to, reason } ]
        this.isFetchingLiveModels = false;
        this.lastLiveSyncAt = null;
        this.telemetryListeners = new Set(); // (event, jobId) => void
        this.thinkingListeners = new Set(); // (event, jobId) => void

        // Initialize health for default models
        this.models.forEach(m => {
            this.initModelHealth(m.id);
        });

        // Trigger asynchronous live discovery of all available free models if key exists
        if (this.isAiAvailable()) {
            this.fetchLiveFreeModels().catch(() => {});
        }
    }

    addTelemetryListener(listener) {
        if (typeof listener === 'function') {
            this.telemetryListeners.add(listener);
        }
    }

    removeTelemetryListener(listener) {
        this.telemetryListeners.delete(listener);
    }

    addThinkingListener(listener) {
        if (typeof listener === 'function') {
            this.thinkingListeners.add(listener);
        }
    }

    removeThinkingListener(listener) {
        this.thinkingListeners.delete(listener);
    }

    emitThinkingTelemetry(event, jobId = null) {
        for (const listener of this.thinkingListeners) {
            try {
                listener(event, jobId);
            } catch (e) {}
        }
    }

    emitFailoverTelemetry(event, jobId = null) {
        // Log to console
        console.log(`[AI Auto-Failover] ⚡ Switched: ${event.fromName || event.fromModel} → ${event.toName || event.toModel} (Reason: ${event.reason})`);

        // Notify active listeners
        for (const listener of this.telemetryListeners) {
            try {
                listener(event, jobId);
            } catch (e) {
                // Ignore listener error
            }
        }
    }

    initModelHealth(modelId) {
        if (!this.modelHealth.has(modelId)) {
            this.modelHealth.set(modelId, {
                status: 'available', // 'available' | 'rate_limited' | 'quota_exhausted' | 'cooling_down' | 'error'
                successCount: 0,
                failureCount: 0,
                quotaFullCount: 0,
                avgLatencyMs: 350,
                cooldownUntil: 0,
                lastUsedAt: null,
                lastError: null
            });
        }
    }

    setApiKey(key) {
        this.apiKey = key ? key.trim() : null;
        if (key && (key.startsWith('AIza') || key.includes('gemini'))) {
            this.geminiApiKey = key.trim();
            try {
                this.genaiClient = new GoogleGenAI({ apiKey: this.geminiApiKey });
            } catch (e) {
                this.genaiClient = null;
            }
        }
        if (this.isAiAvailable()) {
            this.fetchLiveFreeModels().catch(() => {});
        }
    }

    isAiAvailable() {
        return Boolean((this.geminiApiKey && this.geminiApiKey.trim().length > 0) || (this.apiKey && this.apiKey.trim().length > 0));
    }

    /**
     * Dynamically fetches all available :free models directly from OpenRouter API
     */
    async fetchLiveFreeModels() {
        if (this.isFetchingLiveModels) return this.models;
        this.isFetchingLiveModels = true;

        try {
            const headers = {
                'HTTP-Referer': 'https://discloner.local',
                'X-Title': 'Discloner Clone Intelligence'
            };
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const res = await fetch('https://openrouter.ai/api/v1/models', {
                headers,
                signal: AbortSignal.timeout(10000)
            });

            if (!res.ok) {
                this.isFetchingLiveModels = false;
                return this.models;
            }

            const data = await res.json();
            const liveModels = Array.isArray(data?.data) ? data.data : [];

            // Filter all free models: id ends with :free or prompt pricing is 0
            const discoveredFree = liveModels.filter(m => {
                const isFreeId = typeof m.id === 'string' && m.id.endsWith(':free');
                const isFreePrice = m.pricing && (m.pricing.prompt === '0' || m.pricing.prompt === 0) && (m.pricing.completion === '0' || m.pricing.completion === 0);
                return isFreeId || isFreePrice;
            });

            if (discoveredFree.length > 0) {
                const mergedMap = new Map();

                // 1. Add curated models first to retain rich metadata
                CURATED_FREE_MODELS.forEach(m => mergedMap.set(m.id, m));

                // 2. Merge dynamically discovered free models
                discoveredFree.forEach(m => {
                    if (!mergedMap.has(m.id)) {
                        const is70B = m.id.includes('70b') || m.id.includes('405b') || m.id.includes('r1') || m.id.includes('gemini-2');
                        const is32B = m.id.includes('32b') || m.id.includes('24b') || m.id.includes('coder');
                        const is8B = m.id.includes('8b') || m.id.includes('7b') || m.id.includes('14b');
                        const tier = is70B ? 1 : (is32B ? 2 : (is8B ? 3 : 4));

                        const modelObj = {
                            id: m.id,
                            name: m.name || m.id.split('/').pop().replace(':free', ''),
                            category: m.id.includes('coder') ? 'structured_json' : 'general',
                            tier,
                            contextWindow: m.context_length || 32768,
                            reliabilityScore: tier === 1 ? 0.92 : (tier === 2 ? 0.88 : 0.84),
                            description: m.description || `OpenRouter Free Model (${m.id})`
                        };

                        mergedMap.set(m.id, modelObj);
                        this.capabilityRegistry.registerModel(m.id, {
                            contextWindow: m.context_length || 32768,
                            structuredOutputSupport: m.id.includes('coder') ? 0.98 : (tier === 1 ? 0.94 : 0.88),
                            reasoningDepth: tier === 1 ? 0.95 : 0.86,
                            nativeJsonMode: true,
                            baselineLatencyMs: tier === 4 ? 200 : (tier === 3 ? 350 : 500)
                        });
                    }
                });

                // Sort models: Tier 1 -> Tier 2 -> Tier 3 -> Tier 4, then by reliability score
                this.models = Array.from(mergedMap.values()).sort((a, b) => {
                    if (a.tier !== b.tier) return a.tier - b.tier;
                    return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
                });

                // Ensure health tracking initialized for all discovered models
                this.models.forEach(m => this.initModelHealth(m.id));
                this.lastLiveSyncAt = new Date().toISOString();
            }
        } catch (err) {
            // Silently retain curated models if live sync fails
        } finally {
            this.isFetchingLiveModels = false;
        }

        return this.models;
    }

    /**
     * Identifies if an HTTP response or error represents a Quota Exhausted / Rate Limit condition
     */
    isQuotaOrRateLimitError(status, errorBody = {}) {
        if (status === 429) return { isQuota: true, reason: '429 Rate Limit Reached', cooldownMs: 120000 };
        if (status === 402) return { isQuota: true, reason: '402 Daily Free Quota Exceeded', cooldownMs: 600000 };
        if (status === 503 || status === 502) return { isQuota: true, reason: '503 Provider Overloaded / Unavailable', cooldownMs: 60000 };

        const msg = (typeof errorBody === 'string' ? errorBody : (errorBody?.error?.message || errorBody?.message || '')).toLowerCase();
        
        if (msg.includes('quota') || msg.includes('credit') || msg.includes('exhausted') || msg.includes('insufficient')) {
            return { isQuota: true, reason: 'Quota Exhausted', cooldownMs: 300000 };
        }
        if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('capacity') || msg.includes('busy')) {
            return { isQuota: true, reason: 'Model Rate Limited', cooldownMs: 120000 };
        }
        if (msg.includes('no endpoints available') || msg.includes('provider error') || msg.includes('overloaded')) {
            return { isQuota: true, reason: 'Provider Overloaded', cooldownMs: 60000 };
        }

        return { isQuota: false, reason: null, cooldownMs: 0 };
    }

    /**
     * Returns an ordered list of candidate models ranked by task suitability from the capability registry
     */
    getCandidateModels(taskType = TASK_TYPES.SIMPLE, constraints = {}) {
        const now = Date.now();

        // 1. Recover any models whose cooldown has elapsed
        this.models.forEach(m => {
            const health = this.modelHealth.get(m.id);
            if (health && health.status !== 'available' && health.cooldownUntil > 0 && now >= health.cooldownUntil) {
                health.status = 'available';
                health.cooldownUntil = 0;
            }
        });

        // 2. Filter available models
        const available = this.models.filter(m => {
            const health = this.modelHealth.get(m.id);
            return health ? health.status === 'available' : true;
        });

        // If all are temporarily on cooldown, pick the top 3 with earliest cooldown expiration
        if (available.length === 0) {
            const sortedByCooldown = [...this.models].sort((a, b) => {
                const hA = this.modelHealth.get(a.id)?.cooldownUntil || 0;
                const hB = this.modelHealth.get(b.id)?.cooldownUntil || 0;
                return hA - hB;
            });
            return this.capabilityRegistry.rankModelsForTask(sortedByCooldown.slice(0, 3), taskType, constraints);
        }

        // Rank available models intelligently according to task type (simple vs complex vs json)
        return this.capabilityRegistry.rankModelsForTask(available, taskType, constraints);
    }

    /**
     * Executes a chat prompt against OpenRouter with automatic multi-model fallback & quota auto-switching
     * @param {Array} messages Conversation messages array
     * @param {Object} options Generation options (taskType, jsonMode, timeoutMs, maxTokens, temperature, jobId)
     * @returns {Promise<Object>} Response object with text, modelUsed, failoverChain, latencyMs, or deterministic fallback
     */
    async executePrompt(messages, options = {}) {
        if (!this.isAiAvailable()) {
            return {
                success: false,
                isAiAvailable: false,
                fallbackToDeterministic: true,
                text: null,
                error: 'Neural API key not configured. Operating in full deterministic mode.'
            };
        }

        const taskType = options.taskType || (options.jsonMode ? TASK_TYPES.STRUCTURED_JSON : TASK_TYPES.SIMPLE);
        const candidateModels = this.getCandidateModels(taskType, options);
        const failoverChain = [];

        // 1. Try Native Google GenAI SDK if gemini key is active
        if (this.genaiClient) {
            const startTime = Date.now();
            try {
                this.emitThinkingTelemetry({
                    state: 'analyzing',
                    step: 'Analyzing migration state with Google Gemini 2.0 Flash...',
                    modelId: 'google/gemini-2.0-flash',
                    modelName: 'Gemini 2.0 Flash (Native SDK)',
                    attempt: 1,
                    taskType
                }, options.jobId);

                const sysMsg = messages.find(m => m.role === 'system')?.content || '';
                const userMsgs = messages.filter(m => m.role !== 'system').map(m => m.content).join('\n\n');
                const fullPrompt = sysMsg ? `${sysMsg}\n\n${userMsgs}` : userMsgs;

                const response = await this.genaiClient.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: fullPrompt,
                    config: {
                        temperature: options.temperature ?? 0.3,
                        maxOutputTokens: options.maxTokens ?? 1024,
                        responseMimeType: options.jsonMode ? 'application/json' : undefined
                    }
                });

                const latencyMs = Date.now() - startTime;
                const text = response.text || '';

                if (text || options.allowEmpty) {
                    this.activeModel = 'google/gemini-2.0-flash';
                    this.emitThinkingTelemetry({
                        state: 'completed',
                        step: 'Analysis complete with Gemini 2.0 Flash.',
                        modelId: 'google/gemini-2.0-flash',
                        modelName: 'Gemini 2.0 Flash (Native SDK)',
                        latencyMs
                    }, options.jobId);

                    return {
                        success: true,
                        isAiAvailable: true,
                        fallbackToDeterministic: false,
                        text,
                        modelUsed: 'google/gemini-2.0-flash',
                        modelName: 'Gemini 2.0 Flash',
                        modelCategory: 'native_genai',
                        latencyMs,
                        failoverChain: null,
                        autoSwitched: false,
                        taskType
                    };
                }
            } catch (err) {
                failoverChain.push({
                    timestamp: new Date().toISOString(),
                    fromModel: 'google/gemini-2.0-flash',
                    fromName: 'Gemini 2.0 Flash (Native SDK)',
                    toModel: candidateModels[0]?.id || 'OpenRouter Cascade',
                    toName: candidateModels[0]?.name || 'OpenRouter Free Pool',
                    reason: err.message || 'Gemini API call failed',
                    statusCode: 500,
                    taskType
                });
            }
        }

        for (let i = 0; i < candidateModels.length; i++) {
            const currentModel = candidateModels[i];
            const startTime = Date.now();

            this.emitThinkingTelemetry({
                state: 'analyzing',
                step: `Analyzing migration state with ${currentModel.name}...`,
                modelId: currentModel.id,
                modelName: currentModel.name,
                attempt: i + 1,
                totalCandidates: candidateModels.length,
                taskType
            }, options.jobId);

            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://discloner.local',
                        'X-Title': 'Discloner Clone Intelligence'
                    },
                    body: JSON.stringify({
                        model: currentModel.id,
                        messages: messages,
                        temperature: options.temperature ?? 0.3,
                        max_tokens: options.maxTokens ?? 1024,
                        response_format: options.jsonMode ? { type: 'json_object' } : undefined
                    }),
                    signal: AbortSignal.timeout(options.timeoutMs || 18000)
                });

                const latencyMs = Date.now() - startTime;

                if (!response.ok) {
                    const rawError = await response.json().catch(async () => ({ message: await response.text().catch(() => '') }));
                    const quotaCheck = this.isQuotaOrRateLimitError(response.status, rawError);

                    if (quotaCheck.isQuota) {
                        this.recordQuotaExhaustion(currentModel.id, quotaCheck.reason, quotaCheck.cooldownMs);
                        this.capabilityRegistry.recordExecutionMetric(currentModel.id, {
                            latencyMs,
                            success: false,
                            error: quotaCheck.reason,
                            isStructuredOutput: Boolean(options.jsonMode)
                        });
                        
                        const nextModel = candidateModels[i + 1];
                        const failoverEvent = {
                            timestamp: new Date().toISOString(),
                            fromModel: currentModel.id,
                            fromName: currentModel.name,
                            toModel: nextModel ? nextModel.id : 'Deterministic Engine',
                            toName: nextModel ? nextModel.name : 'Deterministic Rule Engine',
                            reason: quotaCheck.reason,
                            statusCode: response.status,
                            taskType
                        };

                        failoverChain.push(failoverEvent);
                        this.recordFailover(failoverEvent);
                        this.emitFailoverTelemetry(failoverEvent, options.jobId);
                        this.emitThinkingTelemetry({
                            state: 'switching',
                            step: `Quota exceeded on ${currentModel.name} (${quotaCheck.reason}). Auto-switching to ${nextModel ? nextModel.name : 'Deterministic Engine'}...`,
                            fromModel: currentModel.id,
                            fromName: currentModel.name,
                            toModel: nextModel ? nextModel.id : 'deterministic',
                            toName: nextModel ? nextModel.name : 'Deterministic Rule Engine',
                            reason: quotaCheck.reason
                        }, options.jobId);

                        // Auto-switch immediately to next best model in candidate sequence
                        continue;
                    }

                    // Non-quota HTTP error
                    this.recordFailure(currentModel.id, `HTTP ${response.status}: ${JSON.stringify(rawError)}`);
                    this.capabilityRegistry.recordExecutionMetric(currentModel.id, {
                        latencyMs,
                        success: false,
                        error: `HTTP ${response.status}`,
                        isStructuredOutput: Boolean(options.jsonMode)
                    });
                    continue;
                }

                const data = await response.json();
                const replyText = data.choices?.[0]?.message?.content || '';

                if (!replyText && !options.allowEmpty) {
                    this.recordFailure(currentModel.id, 'Empty response from model');
                    continue;
                }

                this.recordSuccess(currentModel.id, latencyMs);
                this.capabilityRegistry.recordExecutionMetric(currentModel.id, {
                    latencyMs,
                    success: true,
                    isStructuredOutput: Boolean(options.jsonMode)
                });
                this.activeModel = currentModel.id;

                this.emitThinkingTelemetry({
                    state: 'completed',
                    step: `Analysis complete with ${currentModel.name}.`,
                    modelId: currentModel.id,
                    modelName: currentModel.name,
                    latencyMs
                }, options.jobId);

                return {
                    success: true,
                    isAiAvailable: true,
                    fallbackToDeterministic: false,
                    text: replyText,
                    modelUsed: currentModel.id,
                    modelName: currentModel.name,
                    modelCategory: currentModel.category,
                    latencyMs,
                    failoverChain: failoverChain.length > 0 ? failoverChain : null,
                    autoSwitched: failoverChain.length > 0,
                    taskType
                };
            } catch (err) {
                const latencyMs = Date.now() - startTime;
                const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
                const reason = isTimeout ? 'Request Timeout (18s)' : (err.message || 'Network Disconnect');
                
                this.recordQuotaExhaustion(currentModel.id, reason, 60000);
                this.capabilityRegistry.recordExecutionMetric(currentModel.id, {
                    latencyMs,
                    success: false,
                    error: reason,
                    isStructuredOutput: Boolean(options.jsonMode)
                });

                const nextModel = candidateModels[i + 1];
                const failoverEvent = {
                    timestamp: new Date().toISOString(),
                    fromModel: currentModel.id,
                    fromName: currentModel.name,
                    toModel: nextModel ? nextModel.id : 'Deterministic Engine',
                    toName: nextModel ? nextModel.name : 'Deterministic Rule Engine',
                    reason: reason,
                    statusCode: isTimeout ? 408 : 0,
                    taskType
                };

                failoverChain.push(failoverEvent);
                this.recordFailover(failoverEvent);
                this.emitFailoverTelemetry(failoverEvent, options.jobId);
                // Continue to next model in candidate sequence
            }
        }

        // All models in the free cascade were exhausted or failed -> safe deterministic fallback
        return {
            success: false,
            isAiAvailable: true,
            fallbackToDeterministic: true,
            text: null,
            failoverChain,
            error: 'All neural models reached their quota or were rate-limited. Gracefully operating in deterministic mode.'
        };
    }

    recordSuccess(modelId, latencyMs) {
        const health = this.modelHealth.get(modelId);
        if (health) {
            health.status = 'available';
            health.successCount++;
            health.avgLatencyMs = Math.round((health.avgLatencyMs * 0.7) + (latencyMs * 0.3));
            health.lastUsedAt = new Date().toISOString();
            health.lastError = null;
            health.cooldownUntil = 0;
        }
    }

    recordQuotaExhaustion(modelId, reason, cooldownMs = 120000) {
        const health = this.modelHealth.get(modelId);
        if (health) {
            health.status = 'quota_exhausted';
            health.quotaFullCount++;
            health.failureCount++;
            health.cooldownUntil = Date.now() + cooldownMs;
            health.lastError = reason;
            health.lastUsedAt = new Date().toISOString();
        }
    }

    recordFailure(modelId, errorMessage) {
        const health = this.modelHealth.get(modelId);
        if (health) {
            health.failureCount++;
            health.lastError = errorMessage;
            health.lastUsedAt = new Date().toISOString();
            if (health.failureCount > 2) {
                health.status = 'cooling_down';
                health.cooldownUntil = Date.now() + 60000;
            }
        }
    }

    recordFailover(event) {
        this.recentFailovers.unshift(event);
        if (this.recentFailovers.length > 20) {
            this.recentFailovers.pop();
        }
    }

    /**
     * Returns full diagnostic status of all OpenRouter Free models, active selection, and auto-failovers
     */
    getModelStatus() {
        const now = Date.now();
        return {
            isConfigured: this.isAiAvailable(),
            autoFailoverEnabled: this.autoFailoverEnabled,
            activeModel: this.activeModel,
            totalFreeModels: this.models.length,
            lastLiveSyncAt: this.lastLiveSyncAt,
            recentFailovers: this.recentFailovers.slice(0, 5),
            models: this.models.map(m => {
                const health = this.modelHealth.get(m.id) || {};
                const isCooling = health.cooldownUntil > now;
                const cooldownRemainingSec = isCooling ? Math.ceil((health.cooldownUntil - now) / 1000) : 0;

                return {
                    id: m.id,
                    name: m.name,
                    tier: m.tier || 3,
                    category: m.category || 'general',
                    contextWindow: m.contextWindow || 32768,
                    description: m.description || '',
                    status: isCooling ? 'quota_exhausted' : (health.status || 'available'),
                    cooldownRemainingSec,
                    successCount: health.successCount || 0,
                    quotaFullCount: health.quotaFullCount || 0,
                    failureCount: health.failureCount || 0,
                    avgLatencyMs: health.avgLatencyMs || 350,
                    lastError: health.lastError || null
                };
            })
        };
    }
}
