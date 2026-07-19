import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDbManager } from './db-manager.mjs';
import { SCHEMA_VERSION } from './schema.mjs';

const mockSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

describe('db-manager', () => {
  function makeUserDataDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-dbmgr-'));
  }

  function createManager(userDataPath) {
    return createDbManager({
      userDataPath,
      safeStorage: mockSafe,
      getClientId: () => 'test-client',
    });
  }

  it('ensureUnlocked opens db without passphrase (encryption deferred)', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    const res = await mgr.ensureUnlocked();
    assert.equal(res.ok, true);
    assert.equal(mgr.isUnlocked(), true);
    mgr.lock();
    const again = await mgr.ensureUnlocked();
    assert.equal(again.ok, true);
    assert.equal(mgr.isUnlocked(), true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('unlock opens db and isUnlocked true', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    assert.equal(mgr.isUnlocked(), false);
    assert.equal(mgr.getState(), 'locked');
    await mgr.unlockWithPassphrase('test-passphrase', { remember: false });
    assert.equal(mgr.isUnlocked(), true);
    assert.equal(mgr.getState(), 'unlocked');
    assert.ok(mgr.getDb());
    mgr.lock();
    assert.equal(mgr.isUnlocked(), false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('changePassphrase rekeys database and updates remember-me metadata', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    await mgr.unlockWithPassphrase('original-pass-phrase', { remember: true });
    await mgr.changePassphrase({
      currentPassphrase: 'original-pass-phrase',
      newPassphrase: 'updated-pass-phrase',
      remember: true,
    });
    mgr.lock();
    await mgr.unlockWithPassphrase('updated-pass-phrase', { remember: false });
    assert.equal(mgr.isUnlocked(), true);
    await assert.rejects(
      () => mgr.unlockWithPassphrase('original-pass-phrase', { remember: false }),
      (err) => err.code === 'DB_UNLOCK_FAILED'
    );
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('changePassphrase rejects wrong current passphrase', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    await mgr.unlockWithPassphrase('good-pass-phrase', { remember: false });
    await assert.rejects(
      () =>
        mgr.changePassphrase({
          currentPassphrase: 'wrong-pass-phrase',
          newPassphrase: 'another-pass-phrase',
          remember: false,
        }),
      (err) => err.code === 'DB_PASSPHRASE_MISMATCH'
    );
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('setup mode replaces a prior failed bootstrap with a new passphrase', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    await mgr.unlockWithPassphrase('first-pass-phrase', { remember: false });
    mgr.lock();
    await mgr.unlockWithPassphrase('new-pass-phrase-ok', { remember: false, setup: true });
    assert.equal(mgr.isUnlocked(), true);
    mgr.lock();
    await mgr.unlockWithPassphrase('new-pass-phrase-ok', { remember: false });
    assert.equal(mgr.isUnlocked(), true);
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('unlocks existing v1 schema and migrates to current', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    await mgr.unlockWithPassphrase('migrate-pass-phrase', { remember: false });
    mgr.getDb().prepare("UPDATE app_meta SET value = '1' WHERE key = 'schema_version'").run();
    mgr.lock();
    await mgr.unlockWithPassphrase('migrate-pass-phrase', { remember: false });
    assert.equal(mgr.isUnlocked(), true);
    const db = mgr.getDb();
    const v = db
      .prepare("SELECT value FROM app_meta WHERE key = 'schema_version'")
      .get();
    assert.equal(v.value, String(SCHEMA_VERSION));
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes('rotation_cycles'));
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('unlockWithRecoveryCode accepts per-install code after setup', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    const unlockRes = await mgr.unlockWithPassphrase('recovery-pass', { remember: false });
    assert.ok(unlockRes && unlockRes.ok);
    assert.ok(unlockRes.recoveryCodeToShow);
    mgr.lock();
    const recoveryRes = await mgr.unlockWithRecoveryCode(unlockRes.recoveryCodeToShow);
    assert.ok(recoveryRes && recoveryRes.ok);
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('withTransaction rolls back when fn throws after blob insert and audit', async () => {
    const tmpDir = makeUserDataDir();
    const mgr = createManager(tmpDir);
    await mgr.unlockWithPassphrase('rollback-pass', { remember: false });

    const auditBefore = mgr
      .getDb()
      .prepare('SELECT COUNT(*) AS c FROM forensic_audit_chain')
      .get().c;

    await assert.rejects(
      () =>
        mgr.withTransaction((db, { audit }) => {
          db.prepare(
            `INSERT INTO clinical_blob (namespace, blob_key, json, updated_at)
             VALUES ('desktop', ?, ?, ?)`
          ).run('patients', '[]', new Date().toISOString());
          audit('test-client', 'clinical.patients.save', { action: 'test' });
          throw new Error('abort transaction');
        }),
      /abort transaction/
    );

    const blobCount = mgr.getDb().prepare('SELECT COUNT(*) AS c FROM clinical_blob').get().c;
    const auditAfter = mgr
      .getDb()
      .prepare('SELECT COUNT(*) AS c FROM forensic_audit_chain')
      .get().c;
    assert.equal(blobCount, 0);
    assert.equal(auditAfter, auditBefore);
    mgr.lock();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
