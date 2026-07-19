import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LS_KEY_TO_BLOB } from './clinical-blob-keys.mjs';
import { migrateFromLegacy } from './migrate-from-legacy.mjs';

const require = createRequire(import.meta.url);
const { hashTeamCode } = require('../../lan-squad/team-code.js');

const HOST_JSON = 'lan-squad-host-state.json';
const HOST_MIGRATED = 'lan-squad-host-state.json.migrated.backup';
const LS_MIGRATED = 'clinical-localStorage-export.migrated.backup.json';

export function hostJsonPath(userDataPath) {
  return path.join(userDataPath, HOST_JSON);
}

export function hostMigratedPath(userDataPath) {
  return path.join(userDataPath, HOST_MIGRATED);
}

export function lsMigratedExportPath(userDataPath) {
  return path.join(userDataPath, LS_MIGRATED);
}

/** Legacy files on disk that imply migration may still be required. */
export function legacyMigrationMarkersPending(userDataPath) {
  const hostJson = hostJsonPath(userDataPath);
  const hostMigrated = hostMigratedPath(userDataPath);
  if (fs.existsSync(hostJson) && !fs.existsSync(hostMigrated)) return true;
  const legacyLs = path.join(userDataPath, 'clinical-localStorage-export.json');
  const lsMigrated = lsMigratedExportPath(userDataPath);
  if (fs.existsSync(legacyLs) && !fs.existsSync(lsMigrated)) return true;
  return false;
}

export function migrationAlreadyFinalized(userDataPath) {
  return fs.existsSync(hostMigratedPath(userDataPath)) || fs.existsSync(lsMigratedExportPath(userDataPath));
}

/**
 * @param {Record<string, unknown>} lsSnapshot
 */
export function snapshotHasClinicalKeys(lsSnapshot) {
  if (!lsSnapshot || typeof lsSnapshot !== 'object') return false;
  for (const lsKey of Object.keys(LS_KEY_TO_BLOB)) {
    if (!Object.prototype.hasOwnProperty.call(lsSnapshot, lsKey)) continue;
    const value = lsSnapshot[lsKey];
    if (value == null || value === '') continue;
    return true;
  }
  return false;
}

/**
 * @param {{ userDataPath: string, lsSnapshot?: Record<string, unknown> }} input
 */
export function probeMigrationNeeded({ userDataPath, lsSnapshot = {} }) {
  const hasHostJson = fs.existsSync(hostJsonPath(userDataPath));
  if (migrationAlreadyFinalized(userDataPath)) {
    return { needed: false, hasHostJson };
  }
  const hasClinical = snapshotHasClinicalKeys(lsSnapshot);
  const needed = hasHostJson || hasClinical;
  return { needed, hasHostJson };
}

/**
 * @param {string} userDataPath
 * @param {import('better-sqlite3').Database | null} db
 */
export function migrationPending(userDataPath, db) {
  if (!legacyMigrationMarkersPending(userDataPath)) return false;
  if (db) {
    try {
      const count = db.prepare('SELECT COUNT(*) AS c FROM clinical_blob').get().c;
      if (count > 0) return false;
    } catch {
      /* unreadable */
    }
  }
  return true;
}

export function readTeamCodeHash(userDataPath, hostStateObject) {
  if (hostStateObject?.teamCodeHash) return String(hostStateObject.teamCodeHash);
  const teamPath = path.join(userDataPath, 'lan-team-code.txt');
  if (!fs.existsSync(teamPath)) return hashTeamCode('');
  const plain = fs.readFileSync(teamPath, 'utf8').trim();
  return hashTeamCode(plain);
}

/**
 * @param {string} userDataPath
 * @param {Record<string, unknown>} lsSnapshot
 */
export function finalizeLegacyMigrationArtifacts(userDataPath, lsSnapshot) {
  const hostPath = hostJsonPath(userDataPath);
  const hostBackup = hostMigratedPath(userDataPath);
  if (fs.existsSync(hostPath) && !fs.existsSync(hostBackup)) {
    fs.renameSync(hostPath, hostBackup);
  }
  const exportPath = lsMigratedExportPath(userDataPath);
  if (!fs.existsSync(exportPath)) {
    fs.writeFileSync(
      exportPath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          lsSnapshot: lsSnapshot || {},
        },
        null,
        2
      ),
      'utf8'
    );
  }
  return Object.keys(LS_KEY_TO_BLOB);
}

/**
 * @param {{
 *   dbManager: { getDb: () => import('better-sqlite3').Database | null, withTransaction: Function },
 *   userDataPath: string,
 *   lsSnapshot?: Record<string, unknown>,
 * }} opts
 */
export async function runLegacyMigrationIfNeeded({ dbManager, userDataPath, lsSnapshot = {} }) {
  const probe = probeMigrationNeeded({ userDataPath, lsSnapshot });
  if (!probe.needed) {
    return { migrated: false, clearKeys: [] };
  }

  const db = dbManager.getDb();
  if (!db) {
    const err = new Error('Database locked');
    err.code = 'DB_LOCKED';
    throw err;
  }

  const blobCount = db.prepare('SELECT COUNT(*) AS c FROM clinical_blob').get().c;
  if (blobCount > 0) {
    return { migrated: false, clearKeys: [] };
  }

  let hostStateObject = {
    version: 2,
    patients: [],
    rooms: [],
    roomSyncBundles: {},
  };
  const hostPath = hostJsonPath(userDataPath);
  if (fs.existsSync(hostPath)) {
    try {
      hostStateObject = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
    } catch {
      /* use defaults */
    }
  }

  const teamCodeHash = readTeamCodeHash(userDataPath, hostStateObject);

  await dbManager.withTransaction((conn, { audit }) => {
    migrateFromLegacy(
      conn,
      { lsSnapshot, hostStateObject, teamCodeHash },
      audit
    );
  });

  const clearKeys = finalizeLegacyMigrationArtifacts(userDataPath, lsSnapshot);
  return { migrated: true, clearKeys };
}
