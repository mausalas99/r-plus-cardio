/**
 * LAN room snapshots, hello payloads, and live channel wait.
 */
import { storage } from '../../storage.js';
import {
  buildRoomSnapshotFromStorage,
  nextRoomSnapshotGeneration,
} from '../../live-sync-room.mjs';
import {
  prepareClinicalOpsForLanSync,
  getCachedClinicalOpsSnapshot,
  isClinicalOpsLanAvailable,
} from '../../clinical-ops-lan.mjs';
import { isClinicalScopeReadyForLanPatientApply } from '../../clinical-access-runtime.mjs';
import { lanClient, getLanClientId } from './runtime.mjs';
import { isLanElectronDesktop, isLanRemoteJoinMode, resolveLanHostUrlAuto } from './transport.mjs';
import { isSurrogateHostActive } from '../../lan-surrogate-host.mjs';
import { bridge, ensureLanSyncRoomBridgeWired } from './room-bridge.mjs';

export async function resolveSelfLanAdvertiseHostUrl() {
  if (!isLanElectronDesktop() || isLanRemoteJoinMode()) return '';
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var fromCfg = String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (fromCfg) return fromCfg;
  return resolveLanHostUrlAuto();
}

export function buildLiveSyncHelloPayload(roomId) {
  var rid = String(roomId || '').trim();
  var prev = storage.getLanRoomSnapshot(rid);
  var payload = {
    type: 'livesync:hello',
    roomId: rid,
    clientId: getLanClientId(),
    snapshotAt: prev && prev.savedAt ? prev.savedAt : null,
    generation: prev && prev.generation != null ? prev.generation : 0,
    canHost: isLanElectronDesktop(),
    isSurrogate: isSurrogateHostActive(),
    capabilities: {
      deltaSync: 1,
      deltaEntities: ['historiaClinica', 'agenda', 'todo'],
      lastDeltaSeq: Number(prev && prev.lastDeltaSeq ? prev.lastDeltaSeq : 0),
    },
  };
  return payload;
}

export async function enrichLiveSyncHelloPayload(payload) {
  if (!payload || !payload.canHost) return payload;
  var url = await resolveSelfLanAdvertiseHostUrl();
  if (url) payload.hostUrl = url;
  return payload;
}

export function saveLocalRoomSnapshot(roomId) {
  void ensureLanSyncRoomBridgeWired().then(function () {
    saveLocalRoomSnapshotBody(roomId);
  });
}

function saveLocalRoomSnapshotBody(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return;
  var snap = buildRoomSnapshotFromStorage(storage, bridge().collectPatientIdsForLiveSync());
  var prev = storage.getLanRoomSnapshot(rid);
  var entries = bridge().collectPatientEntriesForLanSync();
  if (
    !entries.length &&
    !isClinicalScopeReadyForLanPatientApply() &&
    prev &&
    Array.isArray(prev.entries) &&
    prev.entries.length
  ) {
    entries = prev.entries;
  }
  storage.saveLanRoomSnapshot(rid, {
    savedAt: snap.savedAt,
    generation: nextRoomSnapshotGeneration(prev),
    agenda: snap.agenda,
    todos: snap.todos,
    entries: entries,
    clinicalOps: getCachedClinicalOpsSnapshot(),
  });
}

export async function buildLiveSyncBundleEnvelope(roomId) {
  await ensureLanSyncRoomBridgeWired();
  if (isClinicalOpsLanAvailable()) {
    await prepareClinicalOpsForLanSync();
  }
  var rid = String(roomId || '').trim();
  var snap = buildRoomSnapshotFromStorage(storage, bridge().collectPatientIdsForLiveSync());
  var prev = storage.getLanRoomSnapshot(rid);
  var entries = bridge().collectPatientEntriesForLanSync();
  return {
    type: 'livesync:bundle',
    roomId: rid,
    clientId: getLanClientId(),
    savedAt: snap.savedAt,
    generation: nextRoomSnapshotGeneration(prev),
    agenda: snap.agenda,
    todos: snap.todos,
    entries: entries,
    clinicalOps: getCachedClinicalOpsSnapshot(),
  };
}

/**
 * Wait until live WS for roomId is open (or timeout).
 * @param {string} roomId
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function waitForLiveChannelOpen(roomId, timeoutMs) {
  var rid = String(roomId || '').trim();
  var ms = Math.max(500, Number(timeoutMs) || 5000);
  if (!rid) return Promise.resolve(false);
  if (
    lanClient.liveConnected &&
    String(lanClient.liveRoomId || '').trim() === rid
  ) {
    var ws = lanClient._liveWs;
    if (ws && ws.readyState === 1) return Promise.resolve(true);
  }
  return new Promise(function (resolve) {
    var settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lanClient.removeEventListener('lan-live-status', onStatus);
      resolve(!!ok);
    }
    function onStatus(ev) {
      if (!ev || !ev.detail || !ev.detail.connected) return;
      if (String(ev.detail.roomId || '').trim() !== rid) return;
      finish(true);
    }
    var timer = setTimeout(function () {
      finish(false);
    }, ms);
    lanClient.addEventListener('lan-live-status', onStatus);
  });
}
