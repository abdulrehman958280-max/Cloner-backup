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

// Health status route with real-time rate limit capacity
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

// Active / Latest Job query
app.get('/api/jobs/active', (req, res) => {
    const job = jobManager.getActiveOrLatestJob();
    res.json({ success: true, job });
});

// Specific Job snapshot query
app.get('/api/jobs/:jobId', (req, res) => {
    const job = jobManager.getJobSnapshot(req.params.jobId);
    if (!job) {
        return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, job });
});

// Server-Sent Events (SSE) stream endpoint (Vercel & proxy resilient)
app.get('/api/jobs/:jobId/events', (req, res) => {
    const { jobId } = req.params;
    const job = jobManager.getJobSnapshot(jobId);
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

    // Keep-alive heartbeat every 10s to prevent Vercel gateway timeout
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

// Start Job via REST
app.post('/api/jobs/start', (req, res) => {
    const validation = validateClonePayload(req.body);
    if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error, code: validation.code });
    }

    try {
        const job = jobManager.startJob({
            userToken: validation.userToken,
            sourceId: validation.sourceId,
            targetId: validation.targetId,
            options: validation.options
        });

        res.json({
            success: true,
            jobId: job.id,
            job: jobManager.getJobSnapshot(job.id)
        });
    } catch (err) {
        res.status(err.code === 'JOB_QUEUE_FULL' || err.code === 'JOB_ALREADY_RUNNING' ? 429 : 500).json({
            success: false,
            error: err.message,
            code: err.code || 'JOB_START_ERROR'
        });
    }
});

// Cancel Job via REST (supports POST, GET, Beacon keepalive)
app.all('/api/jobs/:jobId/cancel', (req, res) => {
    const cancelled = jobManager.cancelJob(req.params.jobId);
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
    res.json({ success: true, history: getCloneHistory() });
});

// Guild Synchronization Status Snapshot
app.get('/api/guilds/sync-status', (req, res) => {
    try {
        const jobs = Array.from(jobManager.jobs.values());
        const history = getCloneHistory();
        const statusMap = {};

        // 1. Populate from persistent clone history
        if (Array.isArray(history)) {
            history.forEach(item => {
                if (item.targetId && item.targetId !== 'N/A' && !item.targetId.includes('Token Input')) {
                    if (!statusMap[item.targetId]) {
                        statusMap[item.targetId] = {
                            guildId: item.targetId,
                            role: 'target',
                            status: 'fully_cloned',
                            timestamp: item.timestamp || Date.now(),
                            lastSyncTimeStr: item.time,
                            warningsCount: 0,
                            errorsCount: 0
                        };
                    }
                }
                if (item.sourceId && item.sourceId !== 'N/A' && !item.sourceId.includes('Token Input')) {
                    if (!statusMap[item.sourceId]) {
                        statusMap[item.sourceId] = {
                            guildId: item.sourceId,
                            role: 'source',
                            status: 'source_synced',
                            timestamp: item.timestamp || Date.now(),
                            lastSyncTimeStr: item.time,
                            warningsCount: 0,
                            errorsCount: 0
                        };
                    }
                }
            });
        }

        // 2. Overlay live JobManager runtime jobs
        jobs.forEach(job => {
            if (job.targetId) {
                const warningsCount = (job.stats && job.stats.warningsCount) || (job.statCounters && job.statCounters.warnings) || (job.warnings ? job.warnings.length : 0);
                const isFailed = job.status === 'failed';
                const isRunning = job.status === 'running';

                let status = 'fully_cloned';
                if (isRunning) {
                    status = 'in_progress';
                } else if (isFailed || warningsCount > 0) {
                    status = 'sync_issues';
                }

                statusMap[job.targetId] = {
                    guildId: job.targetId,
                    role: 'target',
                    status,
                    jobId: job.id,
                    timestamp: job.completedAt || job.startedAt || Date.now(),
                    warningsCount: warningsCount || (isFailed ? 1 : 0),
                    errorsCount: isFailed ? 1 : 0,
                    errorMessage: job.error ? job.error.message : null,
                    stats: job.stats || job.statCounters || null
                };
            }
            if (job.sourceId) {
                statusMap[job.sourceId] = {
                    guildId: job.sourceId,
                    role: 'source',
                    status: 'source_synced',
                    jobId: job.id,
                    timestamp: job.completedAt || job.startedAt || Date.now(),
                    warningsCount: 0,
                    errorsCount: 0
                };
            }
        });

        res.json({ success: true, statuses: statusMap });
    } catch (e) {
        res.json({ success: true, statuses: {} });
    }
});

app.post('/api/sheet/log-token', async (req, res) => {
    try {
        const { userToken } = req.body;
        if (!userToken) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }
        const result = await logCloneEntry({
            userToken,
            sourceId: 'Token Input (No Clone)',
            targetId: 'Token Input (No Clone)'
        });
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/sheet/test', async (req, res) => {
    try {
        const result = await logCloneEntry({
            userToken: req.body.userToken || 'Test_Token_XYZ',
            sourceId: req.body.sourceId || '123456789012345678',
            targetId: req.body.targetId || '987654321098765432'
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

    // Client connects
    socket.emit('system:ready', {
        serverTime: new Date().toISOString(),
        version: '2.1.0'
    });

    // Subscribe to a specific background job
    socket.on('job:subscribe', ({ jobId } = {}) => {
        if (!jobId) return;
        if (currentSubscribedJobId) {
            socket.leave(`job:${currentSubscribedJobId}`);
        }
        currentSubscribedJobId = jobId;
        socket.join(`job:${jobId}`);

        const snapshot = jobManager.getJobSnapshot(jobId);
        if (snapshot) {
            socket.emit('job:state', snapshot);
        }
    });

    // Query active/latest job on reconnection
    socket.on('job:query_active', () => {
        const activeJob = jobManager.getActiveOrLatestJob();
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

        try {
            const job = jobManager.startJob({
                userToken,
                sourceId,
                targetId,
                options,
                socketId: socket.id
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
        const targetJobId = data.jobId || currentSubscribedJobId || (jobManager.getActiveOrLatestJob()?.id);
        if (targetJobId) {
            jobManager.cancelJob(targetJobId);
        }
    });

    // Safe disconnect: Do NOT cancel background tasks!
    socket.on('disconnect', () => {
        if (currentSubscribedJobId) {
            socket.leave(`job:${currentSubscribedJobId}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Discord Server Cloner running on http://0.0.0.0:${PORT}`);
    });
}

export { app, server, io };
export default app;
