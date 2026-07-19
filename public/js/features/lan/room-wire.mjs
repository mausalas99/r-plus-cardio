/**
 * LAN LiveSync wire message dispatch.
 */
import { isLiveSyncEnvelope } from '../../live-sync-room.mjs';
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import { lanClient, activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import { storage } from '../../storage.js';
import { isLanRemoteJoinMode, getLanTeamCodeFromConfig } from './transport.mjs';
import { recordLivePeer } from '../../lan-surrogate-host.mjs';
import { emitLiveSyncRevisionHint, scheduleReconcileFromRevisionHint } from './push.mjs';
import { bridge, ensureLanSyncRoomBridgeWired, getCommandSeqState, setCommandSeqState } from './room-bridge.mjs';
import { shouldApplyCommandBroadcast, updateCommandSeqState } from './room-bridge.mjs';
import { tryReconnectLanToHostUrl, maybeRevertSurrogateToPrimary, startLiveSyncReconnectLoop, scheduleSurrogateFailoverCheck } from './room-host-failover.mjs';
import { scheduleClinicalOpsPullFromHost } from './room-clinical-ops.mjs';
import { syncLiveSyncAfterRoomJoin } from './room-post-join.mjs';
import { saveLocalRoomSnapshot } from './room-snapshot.mjs';
import { syncLiveSyncStatusChrome } from './room-phase-chrome.mjs';
import { RoomSyncPhase, setRoomSyncPhase } from '../../lan-sync-state.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { flushLiveSyncOutbox } from './push.mjs';

export function onLiveSyncWireMessage(data) {
  if (!data || !isLiveSyncEnvelope(data)) return;
  if (data.roomId && activeLiveSyncRoomId && data.roomId !== activeLiveSyncRoomId) return;
  void ensureLanSyncRoomBridgeWired().then(function () {
    onLiveSyncWireMessageBody(data);
  });
}

function handleLiveSyncHelloOrHandoff(data, myId) {
  if (data.clientId === myId) return;
  recordLivePeer(data.clientId, {
    hostUrl: data.newHostUrl || data.hostUrl,
    canHost: !!data.canHost,
  });
  if (data.type === 'livesync:host-handoff' && data.newHostUrl) {
    var newUrl = String(data.newHostUrl || '')
      .trim()
      .replace(/\/+$/, '');
    var cfgNow = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
    var curUrl = String(cfgNow.hostUrl || '')
      .trim()
      .replace(/\/+$/, '');
    if (newUrl && newUrl !== curUrl && isLanRemoteJoinMode()) {
      void tryReconnectLanToHostUrl(newUrl, getLanTeamCodeFromConfig());
    }
  }
  if (data.type === 'livesync:hello' && activeLiveSyncRoomId) {
    scheduleClinicalOpsPullFromHost(activeLiveSyncRoomId);
    const bases = getHostBundleBases(activeLiveSyncRoomId);
    emitLiveSyncRevisionHint(activeLiveSyncRoomId, bases ? bases.revision : 0);
  }
}

function handleLiveSyncCommandApplied(data) {
  const decision = shouldApplyCommandBroadcast(getCommandSeqState(), data);
  if (decision.action === 'catch_up') {
    scheduleReconcileFromRevisionHint(data.roomId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lan-command-gap', {
        detail: { afterSeq: decision.afterSeq, message: data },
      }));
    }
    return;
  }
  if (decision.action === 'ignore') return;
  setCommandSeqState(updateCommandSeqState(getCommandSeqState(), data));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lan-command-applied', { detail: data }));
  }
}

const LIVE_SYNC_WIRE_HANDLERS = {
  'livesync:hello': function (data, myId) {
    handleLiveSyncHelloOrHandoff(data, myId);
  },
  'livesync:host-handoff': function (data, myId) {
    handleLiveSyncHelloOrHandoff(data, myId);
  },
  'livesync:leave': function (data, myId) {
    if (!data.bundle || data.clientId === myId) return;
    void bridge().applyLiveSyncMerged(
      bridge().mergeLiveSyncFullBundles([data.bundle, bridge().buildLiveSyncLocalMergeSource()])
    );
  },
  'livesync:revision': function (data, myId) {
    if (data.clientId === myId) return;
    scheduleClinicalOpsPullFromHost(data.roomId);
    scheduleReconcileFromRevisionHint(data.roomId);
  },
  'livesync:bundle': function (data) {
    var mergedBundle = bridge().mergeLiveSyncFullBundles([data, bridge().buildLiveSyncLocalMergeSource()]);
    void bridge().applyLiveSyncMerged(mergedBundle);
  },
  'livesync:delta:applied': function (data) {
    bridge().applyLiveSyncDeltaApplied(data);
  },
  'livesync:command:applied': function (data) {
    handleLiveSyncCommandApplied(data);
  },
  'livesync:applied': function (data) {
    bridge().applyLiveSyncApplied(data);
  },
};

function onLiveSyncWireMessageBody(data) {
  var myId = getLanClientId();
  var handler = LIVE_SYNC_WIRE_HANDLERS[data.type];
  if (!handler) return;
  if (data.clientId === myId && data.type !== 'livesync:hello') return;
  handler(data, myId);
}


export function registerLanSyncRoomWireHandlers() {
  lanClient.addEventListener('lan-live', function (ev) {
    onLiveSyncWireMessage(ev.detail);
  });
  lanClient.addEventListener('lan-live-status', function (ev) {
    if (!ev.detail) return;
    if (ev.detail.connected && activeLiveSyncRoomId) {
      syncLiveSyncAfterRoomJoin(activeLiveSyncRoomId);
      flushLiveSyncOutbox(activeLiveSyncRoomId);
      void import('../../historia-clinica-lan-sync.mjs').then(function (m) {
        return m.scheduleFlushAllPendingHistoriaClinicaLanSync();
      });
      void maybeRevertSurrogateToPrimary();
    } else if (!ev.detail.connected && activeLiveSyncRoomId) {
      setRoomSyncPhase(activeLiveSyncRoomId, RoomSyncPhase.degraded);
      saveLocalRoomSnapshot(activeLiveSyncRoomId);
      startLiveSyncReconnectLoop();
      if (!lanClient.connected) scheduleSurrogateFailoverCheck();
    }
    syncLiveSyncStatusChrome();
  });
  lanClient.addEventListener('lan-status', function (ev) {
    if (!ev.detail || ev.detail.connected) return;
    if (activeLiveSyncRoomId && getRoomMembership()) scheduleSurrogateFailoverCheck();
  });
}
