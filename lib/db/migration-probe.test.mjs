import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTestDb } from './test-open-db.mjs';
import { createDbManager } from './db-manager.mjs';
import {
  finalizeLegacyMigrationArtifacts,
  hostJsonPath,
  hostMigratedPath,
  legacyMigrationMarkersPending,
  lsMigratedExportPath,
  migrationPending,
  probeMigrationNeeded,
  runLegacyMigrationIfNeeded,
  snapshotHasClinicalKeys,
} from './migration-probe.mjs';

const FIXTURE_SNAPSHOT = {
  'rpc-patients': '[]',
  'rpc-notes': '{}',
};

const mockSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

describe('migration-probe', () => {
  it('snapshotHasClinicalKeys detects non-empty rpc keys', () => {
    assert.equal(snapshotHasClinicalKeys({}), false);
    assert.equal(snapshotHasClinicalKeys({ 'rpc-patients': '' }), false);
    assert.equal(snapshotHasClinicalKeys(FIXTURE_SNAPSHOT), true);
  });

  it('probeMigrationNeeded when host json exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-probe-'));
    try {
      fs.writeFileSync(hostJsonPath(dir), '{"version":2,"patients":[]}', 'utf8');
      const probe = probeMigrationNeeded({ userDataPath: dir, lsSnapshot: {} });
      assert.equal(probe.needed, true);
      assert.equal(probe.hasHostJson, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('probeMigrationNeeded when only localStorage snapshot has data', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-probe-ls-'));
    try {
      const probe = probeMigrationNeeded({ userDataPath: dir, lsSnapshot: FIXTURE_SNAPSHOT });
      assert.equal(probe.needed, true);
      assert.equal(probe.hasHostJson, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('probeMigrationNeeded is false after migration artifacts exist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-probe-done-'));
    try {
      finalizeLegacyMigrationArtifacts(dir, FIXTURE_SNAPSHOT);
      const probe = probeMigrationNeeded({ userDataPath: dir, lsSnapshot: FIXTURE_SNAPSHOT });
      assert.equal(probe.needed, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('migrationPending uses file markers and empty clinical_blob', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-pend-'));
    const { db, close } = openTestDb('ab'.repeat(32));
    try {
      fs.writeFileSync(hostJsonPath(dir), '{}', 'utf8');
      assert.equal(legacyMigrationMarkersPending(dir), true);
      assert.equal(migrationPending(dir, db), true);

      db.prepare(
        `INSERT INTO clinical_blob (blob_key, json, updated_at) VALUES ('patients', '[]', datetime('now'))`
      ).run();
      assert.equal(migrationPending(dir, db), false);
    } finally {
      close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runLegacyMigrationIfNeeded imports data and writes backups', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-migrate-run-'));
    const hostState = {
      version: 2,
      teamCodeHash: 'abc123',
      patients: [{ id: 'p1' }],
      rooms: [],
      roomSyncBundles: {},
    };
    fs.writeFileSync(hostJsonPath(dir), JSON.stringify(hostState), 'utf8');
    fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), 'test-token-32-chars-minimum-xx\n', 'utf8');

    const mgr = createDbManager({
      userDataPath: dir,
      safeStorage: mockSafe,
      getClientId: () => 'probe-test',
    });
    try {
      await mgr.unlockWithKeyHex('cd'.repeat(32));
      const result = await runLegacyMigrationIfNeeded({
        dbManager: mgr,
        userDataPath: dir,
        lsSnapshot: {
          'rpc-patients': JSON.stringify([{ id: 'p1', nombre: 'Test' }]),
        },
      });
      assert.equal(result.migrated, true);
      assert.ok(result.clearKeys.includes('rpc-patients'));
      assert.equal(fs.existsSync(hostJsonPath(dir)), false);
      assert.equal(fs.existsSync(hostMigratedPath(dir)), true);
      assert.equal(fs.existsSync(lsMigratedExportPath(dir)), true);

      const db = mgr.getDb();
      assert.ok(db.prepare("SELECT 1 FROM clinical_blob WHERE blob_key = 'patients'").get());
      assert.equal(probeMigrationNeeded({ userDataPath: dir, lsSnapshot: FIXTURE_SNAPSHOT }).needed, false);

      const again = await runLegacyMigrationIfNeeded({
        dbManager: mgr,
        userDataPath: dir,
        lsSnapshot: FIXTURE_SNAPSHOT,
      });
      assert.equal(again.migrated, false);
    } finally {
      mgr.lock();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
