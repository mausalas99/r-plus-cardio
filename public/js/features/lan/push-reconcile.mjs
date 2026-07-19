/**
 * Full LAN room reconcile (HTTP sync-bundle).
 */
import { storage } from '../../storage.js';
import { setHostBundleBases } from '../../host-bundle-bases.mjs';
import {
  prepareClinicalOpsForLanSync,
  isClinicalOpsLanAvailable,
} from '../../clinical-ops-lan.mjs';
import { RoomSyncPhase, getRoomSyncPhase, setRoomSyncPhase } from '../../lan-sync-state.mjs';
import { recordLanSyncError } from '../../lan-sync-diagnostics.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { lanClient, activeLiveSyncRoomId, resetLastDeltaSeq } from './runtime.mjs';
import { getReconcileCooldownMs } from './runtime.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import { ensureEffectiveLiveSyncRoomId } from './push-helpers.mjs';
import { flushLiveSyncOutbox } from './push-outbox.mjs';
import { scheduleReconcileLiveSyncRoom } from './push-revision.mjs';
import { patients } from '../../app-state.mjs';

var reconcileInFlight = null;
var reconcilePendingRoomId = '';
var reconcileLastFinishedAt = 0;

function finishReconcilePhase(rid, b) {
  if (!rid) return;
  if (b && typeof b.applyRoomSyncPhaseAfterReconcile === 'function') {
    b.applyRoomSyncPhaseAfterReconcile(rid);
    if (typeof b.syncLiveSyncStatusChrome === 'function') b.syncLiveSyncStatusChrome();
    return;
  }
  void import('./room.mjs').then(function (mod) {
    if (typeof mod.applyRoomSyncPhaseAfterReconcile === 'function') {
      mod.applyRoomSyncPhaseAfterReconcile(rid);
    }
    if (typeof mod.syncLiveSyncStatusChrome === 'function') mod.syncLiveSyncStatusChrome();
  });
}

function getSyncBundleFetchMs() {
  if (!isMobileWeb()) return 8000;
  return window.__RPC_MOBILE_SYNC_BUNDLE_DONE__ ? 20000 : 12000;
}

function showMobileNoBundleToast(b) {
  if (!isMobileWeb() || typeof b.showToast !== 'function') return;
  b.showToast(
    'El anfitrión aún no compartió pacientes en esta sala. En la Mac anfitrión: abre ⇄ y pulsa «Unirse» en la misma sala; luego en el iPad ⇄ → Unirse otra vez.',
    'warn'
  );
}

async function fetchHostSyncBundle(rid, b) {
  const syncPath = '/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/sync-bundle';
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    ac &&
    setTimeout(() => {
      ac.abort();
    }, getSyncBundleFetchMs());
  try {
    var resp = await lanClient.fetch(syncPath, ac ? { signal: ac.signal, cache: 'no-store' } : {});
    if (timer) clearTimeout(timer);
    if (resp && resp.status === 404) {
      recordLanSyncError({
        op: 'sync-bundle',
        code: 'NO_BUNDLE',
        message: 'host has no room bundle yet',
      });
      showMobileNoBundleToast(b);
      return null;
    }
    if (!resp || !resp.ok) return null;
    var j = await resp.json();
    if (!j || !j.bundle) return null;
    setHostBundleBases(rid, j.bundle);
    resetLastDeltaSeq(rid);
    if (isMobileWeb()) window.__RPC_MOBILE_SYNC_BUNDLE_DONE__ = true;
    return j.bundle;
  } catch {
    if (timer) clearTimeout(timer);
    return null;
  }
}

function markRoomCatchingUpIfNeeded(rid, b) {
  if (String(activeLiveSyncRoomId || '').trim() !== rid) return;
  if (getRoomSyncPhase(rid) === RoomSyncPhase.live) return;
  setRoomSyncPhase(rid, RoomSyncPhase.catching_up);
  if (typeof b.syncLiveSyncStatusChrome === 'function') b.syncLiveSyncStatusChrome();
}

async function mergeAndApplyReconcileSources(rid, b) {
  var sources = [];
  var local = storage.getLanRoomSnapshot(rid);
  if (local) sources.push(local);
  var hostBundle = await fetchHostSyncBundle(rid, b);
  var hostBundleLoaded = !!hostBundle;
  if (hostBundle) sources.push(hostBundle);
  sources.push(b.buildLiveSyncLocalMergeSource());
  if (!sources.length) return hostBundleLoaded;
  var merged = b.mergeLiveSyncFullBundles(sources);
  var bundleHadClinicalOps = !!(merged && merged.clinicalOps);
  await b.applyLiveSyncMerged(merged);
  await maybeCatchUpClinicalOps(rid, b, merged, bundleHadClinicalOps);
  maybeToastEmptyMobileBundle(b, hostBundleLoaded, merged);
  return hostBundleLoaded;
}

async function reconcileLiveSyncRoomBody(roomId) {
  await ensureLanSyncPushBridgeWired();
  var rid = String(roomId || ensureEffectiveLiveSyncRoomId() || '').trim();
  if (!rid) return false;
  if (!activeLiveSyncRoomId) ensureEffectiveLiveSyncRoomId();
  var b;
  try {
    b = bridge();
    markRoomCatchingUpIfNeeded(rid, b);
    if (isClinicalOpsLanAvailable()) {
      await prepareClinicalOpsForLanSync();
    }
    await mergeAndApplyReconcileSources(rid, b);
    return flushLiveSyncOutbox(rid);
  } catch (err) {
    recordLanSyncError({
      op: 'reconcile',
      code: 'RECONCILE',
      message: err && err.message ? err.message : 'reconcile failed',
    });
    return false;
  } finally {
    finishReconcilePhase(rid, b);
  }
}

async function maybeCatchUpClinicalOps(rid, b, merged, bundleHadClinicalOps) {
  if (bundleHadClinicalOps) return;
  if (!isClinicalOpsLanAvailable() && !isMobileWeb()) return;
  if (typeof b.fetchAndApplyClinicalOpsFromHost !== 'function') return;
  try {
    const opsApplied = await b.fetchAndApplyClinicalOpsFromHost(rid, { skipGossipPush: true });
    if (
      opsApplied &&
      merged &&
      merged.entries &&
      merged.entries.length &&
      typeof b.reapplyLanPatientEntries === 'function'
    ) {
      await b.reapplyLanPatientEntries(merged.entries);
    }
  } catch (_e) { void _e; }
}

function maybeToastEmptyMobileBundle(b, hostBundleLoaded, merged) {
  if (
    !isMobileWeb() ||
    !hostBundleLoaded ||
    (merged && merged.entries && merged.entries.length) ||
    (patients && patients.length)
  ) {
    return;
  }
  if (typeof b.showToast === 'function') {
    b.showToast(
      'La sala está vacía en el anfitrión. Confirma que la Mac anfitrión tiene pacientes y está unida a esta sala.',
      'info'
    );
  }
}

export async function reconcileLiveSyncRoom(roomId, options) {
  var rid = String(roomId || ensureEffectiveLiveSyncRoomId() || '').trim();
  if (!rid) return false;
  var opts = options || {};
  if (reconcileInFlight) {
    reconcilePendingRoomId = rid;
    return reconcileInFlight;
  }
  var now = Date.now();
  if (
    !opts.force &&
    opts.reason !== 'revision-hint' &&
    now - reconcileLastFinishedAt < getReconcileCooldownMs()
  ) {
    scheduleReconcileLiveSyncRoom(rid, {
      reason: opts.reason || 'cooldown',
      delayMs: getReconcileCooldownMs() - (now - reconcileLastFinishedAt),
    });
    return false;
  }
  reconcileInFlight = reconcileLiveSyncRoomBody(rid)
    .finally(function () {
      reconcileLastFinishedAt = Date.now();
      reconcileInFlight = null;
      var pending = reconcilePendingRoomId;
      reconcilePendingRoomId = '';
      if (pending) {
        scheduleReconcileLiveSyncRoom(pending, { reason: 'pending', delayMs: 1500 });
      }
    });
  return reconcileInFlight;
}
