/**
 * LAN host URL resolution for share, pin, and auto-detect.
 */
import { storage } from '../../storage.js';
import { buildLanJoinUrls } from '../../lan-join-link.mjs';
import {
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  isLanSessionConfiguredForRest,
  trimStoredLanBearer,
  resolveHostBearerToken,
} from './transport-session.mjs';
import { activeLiveSyncRoomId } from './runtime.mjs';
import { getRoomSyncPhase, RoomSyncPhase } from '../../lan-sync-state.mjs';
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';
import { normalizeLanHostBase, lanHostBasesSameMachine } from '../../lan-host-subnet-discovery.mjs';
import { getPinnedHostUrl, isPinnedHostLocal } from '../../lan-host-pin.mjs';
import { cardionotasLoopbackBaseUrl } from '../../http-port.mjs';

async function ensureElectronLanServerOnce(opts, attempt) {
  if (!opts.ensureServer || attempt !== 0) return;
  if (typeof window.electronAPI.ensureLanServerReady !== 'function') return;
  try {
    await window.electronAPI.ensureLanServerReady();
  } catch (_e) { void _e; }
}

async function readElectronLanCandidateUrl() {
  try {
    const url = String((await window.electronAPI.getLanCandidateBaseUrl()) || '')
      .trim()
      .replace(/\/+$/, '');
    if (url && !isLocalLoopbackLanUrl(url)) return url;
  } catch (_e) { void _e; }
  return '';
}

export async function refreshElectronLanCandidateUrl(opts) {
  opts = opts || {};
  if (!isLanElectronDesktop() || !window.electronAPI?.getLanCandidateBaseUrl) return '';
  const tries = Math.max(1, Number(opts.tries) || 5);
  const delayMs = Math.max(50, Number(opts.delayMs) || 300);
  for (let i = 0; i < tries; i += 1) {
    await ensureElectronLanServerOnce(opts, i);
    const url = await readElectronLanCandidateUrl();
    if (url) return url;
    if (i < tries - 1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, delayMs);
      });
    }
  }
  return '';
}

function firstNonLoopbackHostUrl(candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    var url = String(candidates[i] || '')
      .trim()
      .replace(/\/+$/, '');
    if (url && !isLocalLoopbackLanUrl(url)) return url;
  }
  return '';
}

/** IP LAN para compartir con iPad / otras R+ (nunca localhost si hay interfaz). */
export async function resolveLanShareBaseUrl() {
  if (isLanRemoteJoinMode()) {
    var remoteCfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
    var remoteHost = firstNonLoopbackHostUrl([remoteCfg.hostUrl]);
    if (remoteHost) return remoteHost;
  }
  var fromElectron = await refreshElectronLanCandidateUrl({ ensureServer: true });
  if (fromElectron) return fromElectron;
  var el = document.getElementById('lan-input-host-url');
  var fromInput = el && el.value;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  return firstNonLoopbackHostUrl([fromInput, cfg.hostUrl]);
}

export async function buildShareJoinUrl(hostUrl, ticketId, teamCode) {
  const urls = await buildLanJoinUrls(hostUrl, ticketId, teamCode);
  return urls.joinUrl;
}

export async function resolveLanHostUrlAuto() {
  var shareUrl = await resolveLanShareBaseUrl();
  if (shareUrl) return shareUrl;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var fromCfg = String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (fromCfg) return fromCfg;
  if (!isLanElectronDesktop()) return '';
  return cardionotasLoopbackBaseUrl();
}

async function readOwnLanBaseFromElectron() {
  if (!isLanElectronDesktop() || !window.electronAPI?.getLanCandidateBaseUrl) return '';
  try {
    const fromElectron = normalizeLanHostBase(
      String((await window.electronAPI.getLanCandidateBaseUrl()) || '').trim()
    );
    if (fromElectron && !isLocalLoopbackLanUrl(fromElectron)) return fromElectron;
  } catch (_e) { void _e; }
  return '';
}

/** Best-effort LAN base for this Mac (share URL, config, Electron candidate). */
export async function resolveOwnLanBaseForPin() {
  const share = normalizeLanHostBase((await resolveLanShareBaseUrl()) || '');
  if (share && !isLocalLoopbackLanUrl(share)) return share;
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const fromCfg = normalizeLanHostBase(String(cfg.hostUrl || '').trim());
  if (fromCfg && !isLocalLoopbackLanUrl(fromCfg)) return fromCfg;
  const fromElectron = await readOwnLanBaseFromElectron();
  if (fromElectron) return fromElectron;
  return share || fromCfg || '';
}

/** True when REST hostUrl is this Mac (split-brain: live locally but not on ward host). */
export async function isLanRestHostOwnMachine() {
  if (!isLanSessionConfiguredForRest()) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var restHost = normalizeLanHostBase(String(cfg.hostUrl || '').trim());
  if (!restHost) return false;
  var own = normalizeLanHostBase((await resolveOwnLanBaseForPin()) || '');
  if (!own) return false;
  return lanHostBasesSameMachine(restHost, own) || restHost === own;
}

export async function resolveLanTeamCodeForShare() {
  var cfg = typeof storage.getLanConfig === 'function' ? (storage.getLanConfig() || {}) : {};
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  if (uiRole === 'host') {
    var hostBearer = await resolveHostBearerToken();
    if (hostBearer) return hostBearer;
  }
  var teamInput = document.getElementById('lan-input-team-code');
  var fromInput = teamInput && teamInput.value != null ? String(teamInput.value).trim() : '';
  if (fromInput) return fromInput;
  return trimStoredLanBearer(cfg.teamCode);
}

export async function resolveLanHostUrlForShare() {
  return resolveLanShareBaseUrl();
}

/** Client connect on ⇄ — PIN when required; host URL + Conectar when bypass. */
export async function shouldShowLanShiftPinClientConnect() {
  if (!isLanElectronDesktop()) return false;
  if (isClinicalLocalOnlyMode(readRpcSettings())) return false;
  const ownUrl = await resolveOwnLanBaseForPin();
  if (getPinnedHostUrl() && isPinnedHostLocal(ownUrl)) return false;
  // After reset / no bearer — R4 also reconnects via PIN or host URL.
  if (!isLanSessionConfiguredForRest()) return true;
  if (canLocalMacBeLanHost() && !isLanRemoteJoinMode()) return false;

  var rid = String(activeLiveSyncRoomId || '').trim();
  var phase = rid ? getRoomSyncPhase(rid) : RoomSyncPhase.offline;
  if (!rid || phase !== RoomSyncPhase.live) return true;
  if (isLanRemoteJoinMode()) return false;
  return isLanRestHostOwnMachine();
}

/** Host PIN display for R4+ acting as turn anfitrión. */
export function shouldShowLanShiftPinHostDisplay() {
  if (isLanSkipShiftPin()) return false;
  if (!isLanElectronDesktop()) return false;
  if (!canLocalMacBeLanHost() || isLanRemoteJoinMode()) return false;
  return true;
}
