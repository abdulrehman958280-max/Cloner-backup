import test from 'node:test';
import assert from 'node:assert/strict';
import { jobManager } from '../services/jobManager.js';

test('jobManager prevents duplicate active jobs for the same socket', async () => {
    const mockExecutor = async ({ isCancelled }) => {
        await new Promise(r => setTimeout(r, 200));
        return { rolesCreated: 1 };
    };

    const socketId = 'socket_test_123';
    const job1 = jobManager.startJob({
        userToken: 'token1',
        sourceId: '111111111111111111',
        targetId: '222222222222222222',
        options: {},
        socketId,
        executor: mockExecutor
    });

    assert.ok(job1.id);
    assert.equal(jobManager.hasActiveJobForSocket(socketId), true);

    assert.throws(
        () => {
            jobManager.startJob({
                userToken: 'token2',
                sourceId: '333333333333333333',
                targetId: '444444444444444444',
                options: {},
                socketId,
                executor: mockExecutor
            });
        },
        (err) => {
            assert.equal(err.code, 'JOB_ALREADY_RUNNING');
            return true;
        }
    );

    // Cancel job1
    jobManager.cancelJob(job1.id);
    await job1._promise;
});
