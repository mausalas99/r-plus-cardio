/**
 * Post-join reconcile chain (clinical ops, bundle, hello).
 */
import { activeLiveSyncRoomId } from './runtime.mjs';
import { isClinicalOpsLanAvailable, prepareClinicalOpsForLanSync } from '../../clinical-ops-lan.mjs';
import { lanClient } from './runtime.mjs';
import {
  pushClinicalOpsLanNow,
  scheduleLiveSyncPush,
  reconcileLiveSyncRoom,
} from './push.mjs';
import { runtime, ensureLanSyncRoomBridgeWired } from './room-bridge.mjs';
import { buildLiveSyncHelloPayload, enrichLiveSyncHelloPayload } from './room-snapshot.mjs';
import { applyRoomSyncPhaseAfterReconcile, syncLiveSyncStatusChrome } from './room-phase-chrome.mjs';
import { fetchAndApplyClinicalOpsFromHost } from './room-clinical-ops.mjs';

export function syncLiveSyncAfterRoomJoin(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return Promise.resolve();
  return ensureLanSyncRoomBridgeWired().then(function () {
    return syncLiveSyncAfterRoomJoinBody(rid);
  });
}

function syncLiveSyncAfterRoomJoinBody(rid) {
  var chain = Promise.resolve();
  if (isClinicalOpsLanAvailable()) {
    chain = chain.then(function () {
      return import('../../clinical-ops-lan.mjs').then(function (mod) {
        return mod.flushPendingClinicalOpsLanSnapshot();
      });
    });
  }
  if (isClinicalOpsLanAvailable()) {
    chain = chain
      .then(function () {
        return prepareClinicalOpsForLanSync();
      })
      .then(function () {
        return pushClinicalOpsLanNow();
      });
  }
  return chain
    .then(function () {
      return reconcileLiveSyncRoom(rid, { force: true, reason: 'room-join' });
    })
    .then(function () {
      if (activeLiveSyncRoomId !== rid) return;
      return fetchAndApplyClinicalOpsFromHost(rid, { skipGossipPush: true });
    })
    .then(function () {
      if (activeLiveSyncRoomId !== rid) return;
      applyRoomSyncPhaseAfterReconcile(rid);
      scheduleLiveSyncPush();
      if (isClinicalOpsLanAvailable()) {
        void pushClinicalOpsLanNow().catch(function () {});
      }
      if (lanClient.liveConnected) {
        void enrichLiveSyncHelloPayload(buildLiveSyncHelloPayload(rid)).then(function (hello) {
          if (activeLiveSyncRoomId !== rid) return;
          try {
            lanClient.sendLive(hello);
          } catch (_e) { void _e; }
        });
      }
      syncLiveSyncStatusChrome();
      runtime().renderProcedureAgendaPanel();
      void import('../../clinical-access-runtime.mjs').then(function (accessMod) {
        if (typeof accessMod.refreshClinicalPatientListForScope === 'function') {
          return accessMod.refreshClinicalPatientListForScope({ allowLanPull: true });
        }
        runtime().renderPatientList({ silent: true });
      });
      void import('../../historia-clinica-lan-sync.mjs').then(function (m) {
        return m.scheduleFlushAllPendingHistoriaClinicaLanSync();
      });
    });
}
