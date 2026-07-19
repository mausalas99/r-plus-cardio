/**
 * LAN clinical-ops directorio pull from host and peers.
 */
import { lanClinicalDirectoryPullRoomIds } from '../../lan-join-link.mjs';
import {
  applyClinicalOpsLanSnapshot,
  isClinicalOpsLanAvailable,
  refreshClinicalOpsSnapshotCache,
} from '../../clinical-ops-lan.mjs';
import { applyClinicalScopeFromLanOpsSnapshot } from '../../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror } from '../../clinical-privileges.mjs';
import { getHostBundleBases, setHostBundleBases } from '../../host-bundle-bases.mjs';
import { recordClinicalOpsTrace } from '../../lan-sync-diagnostics.mjs';
import { pingLanHostUrl } from '../../lan-surrogate-host.mjs';
import { storage } from '../../storage.js';
import { lanClient } from './runtime.mjs';
import { isLanSessionConfiguredForRest, getLanTeamCodeFromConfig } from './transport.mjs';
import {
  ensureEffectiveLiveSyncRoomId,
  pushClinicalOpsLanNow,
  reconcileLiveSyncRoom,
} from './push.mjs';

var clinicalOpsGossipPushTimer = null;
var clinicalOpsPullFromHostTimer = null;

function scheduleClinicalOpsGossipPush() {
  if (!isClinicalOpsLanAvailable()) return;
  if (clinicalOpsGossipPushTimer) clearTimeout(clinicalOpsGossipPushTimer);
  clinicalOpsGossipPushTimer = setTimeout(function () {
    clinicalOpsGossipPushTimer = null;
    void pushClinicalOpsLanNow().catch(function () {});
  }, 2500);
}

function scheduleClinicalOpsPullFromHost(roomId) {
  var rid = String(roomId || ensureEffectiveLiveSyncRoomId() || '').trim();
  if (!rid || !isClinicalOpsLanAvailable()) return;
  if (clinicalOpsPullFromHostTimer) clearTimeout(clinicalOpsPullFromHostTimer);
  clinicalOpsPullFromHostTimer = setTimeout(function () {
    clinicalOpsPullFromHostTimer = null;
    void fetchAndApplyClinicalOpsFromHost(rid, { skipGossipPush: true });
  }, 400);
}

function normalizeHostUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function applyFetchedClinicalOpsSnapshot(body, options) {
  if (!body || !body.snapshot || typeof body.snapshot !== 'object') return false;
  const mergeResult = await applyClinicalOpsLanSnapshot(body.snapshot);
  if (!mergeResult.ok) return false;
  await refreshClinicalOpsSnapshotCache();
  if (mergeResult.changed && !options.skipGossipPush) {
    scheduleClinicalOpsGossipPush();
  }
  return true;
}

function dispatchMobileClinicalOpsSynced() {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('rpc-clinical-ops-synced', { detail: { mergeStats: null } })
  );
}

function applyFetchedMobileClinicalOpsSnapshot(body) {
  if (!body?.snapshot || typeof body.snapshot !== 'object') return false;
  const applied = applyClinicalScopeFromLanOpsSnapshot(body.snapshot);
  if (applied) dispatchMobileClinicalOpsSynced();
  return applied;
}

function canFetchClinicalOpsFromHost() {
  return isClinicalOpsLanAvailable() || shouldEnforceTeamPatientMirror();
}

function updateHostRevisionFromBody(rid, body) {
  if (!body || body.revision == null) return;
  const prev = getHostBundleBases(rid) || {};
  setHostBundleBases(rid, {
    revision: Number(body.revision),
    entityVersions: prev.entityVersions || {},
  });
}

export async function fetchClinicalOpsFromAlternateHost(hostUrl, roomId, options = {}) {
  const url = normalizeHostUrl(hostUrl);
  const rid = String(roomId || ensureEffectiveLiveSyncRoomId() || '').trim();
  if (!url || !rid || !isClinicalOpsLanAvailable() || !isLanSessionConfiguredForRest()) {
    return false;
  }
  const teamCode = getAlternateHostTeamCode(url);
  if (!teamCode) return false;
  if (!(await pingLanHostUrl(url, teamCode))) return false;

  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 5000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `${url}/api/lan/v1/rooms/${encodeURIComponent(rid)}/clinical-ops`,
      {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${teamCode}` },
      }
    );
    if (!resp || !resp.ok) return false;
    const body = await resp.json();
    return applyFetchedClinicalOpsSnapshot(body, options);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function getAlternateHostTeamCode(url) {
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const ownUrl = normalizeHostUrl(cfg.hostUrl);
  if (ownUrl && url === ownUrl) return '';
  return getLanTeamCodeFromConfig() || '';
}

/** GET /clinical-ops from host; desktop merges SQLCipher, iPad hydrates scope from snapshot. */
export async function fetchAndApplyClinicalOpsFromHost(roomId, options = {}) {
  const rid = String(roomId || '').trim();
  if (!rid || !canFetchClinicalOpsFromHost() || !isLanSessionConfiguredForRest()) {
    return false;
  }
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
    const resp = await lanClient.fetch(
      '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/clinical-ops',
      { signal: ctrl.signal, cache: 'no-store' }
    );
    if (!resp || !resp.ok) {
      recordClinicalOpsTrace('get', {
        roomId: rid,
        httpStatus: resp ? resp.status : 0,
        incomingUsers: 0,
        ok: false,
      });
      return false;
    }
    const body = await resp.json();
    recordClinicalOpsTrace('get', {
      roomId: rid,
      httpStatus: resp.status,
      incomingUsers: Array.isArray(body?.snapshot?.clinical_users)
        ? body.snapshot.clinical_users.length
        : 0,
      ok: true,
    });
    updateHostRevisionFromBody(rid, body);
    if (isClinicalOpsLanAvailable()) {
      return applyFetchedClinicalOpsSnapshot(body, options);
    }
    return applyFetchedMobileClinicalOpsSnapshot(body);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshLanClinicalDirectoryFromRoom(options = {}) {
  const allRooms = options.allRooms === true;
  const activeRoomId = ensureEffectiveLiveSyncRoomId();
  const roomIds = lanClinicalDirectoryPullRoomIds({ allRooms, activeRoomId });
  if (!roomIds.length || !isClinicalOpsLanAvailable() || !isLanSessionConfiguredForRest()) {
    return false;
  }
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || (allRooms ? 12_000 : 5000));
  try {
    if (!lanClient.connected) {
      try {
        lanClient.connectSyncChannel();
      } catch (_e) { void _e; }
    }
    if (allRooms) {
      const perRoomMs = Math.max(2000, Math.ceil(timeoutMs / roomIds.length));
      const results = await Promise.all(
        roomIds.map((rid) =>
          fetchAndApplyClinicalOpsFromHost(rid, { timeoutMs: perRoomMs, skipGossipPush: true })
        )
      );
      return results.some(Boolean);
    }
    const roomId = roomIds[0];
    const applied = await Promise.race([
      fetchAndApplyClinicalOpsFromHost(roomId, { timeoutMs }),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
    if (applied) return true;
    await Promise.race([
      reconcileLiveSyncRoom(roomId),
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      }),
    ]);
    return false;
  } catch {
    return false;
  }
}

export { scheduleClinicalOpsPullFromHost };
