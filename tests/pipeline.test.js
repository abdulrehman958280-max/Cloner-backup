import test from 'node:test';
import assert from 'node:assert/strict';
import { MigrationManifest } from '../services/manifest.js';
import { CleanerPolicy } from '../services/cleaner/cleanerPolicy.js';
import { CLEANUP_MODES, DEFAULT_CONFIG } from '../services/configContract.js';

test('MigrationManifest records mappings and stats correctly', () => {
    const manifest = new MigrationManifest('111', '222');
    
    manifest.recordRole({ id: 'role-src-1', name: 'Admin' }, { id: 'role-tgt-1', name: 'Admin' }, 'created');
    manifest.recordCategory({ id: 'cat-src-1', name: 'Welcome' }, { id: 'cat-tgt-1', name: 'Welcome' }, 'created');
    manifest.recordChannel({ id: 'chan-src-1', name: 'general' }, { id: 'chan-tgt-1', name: 'general' }, 'created');
    manifest.recordPermission(true, 'Applied permission overwrite');
    manifest.recordMessage(true);
    manifest.recordAttachment(true);

    assert.equal(manifest.roleMap.get('role-src-1'), 'role-tgt-1');
    assert.equal(manifest.categoryMap.get('cat-src-1'), 'cat-tgt-1');
    assert.equal(manifest.channelMap.get('chan-src-1'), 'chan-tgt-1');

    const summary = manifest.getSummary();
    assert.equal(summary.rolesCreated, 1);
    assert.equal(summary.categoriesCreated, 1);
    assert.equal(summary.channelsCreated, 1);
    assert.equal(summary.messagesCopied, 1);
    assert.equal(summary.attachmentsCopied, 1);
    assert.equal(summary.permissionsApplied, 1);
});

test('CleanerPolicy safely protects default and managed entities', () => {
    const policy = new CleanerPolicy(CLEANUP_MODES.FULL);

    const everyoneRole = { id: '222', name: '@everyone', managed: false, guild: { id: '222' } };
    const managedRole = { id: '999', name: 'BotRole', managed: true, guild: { id: '222' } };
    const customRole = { id: '333', name: 'Member', managed: false, guild: { id: '222' }, position: 5 };

    assert.equal(policy.isRoleProtected(everyoneRole, { isOwner: true }).protected, true);
    assert.equal(policy.isRoleProtected(managedRole, { isOwner: true }).protected, true);
    assert.equal(policy.isRoleProtected(customRole, { isOwner: true }).protected, false);

    const normalChannel = { id: '444', deletable: true };
    const undeletableChannel = { id: '555', deletable: false };

    assert.equal(policy.isChannelProtected(normalChannel).protected, false);
    assert.equal(policy.isChannelProtected(undeletableChannel).protected, true);
});

test('DEFAULT_CONFIG enforces product defaults', () => {
    assert.equal(DEFAULT_CONFIG.cleanTarget, true);
    assert.equal(DEFAULT_CONFIG.cloneMessages, false);
    assert.equal(DEFAULT_CONFIG.cloneAttachments, false);
    assert.equal(DEFAULT_CONFIG.msgLimit, 15);
    assert.equal(DEFAULT_CONFIG.msgDelay, 1000);
});
