/**
 * LAN room join, leave, and post-join reconcile chain.
 */
import { setRoomMembership, clearRoomMembership } from '../../live-sync-membership.mjs';
import { RoomSyncPhase, setRoomSyncPhase, clearRoomSyncPhase } from '../../lan-sync-state.mjs';
import { lanClient, activeLiveSyncRoomId, activeLiveSyncRoomLabel, setActiveLiveSyncRoom, clearActiveLiveSyncRoom, getLanClientId } from './runtime.mjs';
import { isLanSessionConfiguredForRest, isLanElectronDesktop } from './transport.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import { pushRoomSyncBundleToHost, liveSyncBundleHasPayload, scheduleLiveSyncOutboxFlush } from './push.mjs';
import { bridge, runtime, ensureLanSyncRoomBridgeWired } from './room-bridge.mjs';
import { buildLiveSyncBundleEnvelope, saveLocalRoomSnapshot, waitForLiveChannelOpen } from './room-snapshot.mjs';
import { applyRoomSyncPhaseAfterReconcile, syncLiveSyncStatusChrome } from './room-phase-chrome.mjs';
import { startLiveSyncReconnectLoop, stopLiveSyncReconnectLoop, markLiveSyncSessionResyncDone } from './room-host-failover.mjs';
import { syncLiveSyncAfterRoomJoin } from './room-post-join.mjs';

export { syncLiveSyncAfterRoomJoin };
export function leaveLiveSyncRoom(opts) {
  opts = opts || {};
  var roomId = activeLiveSyncRoomId;
  if (roomId) {
    void ensureLanSyncRoomBridgeWired().then(function () {
      return (async function () {
      var bundle = await buildLiveSyncBundleEnvelope(roomId);
      if (!opts.silentLeave) {
        lanClient.sendLive({
          type: 'livesync:leave',
          roomId: roomId,
          clientId: getLanClientId(),
          bundle: bundle,
        });
      }
      saveLocalRoomSnapshot(roomId);
      if (liveSyncBundleHasPayload(bundle)) {
        pushRoomSyncBundleToHost(roomId, bundle);
      }
      })();
    });
  }
  clearActiveLiveSyncRoom();
  if (roomId) clearRoomSyncPhase(roomId);
  clearRoomMembership();
  markLiveSyncSessionResyncDone(false);
  stopLiveSyncReconnectLoop();
  lanClient.disconnectLiveChannel();
  syncLiveSyncStatusChrome();
  void ensureLanSyncRoomBridgeWired().then(function () {
    bridge().patchLanPanelJoinButtons();
    if (typeof renderLanPanel === 'function') bridge().renderLanPanel();
  });
}

async function ensureHostBeforeRoomJoin(id) {
  if (!id) {
    runtime().showToast('No se pudo identificar la sala. Vuelve a abrir ⇄ e inténtalo.', 'error');
    return false;
  }
  if (isLanSessionConfiguredForRest()) return true;
  if (!isLanSkipShiftPin()) {
    runtime().showToast(
      'Primero conecta al servidor del equipo (Activar sala en vivo o pega el enlace de invitación).',
      'error'
    );
    return false;
  }
  if (!isLanElectronDesktop()) {
    runtime().showToast(
      'Primero conecta al servidor del equipo (Activar sala en vivo o pega el enlace de invitación).',
      'error'
    );
    return false;
  }
  try {
    const pinMod = await import('../../lan-shift-pin-connect.mjs');
    if (typeof pinMod.tryEasyLanShiftPinConnect !== 'function') {
      runtime().showToast('Buscando anfitrión del turno…', 'info');
      return false;
    }
    const result = await pinMod.tryEasyLanShiftPinConnect({
      force: true,
      skipCooldown: true,
      silent: true,
    });
    if (result && result.ok && isLanSessionConfiguredForRest()) return true;
  } catch (_e) { void _e; }
  runtime().showToast(
    'No encontramos el anfitrión en esta red. Pulsa Conectar al turno en ⇄ o pega el enlace del R4.',
    'error'
  );
  return false;
}

function ensureLanClientBaseUrl() {
  if (lanClient.baseUrl()) return true;
  try {
    bridge().initLanClientFromStorage();
  } catch (_e) { void _e; }
  if (lanClient.baseUrl()) return true;
  runtime().showToast('Falta la dirección del servidor LAN. Configúrala en ⇄ antes de unirte.', 'error');
  return false;
}

function handleAlreadyJoinedRoom(id, silent) {
  markLiveSyncSessionResyncDone(true);
  applyRoomSyncPhaseAfterReconcile(id);
  syncLiveSyncStatusChrome();
  bridge().patchLanPanelJoinButtons();
  if (!silent) runtime().showToast('Ya estás en esta sala', 'success');
}

function connectLiveSyncRoom(id) {
  if (!lanClient.connected) {
    try {
      lanClient.connectSyncChannel();
    } catch (_e) { void _e; }
  }
  lanClient.connectLiveChannel(id);
  setRoomMembership({ roomId: id, label: activeLiveSyncRoomLabel });
  bridge().rememberLanRoomJoined(id, activeLiveSyncRoomLabel);
  scheduleLiveSyncOutboxFlush();
  startLiveSyncReconnectLoop();
}

async function finishRoomJoinSync(id, opts) {
  if (opts.mobileSharerSync) {
    void finishMobileRoomJoinSync(id);
    return;
  }
  await waitForLiveChannelOpen(id, 5000);
  await syncLiveSyncAfterRoomJoin(id);
  applyRoomSyncPhaseAfterReconcile(id);
  markLiveSyncSessionResyncDone(true);
  syncLiveSyncStatusChrome();
}

/**
 * @param {string} roomId
 * @param {string} [displayName]
 * @param {{ silent?: boolean, mobileSharerSync?: boolean }} [opts]
 */
export async function joinLanRoom(roomId, displayName, opts) {
  opts = opts || {};
  var silent = !!(opts.silent || opts.mobileSharerSync);
  await ensureLanSyncRoomBridgeWired();
  var id = String(roomId || '').trim();
  if (!(await ensureHostBeforeRoomJoin(id))) return;
  if (!ensureLanClientBaseUrl()) return;

  if (
    activeLiveSyncRoomId === id &&
    String(lanClient.liveRoomId || '') === id &&
    lanClient.liveConnected
  ) {
    handleAlreadyJoinedRoom(id, silent);
    return;
  }
  if (activeLiveSyncRoomId && activeLiveSyncRoomId !== id) {
    leaveLiveSyncRoom({ silentLeave: false });
  }
  setActiveLiveSyncRoom(id, displayName != null ? String(displayName) : id);
  setRoomSyncPhase(id, RoomSyncPhase.joining);
  syncLiveSyncStatusChrome();
  try {
    connectLiveSyncRoom(id);
  } catch {
    clearActiveLiveSyncRoom();
    clearRoomSyncPhase(id);
    runtime().showToast('No se pudo activar relay de sala', 'error');
    return;
  }
  if (!silent) {
    runtime().showToast('Sala: sincronizando expediente, agenda y pendientes', 'success');
  }
  syncLiveSyncStatusChrome();
  bridge().patchLanPanelJoinButtons();
  await finishRoomJoinSync(id, opts);
}

async function finishMobileRoomJoinSync(roomId) {
  var id = String(roomId || '').trim();
  if (!id) return;
  try {
    await waitForLiveChannelOpen(id, 3500);
    await syncLiveSyncAfterRoomJoin(id);
    applyRoomSyncPhaseAfterReconcile(id);
    markLiveSyncSessionResyncDone(true);
    syncLiveSyncStatusChrome();
  } finally {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('rpc-mobile-lan-sync-settled'));
    }
  }
}
