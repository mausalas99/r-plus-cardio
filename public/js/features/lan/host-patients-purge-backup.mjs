/**
 * Automatic backup before «Eliminar fantasmas» — standard r-plus-backup + host metadata.
 */
import { saveState } from '../../app-state.mjs';
import { formatDateSlug, downloadJsonPayload } from '../platform/shared.mjs';
import { buildFullBackupPayload } from '../platform/import-backup/backup-payload.mjs';
import { mergeHostBundleEntriesIntoBackupData } from '../platform/import-backup/backup-host-merge.mjs';
import { fetchLanHostCensusSnapshot } from './host-patients-snapshot.mjs';
import { fetchRoomBundleEntries, listLanHostRoomIds } from './host-patients-snapshot-rooms.mjs';
import { activeLiveSyncRoomId } from './runtime.mjs';

export const PURGE_GHOSTS_BACKUP_KEY = 'rpc-purge-ghosts-backup';

/**
 * @param {object} localBackup
 * @param {{ ok: boolean, patients?: object[], clinicalOps?: object|null }} hostSnap
 * @param {Record<string, object[]>} bundleEntriesByRoom
 */
export function buildPurgeGhostsBackupPayload(localBackup, hostSnap, bundleEntriesByRoom) {
  const bundles = bundleEntriesByRoom || {};
  const payload = {
    format: localBackup.format,
    version: localBackup.version,
    exportedAt: new Date().toISOString(),
    appVersion: localBackup.appVersion,
    theme: localBackup.theme,
    guidedTourDoneForVersion: localBackup.guidedTourDoneForVersion,
    data: mergeHostBundleEntriesIntoBackupData(localBackup.data, bundles),
  };
  if (hostSnap.ok) {
    payload.purgeGhostsHost = {
      patients: hostSnap.patients || [],
      clinicalOps: hostSnap.clinicalOps || null,
      bundleEntriesByRoom: bundles,
    };
  }
  return payload;
}

async function loadHostBundleEntriesByRoom(roomId) {
  const roomIds = await listLanHostRoomIds(roomId);
  const bundleEntriesByRoom = {};
  for (const rid of roomIds) {
    bundleEntriesByRoom[rid] = await fetchRoomBundleEntries(rid);
  }
  return bundleEntriesByRoom;
}

function persistPurgeGhostsBackup(payload) {
  try {
    localStorage.setItem(PURGE_GHOSTS_BACKUP_KEY, JSON.stringify(payload));
    return true;
  } catch (_e) {
    void _e;
    return false;
  }
}

/**
 * Snapshot all registered patients (local + host) and download JSON before ghost purge.
 * @returns {Promise<{ ok: boolean, fileName: string, localPatientCount: number, hostPatientCount: number, storedLocally: boolean }>}
 */
export async function createPurgeGhostsBackup() {
  await saveState({ immediate: true });
  const localBackup = buildFullBackupPayload();
  const roomId = String(activeLiveSyncRoomId || '').trim();
  const hostSnap = await fetchLanHostCensusSnapshot(roomId);
  const bundleEntriesByRoom = hostSnap.ok ? await loadHostBundleEntriesByRoom(roomId) : {};
  const payload = buildPurgeGhostsBackupPayload(localBackup, hostSnap, bundleEntriesByRoom);
  const ts = Date.now();
  const fileName =
    'R-plus-respaldo-fantasmas-' + formatDateSlug(new Date(ts)) + '-' + String(ts).slice(-6) + '.json';
  downloadJsonPayload(payload, fileName);
  const storedLocally = persistPurgeGhostsBackup(payload);
  return {
    ok: true,
    fileName,
    localPatientCount: (localBackup.data?.patients || []).length,
    hostPatientCount: hostSnap.ok ? (hostSnap.patients || []).length : 0,
    storedLocally,
  };
}
