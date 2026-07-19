/**
 * LAN surrogate host election, reconnect loop, and boot membership.
 */
import { storage } from '../../storage.js';
import { getRoomMembership, migrateLastRoomToMembership } from '../../live-sync-membership.mjs';
import { RoomSyncPhase, setRoomSyncPhase } from '../../lan-sync-state.mjs';
import { recordLanSyncError } from '../../lan-sync-diagnostics.mjs';
import { getPrimaryHostUrl, listLivePeerHostUrls, pingLanHostUrl, getSurrogateHostState, setSurrogateHostState, clearSurrogateHostState, isSurrogateHostActive, surrogateElectionDelayMs } from '../../lan-surrogate-host.mjs';
import {
  canAttemptAutoHostDetect,
  recordAutoHostDetectMiss,
  recordAutoHostDetectSuccess,
  resumeAutoHostDetect,
} from '../../lan-host-detect-guard.mjs';
import { getPinnedHostUrl } from '../../lan-host-pin.mjs';
import {
  pushRoomSyncBundleToHost,
  flushLiveSyncOutbox,
  scheduleLiveSyncOutboxFlush,
} from './push.mjs';
import { lanClient, activeLiveSyncRoomId, getLanClientId, setActiveLiveSyncRoom } from './runtime.mjs';
import {
  isLanSessionConfiguredForRest,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  resolveLanHostUrlAuto,
} from './transport.mjs';
import { bridge, runtime, ensureLanSyncRoomBridgeWired } from './room-bridge.mjs';
import {
  buildLiveSyncBundleEnvelope,
  buildLiveSyncHelloPayload,
  enrichLiveSyncHelloPayload,
  waitForLiveChannelOpen,
} from './room-snapshot.mjs';
import { applyRoomSyncPhaseAfterReconcile, syncLiveSyncStatusChrome } from './room-phase-chrome.mjs';
import { syncLiveSyncAfterRoomJoin } from './room-post-join.mjs';

var _surrogateFailoverTimer = null;
var _liveSyncReconnectTimer = null;
var _liveSyncReconnectAttempt = 0;
/** Once per cold start: full reconcile/push even if live WS already looks connected. */
let _liveSyncSessionResyncDone = false;
let _shiftPinRediscoverInFlight = false;

export function markLiveSyncSessionResyncDone(value = true) {
  _liveSyncSessionResyncDone = !!value;
}

export function stopSurrogateFailoverTimer() {
  if (_surrogateFailoverTimer) {
    clearTimeout(_surrogateFailoverTimer);
    _surrogateFailoverTimer = null;
  }
}

export function scheduleSurrogateFailoverCheck() {
  if (!activeLiveSyncRoomId || !getRoomMembership()) return;
  if (!canAttemptAutoHostDetect()) return;
  stopSurrogateFailoverTimer();
  _surrogateFailoverTimer = setTimeout(function () {
    _surrogateFailoverTimer = null;
    void runSurrogateFailoverCheck();
  }, 1200);
}

export async function tryReconnectLanToHostUrl(hostUrl, teamCode) {
  await ensureLanSyncRoomBridgeWired();
  var targetUrl = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var currentUrl = String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  var pinned = getPinnedHostUrl();
  var switchOpts = { skipRememberPrimary: true };
  if (targetUrl && targetUrl !== currentUrl && pinned && targetUrl !== pinned) {
    runtime().showToast('Anfitrión fijado: ' + pinned + '.', 'info');
    return false;
  }
  if (!applyLanHostUrlSwitch(hostUrl, teamCode, switchOpts)) return false;
  var ok = await pingLanHostUrl(hostUrl, teamCode);
  if (!ok) return false;
  var rid = activeLiveSyncRoomId;
  if (rid) {
    try {
      lanClient.connectLiveChannel(rid);
    } catch (_e) { void _e; }
    await syncLiveSyncAfterRoomJoin(rid);
    startLiveSyncReconnectLoop();
  }
  recordAutoHostDetectSuccess();
  syncLiveSyncStatusChrome();
  bridge().patchLanPanelJoinButtons();
  return true;
}

async function broadcastSurrogateHandoff(localUrl, activeRoomId) {
  var handoff = await enrichLiveSyncHelloPayload(buildLiveSyncHelloPayload(activeRoomId));
  handoff.type = 'livesync:host-handoff';
  handoff.newHostUrl = localUrl;
  handoff.reason = 'surrogate-promoted';
  try {
    lanClient.sendLive(handoff);
  } catch (_e) { void _e; }
}

function readSurrogateFormerHost(cfg) {
  return String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
}

async function connectSurrogateLiveChannels(roomId) {
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
    lanClient.connectLiveChannel(roomId);
  } catch (_e) { void _e; }
}

export async function promoteSelfToSurrogateHost() {
  await ensureLanSyncRoomBridgeWired();
  if (typeof window !== 'undefined' && window.electronAPI?.ensureLanServerReady) {
    await window.electronAPI.ensureLanServerReady();
  }
  if (!isLanElectronDesktop() || !isLanRemoteJoinMode()) return false;
  if (!activeLiveSyncRoomId || isSurrogateHostActive()) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var formerUrl = readSurrogateFormerHost(cfg);
  var formerCode = getLanTeamCodeFromConfig();
  var localUrl = await resolveLanHostUrlAuto();
  if (!localUrl) return false;
  if (formerUrl && (await pingLanHostUrl(formerUrl, formerCode))) return false;
  setSurrogateHostState({
    formerHostUrl: formerUrl || getPrimaryHostUrl(),
    formerTeamCode: formerCode,
    localHostUrl: localUrl,
    roomId: activeLiveSyncRoomId,
    promotedAt: new Date().toISOString(),
  });
  applyLanHostUrlSwitch(localUrl, formerCode, { skipRememberPrimary: true });
  var bundle = await buildLiveSyncBundleEnvelope(activeLiveSyncRoomId);
  await pushRoomSyncBundleToHost(activeLiveSyncRoomId, bundle);
  await connectSurrogateLiveChannels(activeLiveSyncRoomId);
  await syncLiveSyncAfterRoomJoin(activeLiveSyncRoomId);
  startLiveSyncReconnectLoop();
  await broadcastSurrogateHandoff(localUrl, activeLiveSyncRoomId);
  runtime().showToast(
    'El anfitrión se desconectó: esta Mac asume el servidor hasta que vuelva. Comparte de nuevo la invitación si alguien no reconecta solo.',
    'success'
  );
  bridge().renderLanPanel();
  return true;
}

export async function maybeRevertSurrogateToPrimary() {
  await ensureLanSyncRoomBridgeWired();
  var st = getSurrogateHostState();
  if (!st || !st.formerHostUrl) return false;
  var code = st.formerTeamCode || getLanTeamCodeFromConfig();
  if (!(await pingLanHostUrl(st.formerHostUrl, code))) return false;
  if (activeLiveSyncRoomId) {
    var bundle = await buildLiveSyncBundleEnvelope(activeLiveSyncRoomId);
    var prevUrl = lanClient.baseUrl();
    applyLanHostUrlSwitch(st.formerHostUrl, code, { skipRememberPrimary: true });
    await pushRoomSyncBundleToHost(activeLiveSyncRoomId, bundle);
    if (!(await pingLanHostUrl(st.formerHostUrl, code))) {
      applyLanHostUrlSwitch(prevUrl, code, { skipRememberPrimary: true });
      return false;
    }
  }
  clearSurrogateHostState();
  applyLanHostUrlSwitch(st.formerHostUrl, code, { skipRememberPrimary: false });
  if (activeLiveSyncRoomId) {
    try {
      lanClient.connectLiveChannel(activeLiveSyncRoomId);
    } catch (_e) { void _e; }
    await syncLiveSyncAfterRoomJoin(activeLiveSyncRoomId);
  }
  runtime().showToast('El anfitrión original volvió: esta Mac dejó de ser servidor temporal.', 'success');
  bridge().renderLanPanel();
  return true;
}

async function reconnectLiveChannelsAfterPing() {
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
    if (activeLiveSyncRoomId) lanClient.connectLiveChannel(activeLiveSyncRoomId);
  } catch (_e) { void _e; }
  if (isSurrogateHostActive()) void maybeRevertSurrogateToPrimary();
}

function collectFailoverTargets(currentUrl) {
  var targets = [];
  var primary = getPrimaryHostUrl();
  if (primary && primary !== currentUrl) targets.push(primary);
  listLivePeerHostUrls(getLanClientId()).forEach(function (u) {
    if (u && targets.indexOf(u) === -1 && u !== currentUrl) targets.push(u);
  });
  return { targets: targets, primary: primary };
}

async function tryReconnectFailoverTargets(targets, teamCode, primary) {
  for (var i = 0; i < targets.length; i += 1) {
    if (!(await tryReconnectLanToHostUrl(targets[i], teamCode))) continue;
    if (targets[i] !== primary) {
      runtime().showToast('Reconectado al nuevo anfitrión de la sala.', 'success');
    } else if (!isSurrogateHostActive()) {
      runtime().showToast('Anfitrión original de vuelta.', 'success');
    }
    return true;
  }
  return false;
}

async function tryDelayedFailoverReconnect(targets, primary, teamCode) {
  await new Promise(function (r) {
    setTimeout(r, surrogateElectionDelayMs(getLanClientId()));
  });
  if (lanClient.connected && lanClient.liveConnected) return true;
  if (primary && (await pingLanHostUrl(primary, teamCode))) {
    await tryReconnectLanToHostUrl(primary, teamCode);
    return true;
  }
  for (var j = 0; j < targets.length; j += 1) {
    if (!(await pingLanHostUrl(targets[j], teamCode))) continue;
    await tryReconnectLanToHostUrl(targets[j], teamCode);
    return true;
  }
  return false;
}

async function trySurrogatePromotionAfterMiss() {
  if (!canAttemptAutoHostDetect()) return;
  recordAutoHostDetectMiss();
  if (!canAttemptAutoHostDetect()) return;
  await promoteSelfToSurrogateHost();
}

async function runFailoverReconnectPhase(teamCode, currentUrl) {
  if (currentUrl && (await pingLanHostUrl(currentUrl, teamCode))) {
    await reconnectLiveChannelsAfterPing();
    return true;
  }
  if (isSurrogateHostActive() && (await maybeRevertSurrogateToPrimary())) return true;
  var collected = collectFailoverTargets(currentUrl);
  if (await tryReconnectFailoverTargets(collected.targets, teamCode, collected.primary)) return true;
  if (!isLanElectronDesktop() || !isLanRemoteJoinMode()) return true;
  if (await tryDelayedFailoverReconnect(collected.targets, collected.primary, teamCode)) return true;
  return false;
}

export async function runSurrogateFailoverCheck() {
  if (!activeLiveSyncRoomId || !getRoomMembership()) return;
  if (!canAttemptAutoHostDetect()) return;
  if (lanClient.connected && lanClient.liveConnected) return;
  var teamCode = getLanTeamCodeFromConfig();
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var currentUrl = readSurrogateFormerHost(cfg);
  if (await runFailoverReconnectPhase(teamCode, currentUrl)) return;
  await trySurrogatePromotionAfterMiss();
}


export function stopLiveSyncReconnectLoop() {
  if (_liveSyncReconnectTimer) {
    clearTimeout(_liveSyncReconnectTimer);
    _liveSyncReconnectTimer = null;
  }
}

export function resumeAutoHostDetectAndReconnect() {
  resumeAutoHostDetect();
  _liveSyncReconnectAttempt = 0;
  if (getRoomMembership()?.roomId) {
    startLiveSyncReconnectLoop();
  }
}

function handleLiveReconnectTick(mem, scheduleReconnect) {
  if (lanClient.liveConnected && String(lanClient.liveRoomId || '') === mem.roomId) {
    _liveSyncReconnectAttempt = 0;
    recordAutoHostDetectSuccess();
    if (!_liveSyncSessionResyncDone) {
      markLiveSyncSessionResyncDone(true);
      void syncLiveSyncAfterRoomJoin(mem.roomId).then(function () {
        return flushLiveSyncOutbox(mem.roomId);
      });
    }
    syncLiveSyncStatusChrome();
    scheduleReconnect();
    return true;
  }
  return false;
}

function tryShiftPinRediscover(mem) {
  if (_liveSyncReconnectAttempt < 2 || _shiftPinRediscoverInFlight || !canAttemptAutoHostDetect()) return;
  _shiftPinRediscoverInFlight = true;
  void import('../../lan-shift-pin-connect.mjs')
    .then(function (mod) {
      if (typeof mod.tryEasyLanShiftPinConnect !== 'function') return { ok: false };
      return mod.tryEasyLanShiftPinConnect({
        roomId: mem.roomId,
        silent: true,
        skipCooldown: true,
      });
    })
    .finally(function () {
      _shiftPinRediscoverInFlight = false;
    });
}

function attemptLiveChannelReconnect(mem) {
  if (!isLanSessionConfiguredForRest()) return;
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
    lanClient.connectLiveChannel(mem.roomId);
    syncLiveSyncAfterRoomJoin(mem.roomId);
  } catch (_e) { void _e; }
}

export function startLiveSyncReconnectLoop() {
  stopLiveSyncReconnectLoop();
  var m = getRoomMembership();
  if (!m || !m.roomId) return;
  function tick() {
    var mem = getRoomMembership();
    if (!mem || !mem.roomId) {
      stopLiveSyncReconnectLoop();
      return;
    }
    if (!activeLiveSyncRoomId) {
      setActiveLiveSyncRoom(mem.roomId, mem.label);
    }
    if (handleLiveReconnectTick(mem, scheduleReconnect)) return;
    if (!canAttemptAutoHostDetect()) {
      syncLiveSyncStatusChrome();
      stopLiveSyncReconnectLoop();
      return;
    }
    if (typeof lanClient.isLiveChannelBusy === 'function' && lanClient.isLiveChannelBusy(mem.roomId)) {
      syncLiveSyncStatusChrome();
      scheduleReconnect();
      return;
    }
    attemptLiveChannelReconnect(mem);
    _liveSyncReconnectAttempt += 1;
    tryShiftPinRediscover(mem);
    if (_liveSyncReconnectAttempt >= 3 && canAttemptAutoHostDetect()) {
      scheduleSurrogateFailoverCheck();
    }
    syncLiveSyncStatusChrome();
    if (!canAttemptAutoHostDetect()) {
      stopLiveSyncReconnectLoop();
      return;
    }
    scheduleReconnect();
  }
  function scheduleReconnect() {
    var delay = Math.min(30000, 1000 * Math.pow(2, Math.min(_liveSyncReconnectAttempt, 5)));
    _liveSyncReconnectTimer = setTimeout(tick, delay);
  }
  tick();
}

export function bootLanRoomMembership() {
  migrateLastRoomToMembership();
  var m = getRoomMembership();
  if (!m || !m.roomId || !isLanSessionConfiguredForRest()) return;
  setActiveLiveSyncRoom(m.roomId, m.label);
  setRoomSyncPhase(m.roomId, RoomSyncPhase.catching_up);
  scheduleLiveSyncOutboxFlush();
  void (async function () {
    var rid = m.roomId;
    try {
      const accessMod = await import('../../clinical-access-runtime.mjs');
      if (typeof accessMod.waitForClinicalAccessReady === 'function') {
        await accessMod.waitForClinicalAccessReady();
      }
      try {
        if (!lanClient.connected) lanClient.connectSyncChannel();
        lanClient.connectLiveChannel(rid);
      } catch (_e) { void _e; }
      var liveOpen = await waitForLiveChannelOpen(rid, 8000);
      if (!liveOpen) {
        recordLanSyncError({
          op: 'live-ws',
          code: 'TIMEOUT',
          message: 'Canal live no conectó en 8s; sync HTTP sigue activo',
        });
        try {
          const pinMod = await import('../../lan-shift-pin-connect.mjs');
          if (typeof pinMod.tryEasyLanShiftPinConnect === 'function') {
            await pinMod.tryEasyLanShiftPinConnect({ roomId: rid, silent: true, force: true });
          }
        } catch (_e) { void _e; }
      }
      await syncLiveSyncAfterRoomJoin(rid);
      await flushLiveSyncOutbox(rid);
      if (!getRoomMembership()) return;
      markLiveSyncSessionResyncDone(true);
      startLiveSyncReconnectLoop();
    } catch (err) {
      recordLanSyncError({
        op: 'boot-membership',
        code: 'BOOT',
        message: err && err.message ? err.message : 'boot membership sync failed',
      });
    } finally {
      applyRoomSyncPhaseAfterReconcile(rid);
      syncLiveSyncStatusChrome();
    }
  })();
}