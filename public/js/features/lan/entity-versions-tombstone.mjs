import {
  readLiveSyncEntityMap,
  liveSyncEntityStoreKey,
} from './entity-versions.mjs';

const LIVE_SYNC_ENTITIES_LS = 'rpc-lan-live-entities';

/** @param {Record<string, object>} map @param {string} selfKey @param {string} reg */
export function purgeTombstonesForAdmit(map, selfKey, reg) {
  let changed = false;
  if (map[selfKey] && map[selfKey]._deleted === true) {
    delete map[selfKey];
    changed = true;
  }
  if (!reg) return changed;
  for (const key of Object.keys(map)) {
    if (!key.startsWith('patient:')) continue;
    const row = map[key];
    if (!row || row._deleted !== true) continue;
    if (String(row.registro || '').trim() !== reg) continue;
    if (key === selfKey) continue;
    delete map[key];
    changed = true;
  }
  return changed;
}

/** @param {string} patientId @param {string} registro */
export function clearPatientDeleteTombstoneForAdmit(patientId, registro) {
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  if (!pid) return;
  const map = readLiveSyncEntityMap();
  const selfKey = liveSyncEntityStoreKey('patient', pid, null);
  const changed = purgeTombstonesForAdmit(map, selfKey, reg);
  if (!changed) return;
  try {
    localStorage.setItem(LIVE_SYNC_ENTITIES_LS, JSON.stringify(map));
  } catch { /* ignored */ }
}
