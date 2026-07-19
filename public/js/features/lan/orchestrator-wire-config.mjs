/** LAN bridge configure/register helpers (orchestrator-wire). */
import {
  registerLanSyncPushBridge,
  scheduleLiveSyncPush,
} from './push.mjs';
import { isLanSessionConfiguredForRest } from './transport.mjs';
import {
  registerLanSyncRoomBridge,
  registerLanSyncRoomWireHandlers,
  buildLiveSyncBundleEnvelope,
  saveLocalRoomSnapshot,
  applyRoomSyncPhaseAfterReconcile,
  syncLiveSyncStatusChrome,
  maybeRevertSurrogateToPrimary,
  fetchAndApplyClinicalOpsFromHost,
} from './room.mjs';
import { registerLanSyncTransportDeps } from './transport.mjs';
import {
  renderLanPanel,
  patchLanPanelJoinButtons,
  rememberLanRoomJoined,
  resolveAutoJoinRoomId,
  openConnectionDropdown,
  bootLanRoomMembership,
  registerLanSyncPanelRuntime,
} from './panel.mjs';
import {
  configureLanConflicts,
  acceptServerBundleConflict,
  acceptServerClinicalOpsConflict,
  appendLanConflictDraftsSection,
} from './conflicts.mjs';
import {
  configureLanEntityVersions,
  getLiveSyncEntityBase,
  rememberLiveSyncEntity,
  syncHostBundleEntityFromApplied,
} from './entity-versions.mjs';
import { configureLanPatientDelete } from './patient-delete.mjs';
import { configureLanHistoriaSync } from './historia-sync.mjs';
import { configureLanPatientEntries } from './patient-entries.mjs';
import {
  configureLanHostPatientHttp,
  lanFetchHostPatientRow,
  lanPushPatientVersioned,
} from './host-patient-http.mjs';
import {
  emitLiveSyncTodoDelete,
  emitLiveSyncTodoUpsert,
  emitLiveSyncPatientDelete,
} from './live-sync-emit.mjs';
import {
  profiledMergeLiveSyncFullBundles,
  renderPatientListLanSilent,
} from './orchestrator-runtime.mjs';
import {
  buildLiveSyncLocalMergeSource,
  collectPatientEntriesForLanSync,
  collectPatientIdsForLiveSync,
  collectTodosMapForLiveSync,
} from './orchestrator-collect.mjs';
import {
  applyLiveSyncMerged,
  applyLiveSyncDeltas,
  reapplyLanPatientEntries,
  applyLiveSyncApplied,
  applyLiveSyncDeltaApplied,
} from './orchestrator-bundle-apply.mjs';
import { joinLanRoom } from './room.mjs';
import { initLanClientFromStorage } from './transport.mjs';

function runtimeToast(runtime) {
  return function (msg, type) {
    runtime.showToast(msg, type);
  };
}

export function configureLanSyncDomainModules(runtime) {
  configureLanPatientEntries({
    runtime: runtime,
    renderPatientListLanSilent: renderPatientListLanSilent,
  });
  configureLanHostPatientHttp({ runtime: runtime });
  configureLanEntityVersions({ showToast: runtimeToast(runtime) });
  configureLanConflicts({
    applyLiveSyncApplied: applyLiveSyncApplied,
    getLiveSyncEntityBase: getLiveSyncEntityBase,
    rememberLiveSyncEntity: rememberLiveSyncEntity,
    syncHostBundleEntityFromApplied: syncHostBundleEntityFromApplied,
    emitLiveSyncTodoDelete: emitLiveSyncTodoDelete,
    emitLiveSyncTodoUpsert: emitLiveSyncTodoUpsert,
    showToast: runtimeToast(runtime),
  });
  configureLanHistoriaSync({
    runtime: runtime,
    lanPushPatientVersioned: lanPushPatientVersioned,
  });
  configureLanPatientDelete({
    lanFetchHostPatientRow: lanFetchHostPatientRow,
    lanPushPatientVersioned: lanPushPatientVersioned,
    emitLiveSyncPatientDelete: emitLiveSyncPatientDelete,
    scheduleLiveSyncPush: scheduleLiveSyncPush,
    runtime: runtime,
  });
}

export function registerLanSyncBridgeHandlers(runtime) {
  registerLanSyncPushBridge({
    isLanSessionConfiguredForRest,
    buildLiveSyncBundleEnvelope,
    saveLocalRoomSnapshot,
    buildLiveSyncLocalMergeSource,
    mergeLiveSyncFullBundles: profiledMergeLiveSyncFullBundles,
    applyLiveSyncMerged,
    applyLiveSyncDeltas,
    reapplyLanPatientEntries,
    applyRoomSyncPhaseAfterReconcile,
    fetchAndApplyClinicalOpsFromHost,
    syncLiveSyncStatusChrome,
    acceptServerBundleConflict,
    acceptServerClinicalOpsConflict,
    renderLanPanel,
    showToast: runtimeToast(runtime),
  });

  registerLanSyncTransportDeps({
    get runtime() { return runtime; },
    renderLanPanel,
    joinLanRoom,
    resolveAutoJoinRoomId,
    openConnectionDropdown,
    bootLanRoomMembership,
  });

  registerLanSyncPanelRuntime(
    Object.assign(runtime, {
      appendLanConflictDraftsSection: appendLanConflictDraftsSection,
    })
  );

  registerLanSyncRoomBridge({
    runtime: runtime,
    renderLanPanel,
    patchLanPanelJoinButtons,
    rememberLanRoomJoined,
    initLanClientFromStorage,
    mergeLiveSyncFullBundles: profiledMergeLiveSyncFullBundles,
    applyLiveSyncMerged,
    applyLiveSyncApplied,
    applyLiveSyncDeltaApplied,
    buildLiveSyncLocalMergeSource,
    collectPatientEntriesForLanSync,
    collectPatientIdsForLiveSync,
    collectTodosMapForLiveSync,
    maybeRevertSurrogateToPrimary,
  });

  registerLanSyncRoomWireHandlers();
}
