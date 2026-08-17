import test from 'node:test';
import assert from 'node:assert/strict';
import {
    executeDiscordOperation,
    OPERATION_POLICIES,
    withTimeout,
    ERROR_CATEGORIES
} from '../services/reliability/index.js';
import { MigrationManifest } from '../services/manifest.js';
import { VERIFICATION_STATUSES } from '../services/configContract.js';

test('withTimeout properly times out an unresolving hanging promise', async () => {
    const hangingPromise = new Promise(() => {});

    await assert.rejects(
        async () => {
            await withTimeout(hangingPromise, 50, {
                operationName: 'test_hanging',
                resourceType: 'role'
            });
        },
        (err) => {
            assert.equal(err.code, ERROR_CATEGORIES.TIMEOUT);
            assert.match(err.message, /timed out/i);
            return true;
        }
    );
});

test('executeDiscordOperation terminates hanging Discord execution via bounded operationTimeoutMs', async () => {
    const startTime = Date.now();

    await assert.rejects(
        async () => {
            await executeDiscordOperation({
                operationName: 'create_role_hanging_test',
                resourceType: 'role',
                resourceId: 'role_hang_1',
                policy: { maxAttempts: 1, baseDelayMs: 20 },
                operationTimeoutMs: 80, // Hard 80ms timeout
                execute: async () => {
                    // Simulates stalled Discord.js REST call that never resolves
                    return new Promise(() => {});
                }
            });
        },
        (err) => {
            assert.equal(err.code, ERROR_CATEGORIES.TIMEOUT);
            return true;
        }
    );

    const elapsed = Date.now() - startTime;
    assert.ok(elapsed < 1000, `Operation should timeout promptly (elapsed: ${elapsed}ms)`);
});

test('executeDiscordOperation isolates hanging checkIdempotency without deadlocking', async () => {
    let executeCalled = false;

    const result = await executeDiscordOperation({
        operationName: 'create_role_idemp_hang',
        resourceType: 'role',
        policy: { maxAttempts: 2, baseDelayMs: 20 },
        operationTimeoutMs: 150,
        checkIdempotency: async () => {
            // Idempotency check that hangs forever
            return new Promise(() => {});
        },
        execute: async ({ attempt }) => {
            if (attempt === 1) {
                const err = new Error('Socket drop');
                err.code = 'ECONNRESET';
                throw err;
            }
            executeCalled = true;
            return { id: 'role_rescued', name: 'RescuedRole' };
        }
    });

    assert.equal(executeCalled, true);
    assert.equal(result.id, 'role_rescued');
});

test('Role cloning stage never deadlocks: hanging role is skipped with status timedOut, remaining roles succeed', async () => {
    const manifest = new MigrationManifest('guild_src_1', 'guild_tgt_1');
    
    const sourceRoles = [
        { id: 'src_r1', name: 'Admin', position: 1, managed: false },
        { id: 'src_r2', name: 'StalledRole', position: 2, managed: false }, // Will hang
        { id: 'src_r3', name: 'Member', position: 3, managed: false }
    ];

    manifest.roles.planned = sourceRoles.length;
    const stagesVisited = [];
    const progressUpdates = [];

    const onStage = (stage, label, pct) => {
        stagesVisited.push({ stage, label, pct });
    };

    const onProgress = (pct, current, total, item) => {
        progressUpdates.push({ pct, current, total, item });
    };

    onStage('cloning_roles', 'Cloning Roles & Hierarchy', 42);

    const createdRolesForPositioning = [];
    let roleIdx = 0;
    const totalRoles = sourceRoles.length;

    for (const role of sourceRoles) {
        roleIdx++;
        const roleStartTime = Date.now();

        try {
            const created = await executeDiscordOperation({
                operationName: 'create_role_sim',
                resourceType: 'role',
                resourceId: role.id,
                policy: { maxAttempts: 1, baseDelayMs: 10 },
                operationTimeoutMs: 60, // 60ms timeout for test speed
                execute: async () => {
                    if (role.name === 'StalledRole') {
                        // Hanging Discord.js promise simulation
                        return new Promise(() => {});
                    }
                    return { id: `tgt_${role.id}`, name: role.name };
                }
            });

            if (created) {
                manifest.recordRole(role, created, 'created', null, { durationMs: Date.now() - roleStartTime });
                createdRolesForPositioning.push({ role: created, sourcePos: role.position });
            }
        } catch (roleErr) {
            const isTimeout = roleErr.code === 'TIMEOUT' || (roleErr.message && roleErr.message.includes('timed out'));
            manifest.recordRole(role, null, isTimeout ? 'timedOut' : 'failed', roleErr, { durationMs: Date.now() - roleStartTime });
            // Continue on error: Pipeline does NOT stop!
        } finally {
            const currentPct = 42 + Math.round((roleIdx / Math.max(1, totalRoles)) * 10);
            onProgress(currentPct, roleIdx, totalRoles, `@${role.name}`);
        }
    }

    // Role stage finished -> Proceeds to hierarchy restoration stage!
    onStage('restoring_role_hierarchy', 'Restoring Role Hierarchy Positions', 52);
    
    // Hierarchy adjustment
    const validPositions = createdRolesForPositioning.map((item, idx) => ({ role: item.role.id, position: idx + 1 }));
    assert.equal(validPositions.length, 2); // Admin and Member (StalledRole excluded safely)

    // Next stage starts without obstruction!
    onStage('cloning_categories', 'Building Category Containers', 58);

    // Verify final stats & isolation
    assert.equal(manifest.roles.created, 2, 'Roles Admin and Member created');
    assert.equal(manifest.roles.failed, 1, 'StalledRole counted in failed/timedOut count');
    assert.equal(manifest.roles.timedOut, 1, 'StalledRole recorded as timedOut');
    assert.equal(manifest.telemetry.timeoutCount, 1);
    assert.equal(manifest.roleMap.get('src_r1'), 'tgt_src_r1');
    assert.equal(manifest.roleMap.get('src_r3'), 'tgt_src_r3');
    assert.equal(manifest.roleMap.has('src_r2'), false);

    assert.ok(stagesVisited.some(s => s.stage === 'cloning_roles'));
    assert.ok(stagesVisited.some(s => s.stage === 'restoring_role_hierarchy'));
    assert.ok(stagesVisited.some(s => s.stage === 'cloning_categories'));
    assert.equal(progressUpdates.length, 3);
});
