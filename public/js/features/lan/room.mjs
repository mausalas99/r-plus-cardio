/**
 * LAN LiveSync room membership, wire messages, and reconnect (IM-11) — façade.
 */
export {
  registerLanSyncRoomBridge,
  ensureLanSyncRoomBridgeWired,
  shouldApplyCommandBroadcast,
  updateCommandSeqState,
} from './room-bridge.mjs';

export {
  resolveSelfLanAdvertiseHostUrl,
  buildLiveSyncHelloPayload,
  enrichLiveSyncHelloPayload,
  saveLocalRoomSnapshot,
  buildLiveSyncBundleEnvelope,
  waitForLiveChannelOpen,
} from './room-snapshot.mjs';

export {
  stopSurrogateFailoverTimer,
  scheduleSurrogateFailoverCheck,
  tryReconnectLanToHostUrl,
  promoteSelfToSurrogateHost,
  maybeRevertSurrogateToPrimary,
  runSurrogateFailoverCheck,
  stopLiveSyncReconnectLoop,
  resumeAutoHostDetectAndReconnect,
  startLiveSyncReconnectLoop,
  bootLanRoomMembership,
} from './room-host-failover.mjs';

export { applyRoomSyncPhaseAfterReconcile, syncLiveSyncStatusChrome } from './room-phase-chrome.mjs';

export {
  fetchClinicalOpsFromAlternateHost,
  fetchAndApplyClinicalOpsFromHost,
  refreshLanClinicalDirectoryFromRoom,
} from './room-clinical-ops.mjs';

export { onLiveSyncWireMessage, registerLanSyncRoomWireHandlers } from './room-wire.mjs';

export {
  syncLiveSyncAfterRoomJoin,
  leaveLiveSyncRoom,
  joinLanRoom,
} from './room-membership.mjs';

export { getActiveLiveSyncRoomId } from './runtime.mjs';
