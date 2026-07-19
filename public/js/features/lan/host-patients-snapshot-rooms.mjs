import { lanFetchAuthed } from './transport.mjs';

/** @param {string} [preferredRoomId] */
export async function listLanHostRoomIds(preferredRoomId) {
  const ids = new Set();
  const preferred = String(preferredRoomId || '').trim();
  if (preferred) ids.add(preferred);
  try {
    const resp = await lanFetchAuthed('/api/lan/v1/rooms');
    if (resp.ok) {
      const body = await resp.json().catch(function () { return {}; });
      for (const room of body.rooms || []) {
        const id = String(room?.id || '').trim();
        if (id) ids.add(id);
      }
    }
  } catch (_e) { void _e; }
  return Array.from(ids);
}

/** @param {string} roomId */
export async function fetchRoomBundleEntries(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return [];
  try {
    const bundleResp = await lanFetchAuthed(
      '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/sync-bundle',
      { cache: 'no-store' }
    );
    if (!bundleResp.ok) return [];
    const bundleBody = await bundleResp.json().catch(function () { return {}; });
    const entries = bundleBody?.bundle?.entries;
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/** @param {string} roomId */
export async function fetchRoomClinicalOps(roomId) {
  const rid = String(roomId || '').trim();
  if (!rid) return null;
  try {
    const opsResp = await lanFetchAuthed(
      '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/clinical-ops',
      { cache: 'no-store' }
    );
    if (!opsResp.ok) return null;
    const opsBody = await opsResp.json().catch(function () { return {}; });
    if (opsBody?.snapshot && typeof opsBody.snapshot === 'object') return opsBody.snapshot;
  } catch (_e) { void _e; }
  return null;
}

/** @param {string[]} roomIds @param {string} preferredRoomId */
export async function resolveFirstRoomClinicalOps(roomIds, preferredRoomId) {
  let clinicalOps = preferredRoomId ? await fetchRoomClinicalOps(preferredRoomId) : null;
  if (clinicalOps) return clinicalOps;
  for (const rid of roomIds) {
    clinicalOps = await fetchRoomClinicalOps(rid);
    if (clinicalOps) break;
  }
  return clinicalOps;
}
