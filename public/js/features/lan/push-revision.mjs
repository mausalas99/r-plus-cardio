/**
 * LAN revision hints and debounced reconcile scheduling.
 */
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { lanClient, activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import {
  getLiveSyncRevisionReconcileTimer,
  setLiveSyncRevisionReconcileTimer,
  getLastDeltaSeq,
  setLastDeltaSeq,
} from './runtime.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import { ensureEffectiveLiveSyncRoomId } from './push-helpers.mjs';

function liveSyncRoomIdIsRelevant(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return false;
  if (rid === String(activeLiveSyncRoomId || '').trim()) return true;
  try {
    var mem = getRoomMembership();
    return !!(mem && String(mem.roomId || '').trim() === rid);
  } catch {
    return false;
  }
}

var missingPatientsReconcileTimer = null;
var MISSING_PATIENTS_RECONCILE_DELAY_MS = 20000;

async function tryDeltaReplayFromHint(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return false;
  var afterSeq = getLastDeltaSeq(rid);
  try {
    var res = await lanClient.fetch(
      '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/deltas?afterSeq=' + afterSeq,
      { cache: 'no-store' }
    );
    if (!res || !res.ok) return false;
    var j = await res.json();
    if (!j) return false;
    if (j.fallback === 'sync_bundle') return false;
    if (!Array.isArray(j.deltas) || j.deltas.length === 0) return true;
    await ensureLanSyncPushBridgeWired();
    var b = bridge();
    if (typeof b.applyLiveSyncDeltas !== 'function') return false;
    await b.applyLiveSyncDeltas(rid, j.deltas);
    var maxSeq = j.deltas.reduce(function (m, d) {
      return Math.max(m, Number(d.deltaSeq || d.seq || 0));
    }, afterSeq);
    setLastDeltaSeq(rid, maxSeq);
    return true;
  } catch {
    return false;
  }
}

export function scheduleReconcileFromRevisionHint(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid || !liveSyncRoomIdIsRelevant(rid)) return;
  if (!activeLiveSyncRoomId) ensureEffectiveLiveSyncRoomId();
  setTimeout(function () {
    tryDeltaReplayFromHint(rid).then(function (applied) {
      if (!applied) {
        scheduleReconcileLiveSyncRoom(rid, { reason: 'revision-hint-fallback', delayMs: 0 });
      }
    }).catch(function () {
      scheduleReconcileLiveSyncRoom(rid, { reason: 'revision-hint-error', delayMs: 0 });
    });
  }, 500);
}

export function emitLiveSyncRevisionHint(roomId, revision) {
  var rid = String(roomId || '').trim();
  if (!rid) return;
  if (!lanClient.liveConnected) {
    try {
      lanClient.connectLiveChannel(rid);
    } catch (_e) { void _e; }
  }
  if (!lanClient.liveConnected) return;
  try {
    lanClient.sendLive({
      type: 'livesync:revision',
      roomId: String(roomId || '').trim(),
      revision: Number(revision || 0),
      clientId: getLanClientId(),
    });
  } catch (_e) { void _e; }
}

export function scheduleReconcileLiveSyncRoom(roomId, options) {
  var rid = String(roomId || '').trim();
  if (!rid) return;
  var opts = options || {};
  if (opts.reason === 'missing-patients') {
    if (missingPatientsReconcileTimer) return;
    missingPatientsReconcileTimer = setTimeout(function () {
      missingPatientsReconcileTimer = null;
      void import('./push-reconcile.mjs').then(function (m) {
        return m.reconcileLiveSyncRoom(rid, { reason: 'missing-patients' });
      });
    }, opts.delayMs != null ? opts.delayMs : MISSING_PATIENTS_RECONCILE_DELAY_MS);
    return;
  }
  var delay = opts.delayMs != null ? opts.delayMs : 500;
  var prev = getLiveSyncRevisionReconcileTimer();
  if (prev) clearTimeout(prev);
  setLiveSyncRevisionReconcileTimer(
    setTimeout(function () {
      setLiveSyncRevisionReconcileTimer(null);
      void import('./push-reconcile.mjs').then(function (m) {
        return m.reconcileLiveSyncRoom(rid, { reason: opts.reason || 'scheduled' });
      });
    }, delay)
  );
}
