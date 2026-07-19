/**
 * LAN room sync phase and header status chrome.
 */
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { RoomSyncPhase, getRoomSyncPhase, setRoomSyncPhase } from '../../lan-sync-state.mjs';
import { canAttemptAutoHostDetect } from '../../lan-host-detect-guard.mjs';
import { isAutoHostDetectPaused } from '../../lan-host-detect-guard.mjs';
import { isLanSessionConfiguredForRest } from './transport.mjs';
import {
  lanClient,
  activeLiveSyncRoomId,
  activeLiveSyncRoomLabel,
  setActiveLiveSyncRoom,
} from './runtime.mjs';

function resolveActiveRoomForPhase(roomId) {
  var rid = String(roomId || '').trim();
  if (!rid) return '';
  var active = String(activeLiveSyncRoomId || '').trim();
  if (!active) {
    var mem = getRoomMembership();
    if (mem && String(mem.roomId || '').trim() === rid) {
      setActiveLiveSyncRoom(rid, mem.label || rid);
      active = rid;
    }
  }
  if (active && active !== rid) return '';
  return rid;
}

function tryEasyShiftPinReconnect(rid) {
  if (!canAttemptAutoHostDetect()) return;
  void import('../../lan-shift-pin-connect.mjs').then(function (m) {
    if (typeof m.tryEasyLanShiftPinConnect === 'function') {
      return m.tryEasyLanShiftPinConnect({ roomId: rid, silent: true });
    }
  });
}

function resolveRoomSyncPhase(rid) {
  var liveRid = String(lanClient.liveRoomId || '').trim();
  if (lanClient.liveConnected && (liveRid === rid || !liveRid)) {
    return RoomSyncPhase.live;
  }
  var mem = getRoomMembership();
  if (mem && String(mem.roomId || '').trim() === rid) {
    tryEasyShiftPinReconnect(rid);
    return RoomSyncPhase.degraded;
  }
  if (isLanSessionConfiguredForRest()) return RoomSyncPhase.configured;
  return RoomSyncPhase.offline;
}

export function applyRoomSyncPhaseAfterReconcile(roomId) {
  var rid = resolveActiveRoomForPhase(roomId);
  if (!rid) return;
  setRoomSyncPhase(rid, resolveRoomSyncPhase(rid));
}

function liveSyncStatusChromeClass(phase) {
  if (phase === RoomSyncPhase.live) return 'live';
  if (phase === RoomSyncPhase.catching_up || phase === RoomSyncPhase.joining) return 'syncing';
  if (phase === RoomSyncPhase.degraded) return 'degraded';
  if (phase === RoomSyncPhase.configured || phase === RoomSyncPhase.offline) return 'local';
  return 'idle';
}

function liveSyncStatusChromeDetail(roomLabel, phase) {
  var prefix = roomLabel ? 'Sala: ' + roomLabel + ' · ' : '';
  if (phase === RoomSyncPhase.live) {
    return prefix + 'sincronizando pacientes, equipos, labs, agenda y pendientes';
  }
  if (phase === RoomSyncPhase.catching_up) return prefix + 'sincronizando…';
  if (phase === RoomSyncPhase.joining) return prefix + 'conectando…';
  if (phase === RoomSyncPhase.degraded) {
    return prefix + (isAutoHostDetectPaused() ? 'desconectado' : 'reconectando…');
  }
  if (roomLabel) return prefix + 'solo local (sin sync en vivo)';
  return 'Conexión LAN / LiveSync';
}

export function syncLiveSyncStatusChrome() {
  var btn = document.getElementById('btn-header-team-sync');
  if (!btn) return;
  var roomLabel = activeLiveSyncRoomId
    ? activeLiveSyncRoomLabel || activeLiveSyncRoomId
    : '';
  var phase = activeLiveSyncRoomId
    ? getRoomSyncPhase(activeLiveSyncRoomId)
    : RoomSyncPhase.offline;
  var chromeClass = liveSyncStatusChromeClass(phase);
  var detail = liveSyncStatusChromeDetail(roomLabel, phase);
  btn.className =
    'btn-header-icon btn-livesync-header btn-livesync-header--' + chromeClass;
  btn.title = detail;
  btn.setAttribute('aria-label', detail);
}
