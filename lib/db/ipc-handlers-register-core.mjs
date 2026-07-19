import fs from 'node:fs';
import path from 'node:path';
import { loadAllBlobs, upsertBlob } from './clinical-blobs.mjs';
import { clinicalDbPath, clinicalUnlockMetaPath } from './db-path.mjs';
import { readHostState } from './lan-host-persistence.mjs';
import { verifyChainRows } from './forensic-audit.mjs';
import { touchClinicalUserActivity } from './clinical-access-db.mjs';
import {
  exportClinicalOpsSnapshot,
  mergeClinicalOpsSnapshot,
} from './clinical-ops-sync.mjs';
import {
  runLegacyMigrationIfNeeded,
  migrationPending as computeMigrationPending,
  probeMigrationNeeded,
} from './migration-probe.mjs';
import { SCHEMA_VERSION } from './schema.mjs';
import { createRequire } from 'node:module';
import { probeNativeDatabaseLoad } from './native-load.mjs';
import {
  ipcError,
  readSchemaVersion,
  buildBackupEnvelope,
  fetchAuditRows,
  DEFAULT_AUDIT_EXPORT_LIMIT,
} from './ipc-handlers-shared.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';

const require = createRequire(import.meta.url);
const { probeNativeRuntime } = require('../native-runtime-probe.js');

/**
 * @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx
 * @param {Record<string, unknown>} lsSnapshot
 * @param {{ recoveryCodeToShow?: string } | void} unlockResult
 */
async function finishDbUnlockResponse(ctx, lsSnapshot, unlockResult) {
  const { dbManager } = ctx;
  const result = { ok: true, state: dbManager.getState() };
  if (unlockResult && unlockResult.recoveryCodeToShow) {
    result.recoveryCodeToShow = unlockResult.recoveryCodeToShow;
  }
  try {
    const migration = await runLegacyMigrationIfNeeded({
      dbManager,
      userDataPath: ctx.userDataPath(),
      lsSnapshot,
    });
    if (migration.migrated && migration.clearKeys.length) {
      result.clearKeys = migration.clearKeys;
      result.migrated = true;
    }
  } catch (migErr) {
    result.migrationWarning =
      (migErr && migErr.message) || 'No se pudieron migrar los datos locales a la base cifrada.';
  }
  return result;
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbCoreStatusHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:status', async () => {
    const state = dbManager.getState();
    const db = dbManager.getDb();
    const ud = ctx.userDataPath();
    const dbPath = clinicalDbPath(ud);
    let schemaVersion = null;
    if (db) schemaVersion = readSchemaVersion(db);
    let hasKdfSalt = false;
    try {
      const metaPath = clinicalUnlockMetaPath(ud);
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        hasKdfSalt = !!meta.kdf_salt;
      }
    } catch {
      /* unreadable meta */
    }
    const nativeRuntime = probeNativeRuntime();
    const nativeProbe = probeNativeDatabaseLoad();
    const sqlcipherReady = nativeProbe.ok === true;
    const argon2Ready = nativeRuntime.argon2?.ok === true;
    const nativeReady = sqlcipherReady && argon2Ready;
    const nativeError = nativeReady
      ? null
      : !sqlcipherReady
        ? nativeProbe.message
        : nativeRuntime.userMessage || nativeProbe.message;
    return {
      ok: true,
      state,
      schemaVersion,
      targetSchemaVersion: SCHEMA_VERSION,
      migrationPending: computeMigrationPending(ud, db),
      dbFileExists: fs.existsSync(dbPath),
      hasKdfSalt,
      rateLimited: dbManager.isRateLimited(),
      nativeReady,
      sqlcipherReady,
      argon2Ready,
      nativeError,
      nativeFailures: nativeRuntime.failures || [],
    };
  });

  bindIpcHandler(ipcMain, 'db:migration-probe', async (payload) => {
    const lsSnapshot =
      payload.lsSnapshot && typeof payload.lsSnapshot === 'object' ? payload.lsSnapshot : {};
    const probe = probeMigrationNeeded({ userDataPath: ctx.userDataPath(), lsSnapshot });
    return { ok: true, ...probe };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbCoreUnlockHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:unlock', async (payload) => {
    const lsSnapshot =
      payload.lsSnapshot && typeof payload.lsSnapshot === 'object' ? payload.lsSnapshot : {};
    let unlockResult;
    try {
      unlockResult = await dbManager.unlockWithPassphrase(String(payload.passphrase || ''), {
        remember: !!payload.remember,
        setup: !!payload.setup,
      });
    } catch (err) {
      return ipcError(err);
    }
    return finishDbUnlockResponse(ctx, lsSnapshot, unlockResult);
  });

  bindIpcHandler(ipcMain, 'db:auto-unlock', async (payload) => {
    const lsSnapshot =
      payload.lsSnapshot && typeof payload.lsSnapshot === 'object' ? payload.lsSnapshot : {};
    try {
      const unlockResult = await dbManager.ensureUnlocked();
      return finishDbUnlockResponse(ctx, lsSnapshot, unlockResult);
    } catch (err) {
      return ipcError(err);
    }
  });

  bindIpcHandler(ipcMain, 'db:unlock-recovery', async (payload) => {
    try {
      const unlockResult = await dbManager.unlockWithRecoveryCode(String(payload.code || ''));
      const result = { ok: true, state: dbManager.getState() };
      if (unlockResult && unlockResult.recoveryCodeToShow) {
        result.recoveryCodeToShow = unlockResult.recoveryCodeToShow;
      }
      return result;
    } catch (err) {
      return ipcError(err);
    }
  });

  bindIpcHandler(ipcMain, 'db:lock', async () => {
    dbManager.lock();
    return { ok: true, state: dbManager.getState() };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbCoreClinicalHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:clinical-load-all', async () => {
    const blobs = await dbManager.withTransaction((db) => {
      const loaded = loadAllBlobs(db);
      loaded.clinicalOps = JSON.stringify(exportClinicalOpsSnapshot(db));
      return loaded;
    });
    return { ok: true, blobs };
  });

  bindIpcHandler(ipcMain, 'db:clinical-save-all', async (payload) => {
    const blobs = payload.blobs && typeof payload.blobs === 'object' ? payload.blobs : {};
    const auditMeta = payload.auditMeta && typeof payload.auditMeta === 'object' ? payload.auditMeta : {};
    await dbManager.withTransaction((db, { audit }) => {
      for (const [blobKey, json] of Object.entries(blobs)) {
        if (blobKey === 'clinicalOps') continue;
        if (typeof json !== 'string') continue;
        upsertBlob(db, blobKey, json);
      }
      if (typeof blobs.clinicalOps === 'string' && blobs.clinicalOps.trim()) {
        let incoming = null;
        try {
          incoming = JSON.parse(blobs.clinicalOps);
        } catch {
          incoming = null;
        }
        if (incoming && typeof incoming === 'object') {
          mergeClinicalOpsSnapshot(db, incoming);
        }
      }
      audit(getClientId(), auditMeta.eventType || 'clinical.save_all', {
        changedKeys: Object.keys(blobs),
        ...(auditMeta.meta && typeof auditMeta.meta === 'object' ? auditMeta.meta : {}),
      });
      const actorUserId = String(payload.userId || '').trim();
      if (actorUserId) touchClinicalUserActivity(db, actorUserId);
    });
    return { ok: true };
  });

  bindIpcHandler(ipcMain, 'db:clinical-ops-export', async () => {
    const snapshot = await dbManager.withTransaction((db) => exportClinicalOpsSnapshot(db));
    return { ok: true, snapshot };
  });

  bindIpcHandler(ipcMain, 'db:clinical-ops-merge', async (payload) => {
    const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
    if (!snapshot) {
      return { ok: false, code: 'INVALID_SNAPSHOT', error: 'snapshot required' };
    }
    let mergeStats = null;
    await dbManager.withTransaction((db, { audit }) => {
      const out = mergeClinicalOpsSnapshot(db, snapshot);
      mergeStats = out && out.stats ? out.stats : null;
      audit(getClientId(), 'clinical.ops.merge', {
        exportedAt: snapshot.exportedAt || null,
      });
    });
    return { ok: true, mergeStats };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbCoreAuditHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:audit-verify', async (payload) => {
    const mode = payload.mode === 'quick' ? 'quick' : 'full';
    const brokenAtId = await dbManager.withTransaction((db) => {
      const rows = fetchAuditRows(db, mode);
      return verifyChainRows(rows);
    });
    return {
      ok: true,
      valid: brokenAtId == null,
      brokenAtId: brokenAtId ?? null,
      mode,
    };
  });

  bindIpcHandler(ipcMain, 'db:audit-export', async (payload) => {
    const limit = Math.min(
      Math.max(Number(payload.limit) || DEFAULT_AUDIT_EXPORT_LIMIT, 1),
      5000
    );
    const entries = await dbManager.withTransaction((db) =>
      db
        .prepare(
          `SELECT id, timestamp, client_id, event_type, payload_hash, previous_hash, current_hash
           FROM forensic_audit_chain ORDER BY id DESC LIMIT ?`
        )
        .all(limit)
        .reverse()
    );
    return { ok: true, entries };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbCoreBackupHandlers(ctx) {
  const { ipcMain, dbManager, app, dialog, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:backup-export-json', async () => {
    const result = await dbManager.withTransaction((db, { audit }) => {
      const blobs = loadAllBlobs(db);
      const hostState = readHostState(db);
      audit(getClientId(), 'clinical.backup.export', {
        format: 'json',
        blobCount: Object.keys(blobs).length,
      });
      return buildBackupEnvelope({
        blobs,
        hostState,
        appVersion: app.getVersion(),
      });
    });
    return { ok: true, envelope: result };
  });

  bindIpcHandler(ipcMain, 'db:recover-census-range-export', async () => {
    if (!dbManager.isUnlocked()) {
      return { ok: false, code: 'DB_LOCKED', error: 'Base cifrada bloqueada' };
    }
    try {
      const { buildRecoverCensusRangePayload } = await import('../../scripts/recover-census-export.mjs');
      const payload = await buildRecoverCensusRangePayload(dbManager);
      await dbManager.auditOnly('clinical.recover.export', {
        patientCount: payload.entries.length,
      }, getClientId());
      return { ok: true, payload, count: payload.entries.length };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : 'recover_export_failed',
      };
    }
  });

  bindIpcHandler(ipcMain, 'db:backup-export-db', async () => {
    const dbPath = clinicalDbPath(ctx.userDataPath());
    if (!fs.existsSync(dbPath)) {
      return { ok: false, code: 'DB_NOT_FOUND', error: 'Clinical database file not found' };
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar copia cifrada de la base de datos',
      defaultPath: path.join(
        app.getPath('downloads'),
        `rplus-clinical-${new Date().toISOString().slice(0, 10)}.db`
      ),
      filters: [{ name: 'SQLCipher database', extensions: ['db'] }],
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    await dbManager.withTransaction((db, { audit }) => {
      const escaped = filePath.replace(/'/g, "''");
      try {
        db.exec(`VACUUM INTO '${escaped}'`);
      } catch {
        fs.copyFileSync(dbPath, filePath);
      }
      audit(getClientId(), 'clinical.backup.export', { format: 'db', path: path.basename(filePath) });
    });
    return { ok: true, path: filePath };
  });

  bindIpcHandler(ipcMain, 'db:change-passphrase', async (payload) => {
    if (dbManager.getState() !== 'unlocked') {
      return ipcError(Object.assign(new Error('Database locked'), { code: 'DB_LOCKED' }));
    }
    await dbManager.changePassphrase({
      currentPassphrase: String(payload.currentPassphrase || ''),
      newPassphrase: String(payload.newPassphrase || ''),
      remember: !!payload.remember,
    });
    return { ok: true, state: dbManager.getState() };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbCoreHandlers(ctx) {
  registerDbCoreStatusHandlers(ctx);
  registerDbCoreUnlockHandlers(ctx);
  registerDbCoreClinicalHandlers(ctx);
  registerDbCoreAuditHandlers(ctx);
  registerDbCoreBackupHandlers(ctx);
}
