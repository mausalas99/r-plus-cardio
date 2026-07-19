/**
 * Fetch LAN host patient census + clinical-ops context.
 */

import { isLanSessionConfiguredForRest, lanFetchAuthed } from './transport.mjs';
import { activeLiveSyncRoomId } from './runtime.mjs';
import {
  mergeBundleEntriesIntoCensus,
  upsertHostCensusPatient,
} from './host-patients-snapshot-merge.mjs';
import { extractPatientFromBundleEntry } from './host-patients-bundle-entry.mjs';
import {
  fetchRoomBundleEntries,
  listLanHostRoomIds,
  resolveFirstRoomClinicalOps,
} from './host-patients-snapshot-rooms.mjs';

export { mergeBundleEntriesIntoCensus, upsertHostCensusPatient } from './host-patients-snapshot-merge.mjs';

const HOST_PATIENTS_CACHE_MS = 1500;
/** @type {{ at: number, list: object[]|null }} */
let hostPatientsCache = { at: 0, list: null };

export function invalidateHostPatientsCache() {
  hostPatientsCache = { at: 0, list: null };
}

/** @param {{ bypassCache?: boolean }} [opts] */
export async function fetchHostPatientsList(opts) {
  if (
    !opts?.bypassCache &&
    hostPatientsCache.list &&
    Date.now() - hostPatientsCache.at < HOST_PATIENTS_CACHE_MS
  ) {
    return hostPatientsCache.list;
  }
  const resp = await lanFetchAuthed('/api/lan/v1/patients');
  if (!resp.ok) return null;
  const body = await resp.json().catch(function () {
    return {};
  });
  const list = Array.isArray(body.patients) ? body.patients : [];
  hostPatientsCache = { at: Date.now(), list: list };
  return list;
}

function bundleEntryMatchesPatient(entry, patientId, registro) {
  const row = extractPatientFromBundleEntry(entry);
  if (!row?.id) return false;
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  if (pid && String(row.id) === pid) return true;
  if (reg && String(row.registro || '').trim() === reg) return true;
  return false;
}

async function loadHostPatientsIntoMap(byId) {
  const hostRows = await fetchHostPatientsList();
  if (!hostRows) return { ok: false, error: 'patients_fetch_failed' };
  for (const row of hostRows) {
    if (!row?.id || row._deleted) continue;
    upsertHostCensusPatient(byId, row, { bundleOnly: false });
  }
  return { ok: true };
}

async function mergeAllRoomBundlesIntoCensus(byId, roomIds) {
  const bundleEntryLists = await Promise.all(
    roomIds.map(function (rid) {
      return fetchRoomBundleEntries(rid);
    })
  );
  for (const entries of bundleEntryLists) {
    mergeBundleEntriesIntoCensus(byId, entries);
  }
}

/** @param {string} [roomId] */
export async function fetchLanHostCensusSnapshot(roomId) {
  if (!isLanSessionConfiguredForRest()) {
    return { ok: false, error: 'not_configured' };
  }
  const byId = new Map();
  try {
    const loaded = await loadHostPatientsIntoMap(byId);
    if (!loaded.ok) return loaded;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'patients_fetch_failed' };
  }

  const preferredRoomId = String(roomId || activeLiveSyncRoomId || '').trim();
  const roomIds = await listLanHostRoomIds(preferredRoomId);
  await mergeAllRoomBundlesIntoCensus(byId, roomIds);
  const clinicalOps = await resolveFirstRoomClinicalOps(roomIds, preferredRoomId);

  return { ok: true, patients: Array.from(byId.values()), clinicalOps };
}

/**
 * Lightweight presence check (active room bundle + host patients list).
 * @param {string} patientId
 * @param {string} [registro]
 * @param {string} [roomId]
 */
export async function isPatientPresentOnHost(patientId, registro, roomId) {
  const pid = String(patientId || '').trim();
  const reg = String(registro || '').trim();
  if (!pid && !reg) return false;
  const list = await fetchHostPatientsList();
  if (list) {
    const onHost = list.some(function (row) {
      if (!row?.id || row._deleted) return false;
      if (pid && String(row.id) === pid) return true;
      if (reg && String(row.registro || '').trim() === reg) return true;
      return false;
    });
    if (onHost) return true;
  }
  const rid = String(roomId || activeLiveSyncRoomId || '').trim();
  if (!rid) return false;
  const entries = await fetchRoomBundleEntries(rid);
  return entries.some(function (ent) {
    return bundleEntryMatchesPatient(ent, pid, reg);
  });
}

/** @param {string} patientId @param {string} [registro] */
export async function isPatientInHostCensus(patientId, registro) {
  return isPatientPresentOnHost(patientId, registro);
}
