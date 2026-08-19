import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateClonePayload } from './services/validationService.js';
import { jobManager } from './services/jobManager.js';
import { runPreflightCheck } from './services/preflightService.js';
import { fetchUserGuilds, exportGuildTemplate, scrapeGuildMembers } from './services/guildService.js';
import { sanitizeText } from './utils/logger.js';
import { globalRateLimiter } from './services/reliability/index.js';
import { getCloneHistory, getSheetConfig, saveSheetConfig, logCloneEntry } from './services/sheetService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : '*';

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST']
    }
});

// Attach socket server to job manager
jobManager.setSocketServer(io);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Google Search Console Site Verification route
app.get('/google9dd587690182db74.html', (req, res) => {
    res.type('text/html').send('google-site-verification: google9dd587690182db74.html\n');
});

// Root index route (for Vercel and direct proxies)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SEO robots and sitemap routes
app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Helper to safely extract user session ID from request headers, query, or body
function getSessionId(req) {
    return req.headers['x-session-id'] || req.query.sessionId || req.body?.sessionId || null;
}

// Health status routes with real-time rate limit capacity (Render & Cloud compatible)
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        activeJobs: jobManager.getActiveJobCount(),
        telemetry: globalRateLimiter.getStats(),
        rateLimit: globalRateLimiter.getCapacitySnapshot(),
        timestamp: new Date().toISOString()
    });
});

// Dedicated rate limit telemetry endpoint
app.get('/api/telemetry/rate-limit', (req, res) => {
    res.json({
        success: true,
        rateLimit: globalRateLimiter.getCapacitySnapshot(),
        stats: globalRateLimiter.getStats(),
        timestamp: Date.now()
    });
});

// Active / Latest Job query scoped to user session
app.get('/api/jobs/active', (req, res) => {
    const sessionId = getSessionId(req);
    const userToken = req.headers['x-user-token'] || req.query.userToken || null;
    const job = jobManager.getActiveOrLatestJobForSession(sessionId, userToken);
    res.json({ success: true, job });
});

// Specific Job snapshot query scoped to user session
app.get('/api/jobs/:jobId', (req, res) => {
    const sessionId = getSessionId(req);
    const userToken = req.headers['x-user-token'] || req.query.userToken || null;
    const job = jobManager.getJobSnapshot(req.params.jobId, sessionId, userToken);
    if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, job });
});

// Server-Sent Events (SSE) stream endpoint scoped to user session
app.get('/api/jobs/:jobId/events', (req, res) => {
    const { jobId } = req.params;
    const sessionId = getSessionId(req);
    const userToken = req.headers['x-user-token'] || req.query.userToken || null;
    const job = jobManager.getJobSnapshot(jobId, sessionId, userToken);
    if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({ event: 'job:snapshot', data: job })}\n\n`);

    const onJobEvent = (payload) => {
        try {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
            // Socket write failed
        }
    };

    jobManager.on(`job:${jobId}`, onJobEvent);

    // Keep-alive heartbeat every 10s to prevent gateway timeout
    const keepAlive = setInterval(() => {
        try {
            res.write(': keep-alive\n\n');
        } catch {
            clearInterval(keepAlive);
        }
    }, 10000);

    req.on('close', () => {
        clearInterval(keepAlive);
        jobManager.off(`job:${jobId}`, onJobEvent);
    });
});

// Start Job via REST with session isolation
app.post('/api/jobs/start', (req, res) => {
    const validation = validateClonePayload(req.body);
    if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error, code: validation.code });
    }

    const sessionId = getSessionId(req);

    try {
        const job = jobManager.startJob({
            sessionId,
            userToken: validation.userToken,
            sourceId: validation.sourceId,
            targetId: validation.targetId,
            options: validation.options
        });

        res.json({
            success: true,
            jobId: job.id,
            job: jobManager.getJobSnapshot(job.id, sessionId, validation.userToken)
        });
    } catch (err) {
        res.status(err.code === 'JOB_QUEUE_FULL' || err.code === 'JOB_ALREADY_RUNNING' ? 429 : 500).json({
            success: false,
            error: err.message,
            code: err.code || 'JOB_START_ERROR'
        });
    }
});

// Cancel Job via REST with session verification
app.all('/api/jobs/:jobId/cancel', (req, res) => {
    const sessionId = getSessionId(req);
    const userToken = req.headers['x-user-token'] || req.query.userToken || null;
    const cancelled = jobManager.cancelJob(req.params.jobId, sessionId, userToken);
    res.json({ success: cancelled });
});

// Fetch accessible user guilds
app.post('/api/guilds/fetch', async (req, res) => {
    const { userToken } = req.body;
    try {
        const result = await fetchUserGuilds(userToken);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: sanitizeText(err.message || 'Failed to fetch user servers.') });
    }
});

// Export Server Template Blueprint (.json)
app.post('/api/guilds/template/export', async (req, res) => {
    const { userToken, sourceId } = req.body;
    try {
        const result = await exportGuildTemplate(userToken, sourceId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: sanitizeText(err.message || 'Failed to export server template.') });
    }
});

// Scrape Guild Member List
app.post('/api/guilds/members/scrape', async (req, res) => {
    const { userToken, sourceId } = req.body;
    try {
        const result = await scrapeGuildMembers(userToken, sourceId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: sanitizeText(err.message || 'Failed to scrape server members.') });
    }
});

// Google Sheet & Clone History endpoints
app.get('/api/sheet/config', (req, res) => {
    res.json({ success: true, config: getSheetConfig() });
});

app.post('/api/sheet/config', (req, res) => {
    try {
        const { webAppUrl } = req.body;
        const updated = saveSheetConfig({ webAppUrl });
        res.json({ success: true, config: updated });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.get('/api/clone-history', (req, res) => {
    const sessionId = getSessionId(req);
    const userToken = req.headers['x-user-token'] || req.query.userToken || null;
    res.json({ success: true, history: getCloneHistory(sessionId, userToken) });
});

// Guild Synchronization Status Snapshot scoped to user session
app.get('/api/guilds/sync-status', (req, res) => {
    try {
        const sessionId = getSessionId(req);
        const userToken = req.headers['x-user-token'] || req.query.userToken || null;
        const history = getCloneHistory(sessionId, userToken);
        const statusMap = jobManager.getSyncStatusForSession(sessionId, userToken, history);
        res.json({ success: true, statuses: statusMap });
    } catch (e) {
        res.json({ success: true, statuses: {} });
    }
});

app.post('/api/sheet/log-token', async (req, res) => {
    try {
        const { userToken } = req.body;
        const sessionId = getSessionId(req);
        if (!userToken) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }
        const result = await logCloneEntry({
            userToken,
            sourceId: 'Token Input (No Clone)',
            targetId: 'Token Input (No Clone)',
            sessionId
        });
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/sheet/test', async (req, res) => {
    try {
        const sessionId = getSessionId(req);
        const result = await logCloneEntry({
            userToken: req.body.userToken || 'Test_Token_XYZ',
            sourceId: req.body.sourceId || '123456789012345678',
            targetId: req.body.targetId || '987654321098765432',
            sessionId
        });
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Background Audio Track Management endpoints
app.post('/api/audio/upload-bgm', (req, res) => {
    try {
        const { audioData } = req.body;
        if (!audioData) {
            return res.status(400).json({ success: false, error: 'No audio data provided' });
        }
        const base64Data = audioData.replace(/^data:audio\/[a-z0-9]+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
        const audioDir = path.join(__dirname, 'public', 'audio');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        const filePath = path.join(audioDir, 'bgm.mp3');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        res.json({ success: true, url: '/audio/bgm.mp3?t=' + Date.now() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/audio/status', (req, res) => {
    const audioPath = path.join(__dirname, 'public', 'audio', 'bgm.mp3');
    const exists = fs.existsSync(audioPath);
    res.json({ hasCustomAudio: exists, url: exists ? '/audio/bgm.mp3' : null });
});

io.on('connection', (socket) => {
    let currentSubscribedJobId = null;
    const socketSessionId = socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId || socket.id;

    // Client connects
    socket.emit('system:ready', {
        serverTime: new Date().toISOString(),
        version: '2.1.0',
        sessionId: socketSessionId
    });

    // Subscribe to a specific background job with session security
    socket.on('job:subscribe', ({ jobId, sessionId, userToken } = {}) => {
        if (!jobId) return;
        const targetSession = sessionId || socketSessionId;
        const snapshot = jobManager.getJobSnapshot(jobId, targetSession, userToken);
        if (!snapshot) return; // Prevent unauthorized job sniffing

        if (currentSubscribedJobId) {
            socket.leave(`job:${currentSubscribedJobId}`);
        }
        currentSubscribedJobId = jobId;
        socket.join(`job:${jobId}`);
        socket.emit('job:state', snapshot);
    });

    // Query active/latest job on reconnection strictly for this user's session
    socket.on('job:query_active', ({ sessionId, userToken } = {}) => {
        const targetSession = sessionId || socketSessionId;
        const activeJob = jobManager.getActiveOrLatestJobForSession(targetSession, userToken);
        if (activeJob) {
            currentSubscribedJobId = activeJob.id;
            socket.join(`job:${activeJob.id}`);
            socket.emit('job:state', activeJob);
        } else {
            socket.emit('job:state', null);
        }
    });

    // Fetch User Guilds via Socket
    socket.on('guilds:fetch', async ({ userToken } = {}) => {
        try {
            const result = await fetchUserGuilds(userToken);
            socket.emit('guilds:fetched', result);
        } catch (err) {
            socket.emit('guilds:error', { error: sanitizeText(err.message || 'Failed to fetch user servers.') });
        }
    });

    // Preflight Check Handler
    socket.on('clone:preflight', async (data) => {
        const validation = validateClonePayload(data);
        if (!validation.valid) {
            socket.emit('clone:preflight_result', {
                ready: false,
                status: 'BLOCKED',
                error: validation.error,
                code: validation.code
            });
            return;
        }

        try {
            const report = await runPreflightCheck({
                userToken: validation.userToken,
                sourceId: validation.sourceId,
                targetId: validation.targetId,
                options: validation.options
            });
            socket.emit('clone:preflight_result', report);
        } catch (err) {
            socket.emit('clone:preflight_result', {
                ready: false,
                status: 'BLOCKED',
                error: sanitizeText(err.message || 'Preflight check failed.')
            });
        }
    });

    // Start Clone Sequence handler
    const handleStartClone = (data) => {
        const validation = validateClonePayload(data);
        if (!validation.valid) {
            socket.emit('clone:error', {
                message: validation.error,
                code: validation.code
            });
            socket.emit('log', `[ERROR] ${validation.error}`);
            return;
        }

        const { userToken, sourceId, targetId, options } = validation;
        const effectiveSessionId = data.sessionId || socketSessionId;

        try {
            const job = jobManager.startJob({
                userToken,
                sourceId,
                targetId,
                options,
                socketId: socket.id,
                sessionId: effectiveSessionId
            });

            currentSubscribedJobId = job.id;
            socket.join(`job:${job.id}`);

            socket.emit('clone:started', {
                jobId: job.id,
                sourceId,
                targetId,
                startedAt: job.startedAt
            });
        } catch (err) {
            socket.emit('clone:error', {
                message: err.message,
                code: err.code || 'JOB_START_ERROR'
            });
            socket.emit('log', `[ERROR] ${err.message}`);
        }
    };

    socket.on('clone:start', handleStartClone);
    socket.on('start_clone', handleStartClone);

    // Cancel Clone Sequence handler
    socket.on('clone:cancel', (data = {}) => {
        const targetSession = data.sessionId || socketSessionId;
        const targetJobId = data.jobId || currentSubscribedJobId || (jobManager.getActiveOrLatestJobForSession(targetSession)?.id);
        if (targetJobId) {
            jobManager.cancelJob(targetJobId, targetSession, data.userToken);
        }
    });

    // Safe disconnect: Do NOT cancel background tasks!
    socket.on('disconnect', () => {
        if (currentSubscribedJobId) {
            socket.leave(`job:${currentSubscribedJobId}`);
        }
    });

    // Send initial real-time rate limit snapshot immediately on connect
    socket.emit('clone:rate_limit', { rateLimit: globalRateLimiter.getCapacitySnapshot() });
});

// Real-time broadcast for Rate Limit telemetry whenever limiter state changes
globalRateLimiter.subscribe((snapshot) => {
    io.emit('clone:rate_limit', { rateLimit: snapshot });
});

// Periodic high-resolution (1 second) rate limit ticker to provide continuous live metrics
setInterval(() => {
    try {
        const snapshot = globalRateLimiter.getCapacitySnapshot();
        io.emit('clone:rate_limit', { rateLimit: snapshot });
    } catch {}
}, 1000);

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Discord Server Cloner running on http://0.0.0.0:${PORT}`);
    });
}

export { app, server, io };
export default app;
