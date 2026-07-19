import { LS_KEY_TO_BLOB } from './clinical-blob-keys.mjs';
import { probeMigrationNeeded, migrationPending as computeMigrationPending } from './migration-probe.mjs';

export { computeMigrationPending, probeMigrationNeeded };

export const DEFAULT_AUDIT_EXPORT_LIMIT = 200;

export function ipcError(err) {
  const cause = err?.cause;
  return {
    ok: false,
    code: err?.code || 'DB_ERROR',
    error: err?.message || String(err),
    cause: cause && (cause.message || String(cause)),
  };
}

export function readSchemaVersion(db) {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
  if (!row?.value) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

export function parseBlobValue(json, fallback) {
  if (json == null || json === '') return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function buildBackupEnvelope({ blobs, hostState, appVersion }) {
  const data = {};
  for (const blobKey of Object.values(LS_KEY_TO_BLOB)) {
    const raw = blobs[blobKey];
    if (raw == null) continue;
    const defaults =
      blobKey === 'patients' || blobKey === 'scheduledProcedures' || blobKey === 'todos'
        ? []
        : blobKey === 'medCatalog'
          ? null
          : {};
    data[blobKey] = parseBlobValue(raw, defaults);
  }
  if (hostState) {
    data.lanHost = {
      version: hostState.version,
      teamCodeHash: hostState.teamCodeHash,
      patients: hostState.patients ?? [],
      rooms: hostState.rooms ?? [],
      roomSyncBundles: hostState.roomSyncBundles ?? {},
    };
  }
  return {
    format: 'r-plus-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion ?? null,
    phiWarning:
      'Este archivo contiene información clínica identificable en texto plano. Guárdelo solo en medios cifrados y autorizados.',
    data,
  };
}

export function fetchAuditRows(db, mode) {
  if (mode === 'quick') {
    const last = db
      .prepare(
        `SELECT id, timestamp, client_id, event_type, payload_hash, previous_hash, current_hash
         FROM forensic_audit_chain ORDER BY id DESC LIMIT 2`
      )
      .all()
      .reverse();
    return last;
  }
  return db
    .prepare(
      `SELECT id, timestamp, client_id, event_type, payload_hash, previous_hash, current_hash
       FROM forensic_audit_chain ORDER BY id ASC`
    )
    .all();
}
