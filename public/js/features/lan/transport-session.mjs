/**
 * LAN client config, bearer alignment, and authenticated fetch.
 */
import { storage } from '../../storage.js';
import { rememberPrimaryHostUrl } from '../../lan-surrogate-host.mjs';
import { getPinnedHostUrl } from '../../lan-host-pin.mjs';
import { normalizeLanHostBase } from '../../lan-host-subnet-discovery.mjs';
import { lanClient } from './runtime.mjs';
import { runtime } from './transport-deps.mjs';

export function isLanSessionConfiguredForRest() {
  try {
    var c = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() : null;
    return !!(
      c &&
      String(c.hostUrl || '').trim() &&
      trimStoredLanBearer(c.teamCode)
    );
  } catch {
    return false;
  }
}


export function trimStoredLanBearer(code) {
  return String(code || '').trim();
}

async function _fetchAndRegisterHealthAfterJoin(hostUrl, _teamCode) {
  try {
    const base = normalizeLanHostBase(hostUrl);
    if (!base) return;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${base}/api/lan/v1/health`, { signal: ctrl.signal });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.clientId || !data?.startedAt) return;
    const fp = `${data.clientId}:${data.startedAt}`;
    const { upsertHost, setPinnedFingerprint } = await import('../../lan-host-registry.mjs');
    upsertHost({
      fingerprint: fp,
      clientId: data.clientId,
      startedAt: data.startedAt,
      currentUrl: base,
      rank: data.hostRank || '',
      dbUnlocked: !!data.dbUnlocked,
      shiftPinActive: !!data.shiftPinActive,
      rttMs: 0,
      lastSeenAt: Date.now(),
      source: 'health_poll',
    });
    setPinnedFingerprint(fp);
  } catch (_e) { void _e; }
}

export function persistLanClientConfig(hostUrl, teamCode) {
  var url = String(hostUrl || '').trim().replace(/\/+$/, '');
  var code = trimStoredLanBearer(teamCode);
  if (!url || !code) return false;
  var prev = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var prevUrl = String(prev.hostUrl || '').trim().replace(/\/+$/, '');
  var prevCode = trimStoredLanBearer(prev.teamCode);
  var changed = prevUrl !== url || prevCode !== code;
  storage.saveLanConfig({ hostUrl: url, teamCode: code });
  lanClient.configure({ hostUrl: url, teamCode: code });
  if (isLanRemoteJoinMode()) rememberPrimaryHostUrl(url);
  if (changed) {
    try {
      lanClient.disconnect();
      lanClient.connectSyncChannel();
    } catch (_e) { void _e; }
    void _fetchAndRegisterHealthAfterJoin(url, code);
  }
  return changed;
}

/** Alinea rpc-lan-config / LanClient con el Bearer del anfitrión (archivo / IPC). */
export async function ensureLanClientTeamCodeAligned() {
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var hostUrl = String(cfg.hostUrl || '').trim().replace(/\/+$/, '');
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  if (
    uiRole === 'host' &&
    window.electronAPI &&
    typeof window.electronAPI.getLanEffectiveTeamCode === 'function'
  ) {
    return !!(await syncLanSavedTeamCodeWithEffectiveHostCode());
  }
  if (!hostUrl) return false;
  return persistLanClientConfig(hostUrl, cfg.teamCode);
}

/** One-time: persist rpc-lan-config bearer to lan-guest-bearer.txt (7.2.0 migration). */
export async function ensureLanGuestBearerFileFromConfig() {
  if (!isLanRemoteJoinMode()) return false;
  if (!window.electronAPI?.getLanGuestBearer || !window.electronAPI?.lanGuestWriteBearer) {
    return false;
  }
  var existing;
  try {
    existing = await window.electronAPI.getLanGuestBearer();
  } catch {
    return false;
  }
  if (existing && existing.ok) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var code = trimStoredLanBearer(cfg.teamCode);
  if (code.length < 32 || !String(cfg.hostUrl || '').trim()) return false;
  try {
    await window.electronAPI.lanGuestWriteBearer({ token: code });
  } catch {
    return false;
  }
  return true;
}

/** Guest client: reload remote host bearer from lan-guest-bearer.txt into rpc-lan-config. */
export async function syncLanGuestBearerFromDisk() {
  if (!window.electronAPI || typeof window.electronAPI.getLanGuestBearer !== 'function') {
    return false;
  }
  var info;
  try {
    info = await window.electronAPI.getLanGuestBearer();
  } catch {
    return false;
  }
  if (!info || !info.ok || !info.code) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var hostUrl = String(cfg.hostUrl || '').trim().replace(/\/+$/, '');
  if (!hostUrl) return false;
  persistLanClientConfig(hostUrl, info.code);
  return true;
}

export async function lanFetchAuthed(path, opts) {
  await ensureLanClientTeamCodeAligned();
  var ct = '';
  try {
    ct = localStorage.getItem('rpc-lan-client-token') || '';
  } catch (_e) { void _e; }
  if (ct) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { 'X-Client-Token': ct });
  }
  var resp = await lanClient.fetch(path, opts);
  if (resp.status !== 401) return resp;
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  if (uiRole === 'host' && window.electronAPI?.getLanEffectiveTeamCode) {
    await syncLanSavedTeamCodeWithEffectiveHostCode();
  } else if (uiRole !== 'host' && window.electronAPI?.getLanGuestBearer) {
    await syncLanGuestBearerFromDisk();
  }
  return lanClient.fetch(path, opts);
}

/** @returns {Promise<string>} */
export async function resolveHostBearerToken() {
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  if (uiRole === 'host') {
    var fromDisk = await resolveEffectiveHostBearerToken();
    if (fromDisk) {
      var fromCfg = trimStoredLanBearer(cfg.teamCode);
      if (fromCfg !== fromDisk) {
        persistLanClientConfig(normalizeLanUrl(cfg.hostUrl), fromDisk);
      }
      return fromDisk;
    }
  }
  var fromCfg = trimStoredLanBearer(cfg.teamCode);
  if (fromCfg.length >= 32) return fromCfg;
  if (uiRole !== 'host') {
    return resolveGuestBearerToken();
  }
  return '';
}

async function resolveGuestBearerToken() {
  if (!window.electronAPI?.getLanGuestBearer) return '';
  try {
    var guest = await window.electronAPI.getLanGuestBearer();
    if (guest && guest.ok && guest.code) return String(guest.code).trim();
  } catch (_e) { void _e; }
  return '';
}

async function resolveEffectiveHostBearerToken() {
  if (!window.electronAPI || typeof window.electronAPI.getLanEffectiveTeamCode !== 'function') {
    return '';
  }
  try {
    var info = await window.electronAPI.getLanEffectiveTeamCode();
    if (info && info.ok && info.code) return String(info.code).trim();
  } catch (_e) { void _e; }
  return '';
}

export async function syncLanSavedTeamCodeWithEffectiveHostCode() {
  if (!window.electronAPI || typeof window.electronAPI.getLanEffectiveTeamCode !== 'function') {
    return false;
  }
  var info;
  try {
    info = await window.electronAPI.getLanEffectiveTeamCode();
  } catch {
    return false;
  }
  if (!info || !info.ok || !info.code) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? (storage.getLanConfig() || {}) : {};
  var hostUrl = await resolveSyncHostUrl(cfg);
  persistLanClientConfig(hostUrl || normalizeLanUrl(cfg.hostUrl), info.code);
  return true;
}

function normalizeLanUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

async function resolveSyncHostUrl(cfg) {
  var hostUrl = normalizeLanUrl(cfg.hostUrl);
  if (hostUrl) return hostUrl;
  if (!window.electronAPI || typeof window.electronAPI.getLanCandidateBaseUrl !== 'function') {
    return '';
  }
  try {
    return normalizeLanUrl(await window.electronAPI.getLanCandidateBaseUrl());
  } catch {
    return '';
  }
}
export function isLanElectronDesktop() {
  return !!(
    typeof window !== 'undefined' &&
    window.electronAPI &&
    typeof window.electronAPI.getLanCandidateBaseUrl === 'function'
  );
}

export function isLanRemoteJoinMode() {
  return typeof storage.getLanUiRole === 'function' && storage.getLanUiRole() === 'client';
}

export function isLocalLoopbackLanUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    return /^(localhost|127\.0\.0\.1)$/i.test(u.hostname);
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(String(url || '').trim());
  }
}

export function getLanTeamCodeFromConfig() {
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  return trimStoredLanBearer(cfg.teamCode);
}

export function applyLanHostUrlSwitch(hostUrl, teamCode, opts) {
  opts = opts || {};
  var url = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  var code = trimStoredLanBearer(teamCode);
  if (!url) return false;
  if (!opts.skipRememberPrimary && isLanRemoteJoinMode()) rememberPrimaryHostUrl(url);
  persistLanClientConfig(url, code);
  try {
    if (!lanClient.connected) lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  return true;
}

/** When pin is set, block auto host URL changes unless user confirms (IM-08). */
export function maybeApplyLanHostUrlSwitch(hostUrl, teamCode, opts) {
  opts = opts || {};
  var url = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!url) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var currentUrl = String(cfg.hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  var pinned = getPinnedHostUrl();
  if (url === currentUrl) return applyLanHostUrlSwitch(url, teamCode, opts);
  if (opts.blockSwitch) return false;
  if (pinned) {
    if (url === pinned) return applyLanHostUrlSwitch(url, teamCode, opts);
    runtime().showToast('Anfitrión fijado: ' + pinned + '.', 'info');
    return false;
  }
  if (opts.requireConfirm) {
    var msg =
      opts.confirmMessage ||
      '¿Cambiar al anfitrión ' + url + '?';
    if (typeof confirm === 'function' && !confirm(msg)) return false;
  }
  return applyLanHostUrlSwitch(url, teamCode, opts);
}
