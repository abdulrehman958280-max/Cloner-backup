import test from 'node:test';
import assert from 'node:assert/strict';
import { jobManager } from '../services/jobManager.js';

test('jobManager creates detached background job and generates valid snapshot', async () => {
    const mockExecutor = async ({ onStage, onProgress, onLog }) => {
        onStage('initializing', 'Initializing', 5);
        onProgress(50, 1, 2, 'Role 1');
        onLog({ type: 'success', message: 'Role created' });
        return { durationMs: 120, rolesCreated: 1 };
    };

    const job = jobManager.startJob({
        userToken: 'fake-token-test-12345678901234567890',
        sourceId: '110293847561829401',
        targetId: '129384756102938475',
        options: { cleanTarget: true },
        executor: mockExecutor
    });

    assert.ok(job.id.startsWith('job_'));
    assert.equal(job.sourceId, '110293847561829401');
    assert.equal(job.targetId, '129384756102938475');

    await job._promise;

    const snapshot = jobManager.getJobSnapshot(job.id);
    assert.ok(snapshot);
    assert.equal(snapshot.id, job.id);
    assert.equal(snapshot.status, 'completed');
    assert.ok(Array.isArray(snapshot.logs));
    assert.ok(snapshot.statCounters);
});

test('jobManager cancels active job properly', async () => {
    let cancelResolved = false;
    const mockExecutor = async ({ isCancelled }) => {
        for (let i = 0; i < 20; i++) {
            if (isCancelled()) {
                cancelResolved = true;
                throw new Error('Operation was cancelled by user.');
            }
            await new Promise(r => setTimeout(r, 10));
        }
    };

    const job = jobManager.startJob({
        userToken: 'fake-token-test-12345678901234567890',
        sourceId: '110293847561829401',
        targetId: '129384756102938475',
        options: { cleanTarget: true },
        executor: mockExecutor
    });

    assert.equal(job.status, 'running');
    const cancelled = jobManager.cancelJob(job.id);
    assert.equal(cancelled, true);

    await job._promise;

    const snapshot = jobManager.getJobSnapshot(job.id);
    assert.equal(snapshot.isCancelled, true);
    assert.equal(snapshot.status, 'cancelled');
    assert.equal(cancelResolved, true);
});


