import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CleanerPolicy,
    createCleanupPlan,
    executeCleanupPlan,
    verifyCleanupState,
    verifyRoleCleanupState
} from '../services/cleaner/index.js';
import { CLEANUP_MODES } from '../services/configContract.js';

test('CleanerPolicy protects @everyone, managed bot roles, and higher hierarchy roles', () => {
    const policy = new CleanerPolicy(CLEANUP_MODES.FULL);

    const everyone = { id: 'guild_1', name: '@everyone', position: 0, managed: false, guild: { id: 'guild_1' } };
    const botRole = { id: 'role_bot', name: 'BotRole', position: 3, managed: true, guild: { id: 'guild_1' } };
    const nitroRole = { id: 'role_nitro', name: 'Server Booster', position: 4, managed: false, tags: { premiumSubscriberRole: true }, guild: { id: 'guild_1' } };
    const highRole = { id: 'role_admin', name: 'Admin', position: 10, managed: false, guild: { id: 'guild_1' } };
    const customRole = { id: 'role_member', name: 'Member', position: 2, managed: false, guild: { id: 'guild_1' } };

    // Non-owner context where client highest role position is 5
    const context = {
        isOwner: false,
        clientHighestRolePosition: 5
    };

    assert.equal(policy.isRoleProtected(everyone, context).protected, true);
    assert.equal(policy.isRoleProtected(everyone, context).reason.includes('@everyone'), true);

    assert.equal(policy.isRoleProtected(botRole, context).protected, true);
    assert.equal(policy.isRoleProtected(botRole, context).reason.includes('Managed'), true);

    assert.equal(policy.isRoleProtected(nitroRole, context).protected, true);

    assert.equal(policy.isRoleProtected(highRole, context).protected, true);
    assert.equal(policy.isRoleProtected(highRole, context).reason.includes('hierarchy'), true);

    const memberCheck = policy.isRoleProtected(customRole, context);
    assert.equal(memberCheck.protected, false);
    assert.equal(memberCheck.deletable, true);
});

test('createCleanupPlan produces role-first plan with full hierarchy metadata', () => {
    const mockGuild = {
        id: 'guild_100',
        ownerId: 'user_owner',
        members: {
            me: { id: 'user_client', roles: { highest: { position: 8 } } }
        },
        roles: {
            cache: new Map([
                ['r0', { id: 'r0', name: '@everyone', position: 0, managed: false, guild: { id: 'guild_100' } }],
                ['r1', { id: 'r1', name: 'Level 1', position: 1, managed: false, guild: { id: 'guild_100' } }],
                ['r2', { id: 'r2', name: 'Level 2', position: 2, managed: false, guild: { id: 'guild_100' } }],
                ['r3', { id: 'r3', name: 'Bot Integrator', position: 4, managed: true, guild: { id: 'guild_100' } }],
                ['r4', { id: 'r4', name: 'Server Boss', position: 12, managed: false, guild: { id: 'guild_100' } }]
            ])
        },
        channels: {
            cache: new Map([
                ['c1', { id: 'c1', name: 'general', type: 0, position: 0, deletable: true }],
                ['c2', { id: 'c2', name: 'Chat Category', type: 4, position: 1, deletable: true }]
            ])
        }
    };

    const plan = createCleanupPlan(mockGuild, CLEANUP_MODES.FULL);

    assert.equal(plan.enabled, true);
    assert.equal(plan.summary.rolesFoundCount, 5);
    assert.equal(plan.summary.rolesToDeleteCount, 2); // r1 and r2
    assert.equal(plan.summary.protectedRolesCount, 3); // @everyone, bot role, and higher role (position 12 > 8)
    assert.equal(plan.summary.managedRolesCount, 1);

    // Verify detailed role hierarchy structure
    const roleItems = plan.roles.all;
    assert.equal(roleItems.length, 5);
    for (const r of roleItems) {
        assert.ok('id' in r);
        assert.ok('name' in r);
        assert.ok('position' in r);
        assert.ok('managed' in r);
        assert.ok('deletable' in r);
        assert.ok('protected' in r);
    }

    // Deletable roles sorted bottom-up (ascending position)
    assert.equal(plan.roles.toDelete[0].id, 'r1');
    assert.equal(plan.roles.toDelete[1].id, 'r2');

    // Channels sorted with non-categories before categories
    assert.equal(plan.channels.toDelete[0].id, 'c1');
    assert.equal(plan.channels.toDelete[1].id, 'c2');
});

test('executeCleanupPlan strictly executes role deletion FIRST before channel deletion', async () => {
    const executionOrder = [];

    const mockGuild = {
        id: 'guild_200',
        ownerId: 'user_client',
        roles: {
            cache: new Map([
                ['r1', {
                    id: 'r1',
                    name: 'Vip',
                    position: 1,
                    managed: false,
                    delete: async () => {
                        executionOrder.push('DELETE_ROLE_r1');
                    }
                }],
                ['r2', {
                    id: 'r2',
                    name: 'Moderator',
                    position: 2,
                    managed: false,
                    delete: async () => {
                        executionOrder.push('DELETE_ROLE_r2');
                    }
                }]
            ])
        },
        channels: {
            cache: new Map([
                ['c1', {
                    id: 'c1',
                    name: 'chat',
                    type: 0,
                    position: 0,
                    delete: async () => {
                        executionOrder.push('DELETE_CHANNEL_c1');
                    }
                }]
            ])
        }
    };

    const plan = {
        enabled: true,
        mode: 'full',
        roles: {
            toDelete: [
                { id: 'r1', name: 'Vip', position: 1 },
                { id: 'r2', name: 'Moderator', position: 2 }
            ],
            protected: [],
            managed: []
        },
        channels: {
            toDelete: [
                { id: 'c1', name: 'chat', type: 0, position: 0 }
            ],
            protected: []
        }
    };

    const logs = [];
    const result = await executeCleanupPlan({
        targetGuild: mockGuild,
        plan,
        onLog: (type, msg) => logs.push(msg),
        options: { cleanerRoleConcurrency: 1, cleanerChannelConcurrency: 1 }
    });

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.roles.deleted, 2);
    assert.equal(result.channels.deleted, 1);

    // Verify strict role-first deletion order
    assert.deepEqual(executionOrder, [
        'DELETE_ROLE_r1',
        'DELETE_ROLE_r2',
        'DELETE_CHANNEL_c1'
    ]);

    // Verify explicit stage logs
    assert.ok(logs.some(l => l.includes('ROLE CLEANUP: Discovering')));
    assert.ok(logs.some(l => l.includes('ROLE CLEANUP COMPLETE')));
    assert.ok(logs.some(l => l.includes('CHANNEL CLEANUP: Discovering')));
    assert.ok(logs.some(l => l.includes('CHANNEL CLEANUP COMPLETE')));
});

test('executeCleanupPlan respects bounded concurrency during role deletion', async () => {
    let activeDeletions = 0;
    let maxConcurrent = 0;

    const createMockRole = (id, name, pos) => ({
        id,
        name,
        position: pos,
        managed: false,
        delete: async () => {
            activeDeletions++;
            maxConcurrent = Math.max(maxConcurrent, activeDeletions);
            await new Promise(r => setTimeout(r, 40));
            activeDeletions--;
        }
    });

    const mockGuild = {
        roles: {
            cache: new Map([
                ['r1', createMockRole('r1', 'R1', 1)],
                ['r2', createMockRole('r2', 'R2', 2)],
                ['r3', createMockRole('r3', 'R3', 3)],
                ['r4', createMockRole('r4', 'R4', 4)]
            ])
        },
        channels: { cache: new Map() }
    };

    const plan = {
        enabled: true,
        mode: 'full',
        roles: {
            toDelete: [
                { id: 'r1', name: 'R1', position: 1 },
                { id: 'r2', name: 'R2', position: 2 },
                { id: 'r3', name: 'R3', position: 3 },
                { id: 'r4', name: 'R4', position: 4 }
            ],
            protected: [],
            managed: []
        },
        channels: { toDelete: [], protected: [] }
    };

    await executeCleanupPlan({
        targetGuild: mockGuild,
        plan,
        options: { cleanerRoleConcurrency: 2 }
    });

    assert.ok(maxConcurrent <= 2, `maxConcurrent was ${maxConcurrent}, expected <= 2`);
});

test('executeCleanupPlan treats 404 / Unknown Role idempotently as successfully deleted', async () => {
    const mockGuild = {
        roles: {
            cache: new Map([
                ['r_ghost', {
                    id: 'r_ghost',
                    name: 'GhostRole',
                    position: 1,
                    delete: async () => {
                        const err = new Error('Unknown Role');
                        err.code = 10011;
                        err.status = 404;
                        throw err;
                    }
                }]
            ])
        },
        channels: { cache: new Map() }
    };

    const plan = {
        enabled: true,
        mode: 'full',
        roles: {
            toDelete: [{ id: 'r_ghost', name: 'GhostRole', position: 1 }],
            protected: [],
            managed: []
        },
        channels: { toDelete: [], protected: [] }
    };

    const result = await executeCleanupPlan({
        targetGuild: mockGuild,
        plan
    });

    assert.equal(result.roles.deleted, 1);
    assert.equal(result.roles.failed, 0);
    assert.equal(result.roles.items[0].status, 'DELETED');
});

test('verifyRoleCleanupState correctly validates role cleanup counts', () => {
    const successResult = { planned: 5, deleted: 5, failed: 0, skipped: 2 };
    const failResult = { planned: 5, deleted: 3, failed: 2, skipped: 2 };

    const mockGuild = { roles: { cache: { size: 3 } } };

    const checkSuccess = verifyRoleCleanupState(mockGuild, successResult);
    assert.equal(checkSuccess.verified, true);
    assert.equal(checkSuccess.status, 'SUCCESS');

    const checkFail = verifyRoleCleanupState(mockGuild, failResult);
    assert.equal(checkFail.verified, false);
    assert.equal(checkFail.status, 'PARTIAL');
});
