import test from 'node:test';
import assert from 'node:assert/strict';
import {
    analyzeSourceGuild,
    analyzeTargetGuild,
    evaluateChannelForTicket,
    checkGuildCompatibility,
    calculateMigrationScore,
    RecoveryIntelligence,
    FailedRetryQueue,
    AiChatService,
    generateIntelligenceReport,
    sanitizeAiContext,
    sanitizeSensitiveText
} from '../services/intelligence/index.js';

test('SourceGuildAnalyzer extracts structural insights and rawResources', () => {
    const mockGuild = {
        id: '123456789012345678',
        name: 'Source Community',
        channels: {
            cache: new Map([
                ['101', { id: '101', name: 'ticket-0042', type: 'GUILD_TEXT', permissionOverwrites: { cache: new Map() } }],
                ['102', { id: '102', name: 'general', type: 'GUILD_TEXT', permissionOverwrites: { cache: new Map() } }],
                ['103', { id: '103', name: 'announcements', type: 'GUILD_NEWS', permissionOverwrites: { cache: new Map() } }],
                ['104', { id: '104', name: 'Voice Lounge', type: 'GUILD_VOICE', permissionOverwrites: { cache: new Map() } }]
            ])
        },
        roles: {
            cache: new Map([
                ['201', { id: '201', name: '@everyone', managed: false, position: 0, permissions: { bitfield: 0n } }],
                ['202', { id: '202', name: 'Admin', managed: false, position: 2, permissions: { bitfield: 8n } }],
                ['203', { id: '203', name: 'Dyno', managed: true, position: 1, permissions: { bitfield: 0n } }]
            ])
        },
        emojis: { cache: new Map([['301', { id: '301', name: 'cool', animated: false }]]) },
        stickers: { cache: new Map() }
    };

    const analysis = analyzeSourceGuild(mockGuild);
    assert.equal(analysis.id, '123456789012345678');
    assert.equal(analysis.totalChannels, 4);
    assert.equal(analysis.rolesCount, 3);
    assert.equal(analysis.customRolesCount, 1);
    assert.equal(analysis.managedRolesCount, 1);
    assert.equal(analysis.emojisCount, 1);
});

test('TicketDetector identifies ephemeral ticket channels with high confidence', () => {
    const ticketChannel = { id: '101', name: 'ticket-0042', topic: 'Ticket created by user' };
    const normalChannel = { id: '102', name: 'general-chat', topic: 'General discussions' };

    const ticketResult = evaluateChannelForTicket(ticketChannel);
    assert.equal(ticketResult.isTicket, true);
    assert.ok(ticketResult.score >= 50);

    const normalResult = evaluateChannelForTicket(normalChannel);
    assert.equal(normalResult.isTicket, false);
});

test('CompatibilityEngine checks guild compatibility and capacity limits', () => {
    const sourceAnalysis = {
        guildId: '111111111111111111',
        totalChannels: 10,
        totalRoles: 5,
        emojisCount: 20,
        stickersCount: 2
    };
    const targetAnalysis = {
        guildId: '222222222222222222',
        totalChannels: 2,
        totalRoles: 1,
        missingPermissions: [],
        limits: { maxEmojis: 50, maxStickers: 5 }
    };

    const compat = checkGuildCompatibility(sourceAnalysis, targetAnalysis, { cleanTarget: true });
    assert.ok(compat.status === 'COMPATIBLE' || compat.status === 'PARTIALLY_COMPATIBLE');
    assert.equal(compat.reasons.length, 0);
});

test('MigrationScore computes multi-dimensional migration fidelity score', () => {
    const mockManifest = {
        roles: [{ originalId: '1', targetId: '10' }],
        channels: [{ originalId: '2', targetId: '20' }]
    };
    const mockVerification = {
        score: 100,
        summary: { totalChecked: 2, verifiedCount: 2, mismatchedCount: 0, missingCount: 0 },
        resourceVerifications: {
            roles: [{ id: '1', state: 'VERIFIED' }],
            channels: [{ id: '2', state: 'VERIFIED' }],
            categories: [],
            emojis: [],
            stickers: []
        }
    };

    const scoreResult = calculateMigrationScore(mockManifest, mockVerification);
    assert.equal(scoreResult.overallScore, 100);
    assert.equal(scoreResult.grade, 'A+');
    assert.equal(scoreResult.dimensions.roles, 100);
    assert.equal(scoreResult.dimensions.channels, 100);
});

test('FailedRetryQueue enqueues failed items and executes bounded retries', async () => {
    const queue = new FailedRetryQueue();
    queue.addFailed('chan_1', 'channel', 'vip-lounge', {}, new Error('RATE_LIMIT'));
    queue.addFailed('role_1', 'role', 'VIP', {}, new Error('DISCORD_500'));

    const stats = queue.getStats();
    assert.equal(stats.totalFailed, 2);
    assert.equal(stats.breakdown.channel, 1);
    assert.equal(stats.breakdown.role, 1);

    const pending = queue.getPendingRetries();
    assert.equal(pending.length, 2);
    // Role should come before channel in priority sorting
    assert.equal(pending[0].type, 'role');
    assert.equal(pending[1].type, 'channel');

    queue.removeFailed('chan_1');
    assert.equal(queue.getStats().totalFailed, 1);
});

test('AiChatService diagnoses errors and responds to migration prompts with sanitization', async () => {
    const chatService = new AiChatService();
    const mockJob = {
        id: 'job_test_1',
        status: 'running',
        stage: 'CHANNELS',
        progress: 65,
        statCounters: { channels: 10, roles: 5 },
        sourceAnalysis: { totalChannels: 12, rolesCount: 5 },
        targetAnalysis: { availableEmojiCapacity: 50 }
    };

    const res = await chatService.handleMessage('What is the current status?', 'job_test_1', mockJob);
    assert.ok(res.reply);
    assert.ok(res.reply.includes('job_test_1') || res.reply.includes('running') || res.reply.includes('channels') || res.reply.includes('Stage'));

    const sanitized = sanitizeSensitiveText('Bearer mfa.abcdef1234567890abcdef1234567890 secret_value');
    assert.ok(!sanitized.includes('mfa.abcdef'));
});

test('ReportGenerator produces structured post-migration intelligence report', () => {
    const mockJob = {
        id: 'job_audit_100',
        status: 'completed',
        startTime: Date.now() - 30000,
        endTime: Date.now(),
        sourceAnalysis: { id: '111', name: 'Source', totalChannels: 5, rolesCount: 4, emojisCount: 2 },
        targetAnalysis: { id: '222', name: 'Target', availableEmojiCapacity: 50 },
        compatibility: { status: 'COMPATIBLE', reasons: [], recommendations: ['Review webhook limits'] },
        cleanupPlan: { summary: { deletedChannels: 0, deletedRoles: 0 } },
        failedQueue: new FailedRetryQueue(),
        recoveryIntelligence: new RecoveryIntelligence(),
        verificationReport: {
            score: 100,
            summary: { totalChecked: 2, verifiedCount: 2, mismatchedCount: 0, missingCount: 0 }
        },
        migrationScore: { overallScore: 98.5, grade: 'A+' },
        warnings: []
    };

    const report = generateIntelligenceReport(mockJob);
    assert.equal(report.jobId, 'job_audit_100');
    assert.equal(report.status, 'completed');
    assert.ok(report.migrationScore.overallScore >= 90);
    assert.ok(Array.isArray(report.recommendations));
});

test('AiModelRouter initializes with prioritized OpenRouter Free models pool', async () => {
    const { AiModelRouter, CURATED_FREE_MODELS } = await import('../services/intelligence/aiModelRouter.js');
    const router = new AiModelRouter('mock-api-key');

    assert.ok(router.models.length >= 10);
    assert.ok(router.models.some(m => m.id === 'google/gemini-2.0-flash-exp:free'));
    assert.ok(router.models.some(m => m.id === 'meta-llama/llama-3.3-70b-instruct:free'));
    assert.ok(router.models.some(m => m.id === 'qwen/qwen-2.5-coder-32b-instruct:free'));

    const status = router.getModelStatus();
    assert.equal(status.isConfigured, true);
    assert.ok(status.totalFreeModels >= 10);
});

test('AiModelRouter detects 429 / 402 / 503 quota & rate limit conditions', async () => {
    const { AiModelRouter } = await import('../services/intelligence/aiModelRouter.js');
    const router = new AiModelRouter();

    const check429 = router.isQuotaOrRateLimitError(429);
    assert.equal(check429.isQuota, true);
    assert.ok(check429.cooldownMs > 0);

    const check402 = router.isQuotaOrRateLimitError(402);
    assert.equal(check402.isQuota, true);

    const checkQuotaMsg = router.isQuotaOrRateLimitError(200, { error: { message: 'free model daily quota exceeded' } });
    assert.equal(checkQuotaMsg.isQuota, true);

    const checkNormal = router.isQuotaOrRateLimitError(200, {});
    assert.equal(checkNormal.isQuota, false);
});

test('AiModelRouter automatically cascades and switches to next best free model on quota exhaustion', async () => {
    const { AiModelRouter } = await import('../services/intelligence/aiModelRouter.js');
    const router = new AiModelRouter('mock-api-key');

    let fetchCallCount = 0;
    const originalFetch = global.fetch;

    global.fetch = async (url, opts) => {
        fetchCallCount++;
        const body = JSON.parse(opts.body || '{}');

        // First model (e.g. Gemini) returns 429 Too Many Requests (Quota Full)
        if (body.model === 'google/gemini-2.0-flash-exp:free') {
            return {
                ok: false,
                status: 429,
                json: async () => ({ error: { message: 'Rate limit exceeded: 0 remaining credits' } }),
                text: async () => 'Rate limit exceeded'
            };
        }

        // Second model (e.g. Gemini thinking or Llama 3.3 70B) succeeds
        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [{ message: { content: 'AI analysis successful on failover model.' } }]
            })
        };
    };

    try {
        const result = await router.executePrompt([{ role: 'user', content: 'Test auto switch' }]);
        assert.equal(result.success, true);
        assert.equal(result.autoSwitched, true);
        assert.ok(result.failoverChain && result.failoverChain.length >= 1);
        assert.equal(result.failoverChain[0].fromModel, 'google/gemini-2.0-flash-exp:free');
        assert.notEqual(result.modelUsed, 'google/gemini-2.0-flash-exp:free');
        assert.equal(result.text, 'AI analysis successful on failover model.');
    } finally {
        global.fetch = originalFetch;
    }
});

