import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTestDb } from './test-open-db.mjs';
import { createDbManager } from './db-manager.mjs';
import { migrateFromLegacy } from './migrate-from-legacy.mjs';
import { getBlob, loadAllBlobs } from './clinical-blobs.mjs';
import { readHostState } from './lan-host-persistence.mjs';
import { appendAuditInTransaction } from './forensic-audit.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-minimal.json'), 'utf8')
);
const TEST_KEY_HEX = 'ab'.repeat(32);

const mockSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from('enc:' + s).toString('base64'),
  decryptString: (s) => Buffer.from(s, 'base64').toString('utf8').replace(/^enc:/, ''),
};

describe('migrate-from-legacy', () => {
  it('imports fixture blobs and host row with migration audit', () => {
    const { db, close } = openTestDb(TEST_KEY_HEX);
    try {
      db.transaction(() => {
        migrateFromLegacy(
          db,
          {
            lsSnapshot: FIXTURE.lsSnapshot,
            hostStateObject: FIXTURE.hostStateObject,
            teamCodeHash: FIXTURE.teamCodeHash,
          },
          (clientId, eventType, meta) => {
            appendAuditInTransaction(db, { clientId, eventType, meta });
          }
        );
      })();

      const blobs = loadAllBlobs(db);
      assert.equal(Object.keys(blobs).length, 3);
      assert.equal(getBlob(db, 'patients'), FIXTURE.lsSnapshot['rpc-patients']);
      assert.equal(getBlob(db, 'notes'), FIXTURE.lsSnapshot['rpc-notes']);
      assert.equal(getBlob(db, 'todos'), FIXTURE.lsSnapshot['rpc-todos']);

      const host = readHostState(db);
      assert.ok(host);
      assert.equal(host.version, 2);
      assert.equal(host.teamCodeHash, FIXTURE.teamCodeHash);
      assert.equal(host.patients.length, 1);
      assert.equal(host.patients[0].id, 'p1');
      assert.equal(host.rooms.length, 1);
      assert.deepEqual(host.roomSyncBundles, FIXTURE.hostStateObject.roomSyncBundles);

      const audit = db
        .prepare(
          `SELECT event_type, client_id FROM forensic_audit_chain ORDER BY id DESC LIMIT 1`
        )
        .get();
      assert.equal(audit.event_type, 'system.migration.complete');
      assert.equal(audit.client_id, 'system');
    } finally {
      close();
    }
  });

  it('runs inside db-manager withTransaction after unlock', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-migrate-'));
    const mgr = createDbManager({
      userDataPath: tmpDir,
      safeStorage: mockSafe,
      getClientId: () => 'migrate-test-client',
    });
    try {
      await mgr.unlockWithKeyHex(TEST_KEY_HEX);
      await mgr.withTransaction((db, { audit }) => {
        migrateFromLegacy(
          db,
          {
            lsSnapshot: FIXTURE.lsSnapshot,
            hostStateObject: FIXTURE.hostStateObject,
            teamCodeHash: FIXTURE.teamCodeHash,
          },
          audit
        );
      });

      const db = mgr.getDb();
      assert.equal(db.prepare('SELECT COUNT(*) AS c FROM clinical_blob').get().c, 3);
      assert.ok(readHostState(db));
      const migrationAudit = db
        .prepare(
          `SELECT 1 FROM forensic_audit_chain WHERE event_type = 'system.migration.complete'`
        )
        .get();
      assert.ok(migrationAudit);
    } finally {
      mgr.lock();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
