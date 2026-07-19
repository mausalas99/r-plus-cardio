/**
 * Mobile LAN join, sharer sync, and guest bearer persistence.
 */
import { storage } from '../../storage.js';
import { isMobileWeb } from '../../mobile-web.mjs';
import {
  applyMobileSharerContextFromUrl,
  hydrateMobileSharerSessionFromSettings,
  mobileSharerDisplayLabel,
} from '../../mobile-sharer-sync.mjs';
import { rememberPrimaryHostUrl } from '../../lan-surrogate-host.mjs';
import { resolveLanJoinHostUrl, liveSyncRoomLabel, buildTeamHash } from '../../lan-join-link.mjs';
import { lanClient } from './runtime.mjs';
import { deps, runtime } from './transport-deps.mjs';
import {
  trimStoredLanBearer,
  isLanElectronDesktop,
  isLanSessionConfiguredForRest,
  isLocalLoopbackLanUrl,
} from './transport-session.mjs';

export function fixMobileLanHostUrl(hostUrl) {
  var raw = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!isMobileWeb() || typeof location === 'undefined') return raw;
  var fixed = resolveLanJoinHostUrl(raw, location.origin);
  if (fixed) return fixed;
  if (isLocalLoopbackLanUrl(raw)) {
    return String(location.origin || '')
      .trim()
      .replace(/\/+$/, '');
  }
  return raw;
}

export async function persistGuestBearerFromExchange(data) {
  if (!data || !data.persist || data.storageTarget !== 'userData') return;
  if (!window.electronAPI || typeof window.electronAPI.lanGuestWriteBearer !== 'function') return;
  var token = trimStoredLanBearer(data.token);
  if (!token) return;
  try {
    await window.electronAPI.lanGuestWriteBearer({ token: token });
  } catch (_e) { void _e; }
  if (data.clientToken) {
    try {
      localStorage.setItem('rpc-lan-client-token', String(data.clientToken));
    } catch (_e) { void _e; }
  }
}

export async function verifyTeamHashFromUrl(joinUrl, ownTeamCode) {
  try {
    const urlTh = new URL(joinUrl).searchParams.get('th');
    if (!urlTh) return true;
    const expectedTh = await buildTeamHash(ownTeamCode);
    return !expectedTh || urlTh === expectedTh;
  } catch {
    return true;
  }
}

export async function syncMobileWithSharedInvite(hintRoomId) {
  if (!isMobileWeb()) return false;
  if (!isLanSessionConfiguredForRest()) return false;
  applyMobileSharerContextFromUrl();
  hydrateMobileSharerSessionFromSettings();
  var d = deps();
  if (!lanClient.baseUrl()) return false;
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  var rid = '';
  if (typeof d.resolveAutoJoinRoomId === 'function') {
    rid = String(d.resolveAutoJoinRoomId(hintRoomId || '') || '').trim();
  }
  if (!rid) {
    runtime().showToast(
      'Conectado al anfitrión. Pide a quien compartió el enlace que esté en una sala ⇄ activa antes de abrir R+ Móvil.',
      'warn'
    );
    d.renderLanPanel?.();
    return false;
  }
  if (typeof d.joinLanRoom !== 'function') return false;
  runtime().showToast(
    'Sincronizando el turno de ' + mobileSharerDisplayLabel() + '…',
    'info'
  );
  d.renderLanPanel?.();
  void d
    .joinLanRoom(rid, liveSyncRoomLabel(rid), { silent: true, mobileSharerSync: true })
    .catch(function () {});
  return true;
}

/** @deprecated Use syncMobileWithSharedInvite */
export async function resumeMobileLanRoomJoin(hintRoomId) {
  return syncMobileWithSharedInvite(hintRoomId);
}

function resolveMobileJoinHostUrl(hostUrl) {
  var resolvedHost = fixMobileLanHostUrl(hostUrl);
  if (resolvedHost) return resolvedHost;
  return (
    resolveLanJoinHostUrl(hostUrl, typeof location !== 'undefined' ? location.origin : '') ||
    String(hostUrl || '')
      .trim()
      .replace(/\/+$/, '')
  );
}

function persistMobileJoinConfig(cfg, roomId) {
  if (!cfg.teamCode || !cfg.hostUrl) return false;
  if (isLanElectronDesktop() && typeof storage.saveLanUiRole === 'function') {
    storage.saveLanUiRole('client');
  }
  storage.saveLanConfig(cfg);
  if (isMobileWeb() && roomId) {
    try {
      var merged = Object.assign({}, cfg, { roomId: String(roomId || '').trim() });
      if (merged.roomId) storage.saveLanConfig(merged);
    } catch (_e) { void _e; }
  }
  rememberPrimaryHostUrl(cfg.hostUrl);
  lanClient.configure(cfg);
  try {
    lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  return true;
}

function handleMobileJoinPingResult(r, roomId) {
  if (!r || !r.ok) {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('rpc-mobile-lan-sync-settled'));
    }
    runtime().showToast(
      'No se pudo conectar al servidor. Revisa Wi‑Fi y que R+ esté abierto en el anfitrión.',
      'error'
    );
    deps().renderLanPanel?.();
    return;
  }
  void import('./transport-pairing.mjs').then(function (m) {
    return m.maybeShowLanMigrationNotice();
  });
  applyMobileSharerContextFromUrl();
  void syncMobileWithSharedInvite(roomId);
  deps().renderLanPanel?.();
  if (isLanElectronDesktop()) {
    runtime().showToast('Conectado al anfitrión del turno.', 'success');
  }
}

export function configureLanFromMobileJoin(hostUrl, teamCode, roomId) {
  var cfg = {
    hostUrl: resolveMobileJoinHostUrl(hostUrl),
    teamCode: String(teamCode || '').trim(),
  };
  if (!persistMobileJoinConfig(cfg, roomId)) return;
  var pingMs = isMobileWeb() ? 3000 : 5000;
  var pingCtrl = new AbortController();
  var pingTimer = setTimeout(function () {
    pingCtrl.abort();
  }, pingMs);
  lanClient
    .fetch('/api/lan/v1/ping', { signal: pingCtrl.signal, cache: 'no-store' })
    .then(function (r) {
      clearTimeout(pingTimer);
      handleMobileJoinPingResult(r, roomId);
    })
    .catch(function () {
      clearTimeout(pingTimer);
      if (isMobileWeb() && typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('rpc-mobile-lan-sync-settled'));
      }
      runtime().showToast('Error de red al conectar con el anfitrión', 'error');
      deps().renderLanPanel?.();
    });
}
