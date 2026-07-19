/**
 * Clear local LAN patient delete tombstones and re-pull visible census.
 */
import { refreshClinicalPatientListForScope } from '../../clinical-access-runtime.mjs';
import { patientsBridge } from '../patients-bridge.mjs';
import {
  clearPatientDeleteTombstoneForAdmit,
  clearPatientDeleteTombstones,
  listPatientDeleteTombstones,
} from './entity-versions.mjs';
import { restoreLanPatientFromHost } from './host-patient-http.mjs';
import { reconcileLiveSyncRoom } from './push.mjs';
import { getActiveLiveSyncRoomId } from './room.mjs';

export function countLocalPatientDeleteTombstones() {
  return listPatientDeleteTombstones().length;
}

async function refreshPatientVisibilityAfterTombstoneClear() {
  await refreshClinicalPatientListForScope({ allowLanPull: true });
  if (typeof patientsBridge.renderPatientList === 'function') {
    patientsBridge.renderPatientList();
  }
}

/**
 * @param {Array<{ id: string, registro?: string }>} tombstones
 * @returns {Promise<number>}
 */
async function restorePatientsFromHostAfterTombstoneClear(tombstones) {
  let restored = 0;
  for (const row of tombstones) {
    const pid = String(row.id || '').trim();
    if (!pid) continue;
    const res = await restoreLanPatientFromHost(pid);
    if (res?.ok && (res.added || res.updated)) restored += 1;
  }
  return restored;
}

/**
 * Drop all local patient delete tombstones, restore from host when possible, reconcile.
 * @returns {Promise<{ ok: boolean, cleared: number, restored: number }>}
 */
export async function clearLocalPatientDeleteTombstonesAndReconcile() {
  const tombstones = listPatientDeleteTombstones();
  if (!tombstones.length) {
    return { ok: true, cleared: 0, restored: 0 };
  }
  const cleared = clearPatientDeleteTombstones();
  const restored = await restorePatientsFromHostAfterTombstoneClear(tombstones);
  const rid = String(getActiveLiveSyncRoomId() || '').trim();
  if (rid) {
    await reconcileLiveSyncRoom(rid, { force: true, reason: 'tombstone-clear' });
  }
  await refreshPatientVisibilityAfterTombstoneClear();
  return { ok: true, cleared, restored };
}

/**
 * Clear tombstones for one chart and pull it from the host bundle when present.
 * @param {string} patientId
 * @param {string} [registro]
 */
export async function clearPatientTombstoneAndRestoreFromHost(patientId, registro) {
  const pid = String(patientId || '').trim();
  if (!pid) return { ok: false, error: 'invalid_id', cleared: 0, restored: false };
  const before = listPatientDeleteTombstones().length;
  clearPatientDeleteTombstoneForAdmit(pid, registro);
  clearPatientDeleteTombstones({ patientId: pid, registro: registro });
  const after = listPatientDeleteTombstones().length;
  const res = await restoreLanPatientFromHost(pid);
  const rid = String(getActiveLiveSyncRoomId() || '').trim();
  if (rid) {
    await reconcileLiveSyncRoom(rid, { force: true, reason: 'tombstone-clear-one' });
  }
  await refreshPatientVisibilityAfterTombstoneClear();
  return {
    ok: true,
    cleared: Math.max(0, before - after),
    restored: !!(res?.ok && (res.added || res.updated)),
    restore: res,
  };
}
