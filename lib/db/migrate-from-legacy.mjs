import { LS_KEY_TO_BLOB } from './clinical-blob-keys.mjs';
import { upsertBlob } from './clinical-blobs.mjs';
import { writeHostState } from './lan-host-persistence.mjs';

function jsonForBlob(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Import legacy localStorage snapshot and LAN host JSON into SQLCipher tables.
 * Caller must run inside a transaction; pass auditFn to record migration completion.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ lsSnapshot: Record<string, unknown>, hostStateObject: object, teamCodeHash: string }} input
 * @param {(clientId: string, eventType: string, meta: object) => void} [auditFn]
 */
export function migrateFromLegacy(
  db,
  { lsSnapshot, hostStateObject, teamCodeHash },
  auditFn
) {
  const updatedAt = new Date().toISOString();
  const importedBlobKeys = [];

  for (const [lsKey, blobKey] of Object.entries(LS_KEY_TO_BLOB)) {
    if (!Object.prototype.hasOwnProperty.call(lsSnapshot, lsKey)) continue;
    const json = jsonForBlob(lsSnapshot[lsKey]);
    if (json == null) continue;
    upsertBlob(db, blobKey, json, updatedAt);
    importedBlobKeys.push(blobKey);
  }

  writeHostState(db, {
    version: hostStateObject.version ?? 2,
    teamCodeHash,
    patients: Array.isArray(hostStateObject.patients) ? hostStateObject.patients : [],
    rooms: Array.isArray(hostStateObject.rooms) ? hostStateObject.rooms : [],
    roomSyncBundles:
      hostStateObject.roomSyncBundles && typeof hostStateObject.roomSyncBundles === 'object'
        ? hostStateObject.roomSyncBundles
        : {},
  });

  if (typeof auditFn === 'function') {
    auditFn('system', 'system.migration.complete', {
      importedBlobKeys,
      blobCount: importedBlobKeys.length,
      hostPatientCount: Array.isArray(hostStateObject.patients)
        ? hostStateObject.patients.length
        : 0,
    });
  }
}
