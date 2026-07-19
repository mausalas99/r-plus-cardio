import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDbManager } from './db-manager.mjs';
import { registerDbIpcHandlers } from './ipc-handlers.mjs';

const mockSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

function makeUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-audit-hooks-'));
}

function createManager(userDataPath) {
  return createDbManager({
    userDataPath,
    safeStorage: mockSafe,
    getClientId: () => 'test-client',
  });
}

function eventTypes(db) {
  return db
    .prepare('SELECT event_type FROM forensic_audit_chain ORDER BY id ASC')
    .all()
    .map((row) => row.event_type);
}

describe('audit hooks (Option C)', () => {
  it('flushes auth.unlock.fail before auth.unlock.success after failed attempts', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    try {
      await mgr.unlockWithPassphrase('good-pass', { remember: false });
      mgr.lock();
      await assert.rejects(
        () => mgr.unlockWithPassphrase('wrong-pass'),
        (err) => err.code === 'DB_UNLOCK_FAILED'
      );
      await mgr.unlockWithPassphrase('good-pass', { remember: false });
      const types = eventTypes(mgr.getDb());
      const failIdx = types.indexOf('auth.unlock.fail');
      const successIdx = types.lastIndexOf('auth.unlock.success');
      assert.ok(failIdx >= 0);
      assert.ok(successIdx > failIdx);
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes auth.remember_enabled when remember-me persists', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    try {
      await mgr.unlockWithPassphrase('remember-pass', { remember: true });
      const types = eventTypes(mgr.getDb());
      assert.ok(types.includes('auth.unlock.success'));
      assert.ok(types.includes('auth.remember_enabled'));
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes auth.lock on lock()', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    try {
      await mgr.unlockWithPassphrase('lock-pass', { remember: false });
      mgr.lock();
      await mgr.unlockWithPassphrase('lock-pass', { remember: false });
      const types = eventTypes(mgr.getDb());
      assert.ok(types.includes('auth.lock'));
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('auditOnly and schedulePendingAudit append metadata-only events', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    try {
      mgr.schedulePendingAudit('lan.token.rotate', { reason: 'weak_token_rotation' });
      await mgr.unlockWithPassphrase('pending-pass', { remember: false });
      await mgr.auditOnly('system.output_dir.register', { basename: 'Downloads' });
      const rows = mgr
        .getDb()
        .prepare('SELECT event_type FROM forensic_audit_chain ORDER BY id ASC')
        .all();
      const types = rows.map((row) => row.event_type);
      assert.ok(types.includes('lan.token.rotate'));
      assert.ok(types.includes('system.output_dir.register'));
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('db:clinical-save-all records changedKeys in audit metadata', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    const handlers = new Map();
    const ipcMain = {
      handle(channel, fn) {
        handlers.set(channel, fn);
      },
    };
    registerDbIpcHandlers({
      ipcMain,
      dbManager: mgr,
      app: { getPath: () => tmpDir, getVersion: () => 'test' },
      dialog: {},
      safeStorage: mockSafe,
      getClientId: () => 'test-client',
    });
    try {
      await mgr.unlockWithPassphrase('save-pass', { remember: false });
      const saveAll = handlers.get('db:clinical-save-all');
      assert.ok(saveAll);
      const res = await saveAll(null, {
        blobs: { patients: '[]', notes: '{}' },
        auditMeta: { meta: { source: 'test' } },
      });
      assert.equal(res.ok, true);
      const audit = mgr
        .getDb()
        .prepare(
          `SELECT payload_hash FROM forensic_audit_chain
           WHERE event_type = 'clinical.save_all' ORDER BY id DESC LIMIT 1`
        )
        .get();
      assert.ok(audit);
      const { hashPayload } = await import('./forensic-audit.mjs');
      assert.equal(
        audit.payload_hash,
        hashPayload({
          changedKeys: ['patients', 'notes'],
          source: 'test',
        })
      );
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
