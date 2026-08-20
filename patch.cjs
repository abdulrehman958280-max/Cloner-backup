const fs = require('fs');
let content = fs.readFileSync('services/jobManager.js', 'utf8');
content = content.replace(
    'hasActiveJobForSession(sessionId) {',
    `hasActiveJobForTarget(targetId) {
        if (!targetId) return false;
        for (const job of this.jobs.values()) {
            if (job.status === 'running' && job.targetId === targetId) return true;
        }
        return false;
    }

    hasActiveJobForSession(sessionId) {`
);
content = content.replace(
    'if (socketId && this.hasActiveJobForSocket(socketId)) {',
    `if (targetId && this.hasActiveJobForTarget(targetId)) {
            const err = new Error(\`A migration job is already running for the target server.\`);
            err.code = 'JOB_ALREADY_RUNNING_TARGET';
            throw err;
        }

        if (socketId && this.hasActiveJobForSocket(socketId)) {`
);
fs.writeFileSync('services/jobManager.js', content, 'utf8');
