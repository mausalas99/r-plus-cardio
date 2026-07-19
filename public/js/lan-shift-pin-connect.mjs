/**
 * Connect to ward LAN host via shared shift PIN (registration / onboarding / Wi‑Fi roam).
 */
import { buildTeamHash, liveSyncRoomLabel, resolveLiveSyncRoomIdFromSala } from './lan-join-link.mjs';
import {
  discoverLanHostsOnAllLocalSubnetsViaBeacon,
  discoverLanHostsOnSubnetViaBeacon,
  lanHostBasesSameMachine,
  normalizeLanHostBase,
  probeLanHostBeacon,
  resolveLocalLanSubnetPrefixes,
} from './lan-host-subnet-discovery.mjs';
import { listRegistryDiscoveryUrls, upsertHost } from './lan-host-registry.mjs';
import {
  listWardHostUrlsForProbe,
  listWardSubnetPrefixesForProbe,
  mergeWardHostRegistry,
  recordWardHostUrl,
} from './lan-ward-host-registry.mjs';
import { pingLanHostUrl } from './lan-surrogate-host.mjs';
import { storage } from './storage.js';
import { isLanSkipShiftPin } from './lan-shift-pin-bypass.mjs';
import {
  canAttemptAutoHostDetect,
  recordAutoHostDetectMiss,
  recordAutoHostDetectSuccess,
  resumeAutoHostDetect,
} from './lan-host-detect-guard.mjs';
import { lanNetworkProfile } from './lan-network-profile.mjs';

const EXCHANGE_TIMEOUT_MS = 8000;
const BACKOFF_STEPS_MS = [12_000, 30_000, 60_000, 120_000];
const MAX_EXTRA_WARD_PREFIXES = 3;
let _easyConnectFailCount = 0;
let _lastEasyConnectAttemptMs = 0;
let _lastShiftPinFailReason = '';

function readShiftPinClientId() {
  try {
    const id = localStorage.getItem('rpc-lan-client-id');
    if (id && String(id).trim()) return String(id).trim();
  } catch (_e) { void _e; }
  return '';
}

export function getShiftPinCooldownMs() {
  return BACKOFF_STEPS_MS[Math.min(_easyConnectFailCount, BACKOFF_STEPS_MS.length - 1)];
}
export function recordShiftPinFailure() {
  _easyConnectFailCount = Math.min(_easyConnectFailCount + 1, BACKOFF_STEPS_MS.length - 1);
}
export function resetShiftPinBackoff() {
  _easyConnectFailCount = 0;
  _lastEasyConnectAttemptMs = 0;
}

function loadLanTransport() {
  return import('./features/lan/transport.mjs');
}

function showEasyToast(message, kind) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, kind);
  }
}

async function verifyTeamHashFromUrl(joinUrl, ownTeamCode) {
  try {
    const urlTh = new URL(joinUrl).searchParams.get('th');
    if (!urlTh) return true;
    const expectedTh = await buildTeamHash(ownTeamCode);
    return !expectedTh || urlTh === expectedTh;
  } catch {
    return true;
  }
}

function getOwnTeamCode() {
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  return String(cfg.teamCode || '').trim();
}

function resolveAutoJoinSalaFromProfile() {
  try {
    const s = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    return String(s.clinicalSala || '').trim();
  } catch {
    return '';
  }
}

/** @param {string} hostUrl @param {string} shiftPin */
async function exchangeShiftPinOnHost(hostUrl, shiftPin) {
  const base = normalizeLanHostBase(hostUrl);
  const bypass = isLanSkipShiftPin();
  const pin = String(shiftPin || '').trim();
  if (!base) return { ok: false, reason: 'bad_input' };
  if (!bypass && !/^\d{6}$/.test(pin)) return { ok: false, reason: 'bad_input' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXCHANGE_TIMEOUT_MS);
  const body = bypass && !pin ? { clientId: readShiftPinClientId() } : { shiftPin: pin, clientId: readShiftPinClientId() };
  try {
    const res = await fetch(`${base}/api/lan/v1/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 401) return { ok: false, reason: bypass ? 'bypass_rejected' : 'invalid_pin' };
    if (!res.ok) return { ok: false, reason: 'http_' + res.status };
    const data = await res.json();
    return data?.token ? { ok: true, data } : { ok: false, reason: 'bad_response' };
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

async function persistShiftPinBearer(data) {
  if (!data?.token) return;
  if (window.electronAPI && typeof window.electronAPI.lanGuestWriteBearer === 'function') {
    try {
      await window.electronAPI.lanGuestWriteBearer({ token: String(data.token).trim() });
    } catch (_e) { void _e; }
  }
  if (data.clientToken) {
    try {
      localStorage.setItem('rpc-lan-client-token', String(data.clientToken));
    } catch (_e) { void _e; }
  }
}

async function resolveOwnLanBaseUrl() {
  let ownUrl = '';
  if (window.electronAPI?.getLanCandidateBaseUrl) {
    try {
      ownUrl = normalizeLanHostBase(await window.electronAPI.getLanCandidateBaseUrl());
    } catch (_e) { void _e; }
  }
  if (!ownUrl) {
    const transport = await loadLanTransport();
    ownUrl = normalizeLanHostBase(await transport.resolveLanShareBaseUrl());
  }
  return ownUrl;
}

/** @returns {Promise<boolean>} */
async function isCurrentLanHostReachable() {
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const url = normalizeLanHostBase(cfg.hostUrl);
  const code = String(cfg.teamCode || '').trim();
  if (!url || code.length < 32) return false;
  return pingLanHostUrl(url, code);
}

/**
 * @param {string} hostUrl
 * @param {string} shiftPin
 * @param {{ sala?: string, roomId?: string }} opts
 * @returns {Promise<boolean>}
 */
async function joinHostAfterShiftPinExchange(hostUrl, shiftPin, opts) {
  const ex = await exchangeShiftPinOnHost(hostUrl, shiftPin);
  if (!ex.ok) {
    _lastShiftPinFailReason = ex.reason || 'not_found';
    return false;
  }
  const data = ex.data;

  await persistShiftPinBearer(data);
  const transport = await loadLanTransport();
  const joined = await transport.joinRemoteLanHostAsClient(
    String(data.hostUrl || hostUrl),
    data.token,
    { requireConfirm: false, toastLabel: '' }
  );
  if (!joined) return false;

  const resolvedUrl = normalizeLanHostBase(String(data.hostUrl || hostUrl));
  if (resolvedUrl) {
    recordWardHostUrl(resolvedUrl, { source: 'client' });
  }
  if (data.wardHostHints) {
    mergeWardHostRegistry(data.wardHostHints);
  }

  const roomId =
    String(opts.roomId || '').trim() || resolveLiveSyncRoomIdFromSala(opts.sala) || '';
  if (roomId) {
    try {
      const room = await import('./features/lan/room.mjs');
      if (typeof room.joinLanRoom === 'function') {
        await room.joinLanRoom(roomId, liveSyncRoomLabel(roomId));
      }
    } catch (_e) { void _e; }
  }
  _lastShiftPinFailReason = '';
  return true;
}

/**
 * Ordered host URLs to probe before subnet beacon scan.
 * @param {{ hostUrl?: string }} opts
 * @param {{ hostUrl?: string }} cfg
 * @returns {string[]}
 */
export function collectShiftPinProbeUrls(opts = {}, cfg = {}) {
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    const u = normalizeLanHostBase(raw);
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  add(opts.hostUrl);
  add(cfg.hostUrl);
  const localPrefixes = Array.isArray(opts.localSubnetPrefixes)
    ? opts.localSubnetPrefixes
    : null;
  for (const u of listWardHostUrlsForProbe(undefined, { localSubnetPrefixes: localPrefixes })) {
    add(u);
  }
  return out;
}

/**
 * mDNS / UDP / heartbeat registry URLs (verified via unauthenticated beacon).
 * @param {string} ownBaseUrl
 * @returns {Promise<string[]>}
 */
function registerUdpDiscoveryHost(h, add) {
  if (!h?.clientId || !h?.startedAt) return;
  upsertHost({
    fingerprint: `${h.clientId}:${h.startedAt}`,
    clientId: h.clientId,
    startedAt: h.startedAt,
    currentUrl: h.url,
    rank: h.rank || '',
    dbUnlocked: false,
    shiftPinActive: false,
    rttMs: 0,
    lastSeenAt: Date.now(),
    source: 'udp',
  });
  add(h.url);
}

async function loadUdpDiscoveryUrls(add) {
  if (typeof window === 'undefined' || !window.electronAPI?.lanUdpDiscover) return;
  try {
    const udpHosts = await window.electronAPI.lanUdpDiscover();
    if (!Array.isArray(udpHosts)) return;
    for (const h of udpHosts) registerUdpDiscoveryHost(h, add);
  } catch (_e) {
    void _e;
  }
}

export async function collectShiftPinFastDiscoveryUrls(ownBaseUrl) {
  const own = normalizeLanHostBase(ownBaseUrl);
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    const u = normalizeLanHostBase(raw);
    if (!u || seen.has(u)) return;
    if (own && (u === own || lanHostBasesSameMachine(u, own))) return;
    seen.add(u);
    out.push(u);
  };

  for (const u of listRegistryDiscoveryUrls()) add(u);

  if (!out.length) await loadUdpDiscoveryUrls(add);

  const verified = [];
  for (const url of out) {
    const hit = await probeLanHostBeacon(url);
    if (hit) verified.push(hit);
  }
  return verified;
}

async function tryJoinShiftPinHosts(hostUrls, pin, opts, tried) {
  for (const hostUrl of hostUrls) {
    if (tried.has(hostUrl)) continue;
    tried.add(hostUrl);
    const ok = await joinHostAfterShiftPinExchange(hostUrl, pin, opts);
    if (ok) return true;
  }
  return false;
}

function shouldTryLoopbackShiftPin(transport) {
  if (
    typeof window !== 'undefined' &&
    window.electronAPI?.isLanDevPeer?.()
  ) {
    return true;
  }
  if (transport?.isLanRemoteJoinMode?.()) return false;
  return true;
}

/**
 * Scan local subnets, exchange shift PIN, connect as client, join sala from profile.
 * @param {string} shiftPin
 * @param {{ sala?: string, roomId?: string, forceRediscover?: boolean, hostUrl?: string }} [opts]
 * @returns {Promise<boolean>}
 */
async function discoverExtraWardHosts(ownUrl, localPrefixes, pin, opts, tried) {
  const allPrefixes = await listWardSubnetPrefixesForProbe(ownUrl);
  const extraPrefixes = allPrefixes
    .filter((p) => !localPrefixes.includes(p))
    .slice(0, MAX_EXTRA_WARD_PREFIXES);
  for (const prefix of extraPrefixes) {
    const wardHosts = await discoverLanHostsOnSubnetViaBeacon(ownUrl, {
      subnetPrefixes: [prefix],
    });
    if (await tryJoinShiftPinHosts(wardHosts, pin, opts, tried)) return true;
  }
  return false;
}

async function tryLoopbackShiftPin(transport, pin, opts, tried) {
  if (!shouldTryLoopbackShiftPin(transport)) return false;
  const loopbackHost = normalizeLanHostBase('http://127.0.0.1:3738');
  if (!loopbackHost || tried.has(loopbackHost)) return false;
  tried.add(loopbackHost);
  return joinHostAfterShiftPinExchange(loopbackHost, pin, opts);
}

async function validateShiftPinJoinUrl(opts) {
  const joinUrl = String(opts.joinUrl || '').trim();
  if (!joinUrl) return true;
  const hashOk = await verifyTeamHashFromUrl(joinUrl, getOwnTeamCode());
  if (!hashOk) {
    showEasyToast('Este enlace es de otra sala o servicio. Verifica con el anfitrión.', 'warn');
    return false;
  }
  return true;
}

async function tryShiftPinJoinSequence(transport, pin, opts, ownUrl, localPrefixes, tried) {
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  if (
    await tryJoinShiftPinHosts(
      collectShiftPinProbeUrls({ ...opts, localSubnetPrefixes: localPrefixes }, cfg),
      pin,
      opts,
      tried
    )
  ) {
    return true;
  }
  if (await tryJoinShiftPinHosts(await collectShiftPinFastDiscoveryUrls(ownUrl), pin, opts, tried)) {
    return true;
  }
  if (await tryLoopbackShiftPin(transport, pin, opts, tried)) return true;
  if (await tryJoinShiftPinHosts(await discoverLanHostsOnAllLocalSubnetsViaBeacon(ownUrl), pin, opts, tried)) {
    return true;
  }
  return discoverExtraWardHosts(ownUrl, localPrefixes, pin, opts, tried);
}

export async function connectLanWithShiftPin(shiftPin, opts = {}) {
  const transport = await loadLanTransport();
  if (!transport.isLanElectronDesktop()) return false;
  const bypass = isLanSkipShiftPin();
  const pin = String(shiftPin || '').trim();
  if (!bypass && !/^\d{6}$/.test(pin)) return false;

  if (!(await validateShiftPinJoinUrl(opts))) return false;

  if (pin && typeof storage.saveLanShiftPin === 'function') storage.saveLanShiftPin(pin);

  if (!opts.forceRediscover && (await isCurrentLanHostReachable())) {
    return true;
  }

  const ownUrl = await resolveOwnLanBaseUrl();
  const localPrefixes = await resolveLocalLanSubnetPrefixes(ownUrl);
  const tried = new Set();
  _lastShiftPinFailReason = '';
  return tryShiftPinJoinSequence(transport, pin, opts, ownUrl, localPrefixes, tried);
}

/**
 * One-tap / automatic connect: saved PIN, plain language, no technical steps.
 * @param {{ shiftPin?: string, sala?: string, roomId?: string, silent?: boolean, force?: boolean, hostUrl?: string }} [opts]
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
function easyConnectBlockedReason(opts) {
  if (!opts.force && !canAttemptAutoHostDetect()) return 'paused';
  if (lanNetworkProfile.getNetworkProfile() === 'offline') return 'offline';
  const now = Date.now();
  if (!opts.force && !opts.skipCooldown && now - _lastEasyConnectAttemptMs < getShiftPinCooldownMs()) {
    return 'cooldown';
  }
  return '';
}

function reportEasyConnectFailure(opts) {
  recordShiftPinFailure();
  if (
    !isLanSkipShiftPin() &&
    !opts.force &&
    (opts.silent || opts.skipCooldown)
  ) {
    recordAutoHostDetectMiss();
  }
  const reason = _lastShiftPinFailReason || 'not_found';
  _lastShiftPinFailReason = '';
  return { ok: false, reason };
}

export async function tryEasyLanShiftPinConnect(opts = {}) {
  if (opts.force) resumeAutoHostDetect();
  const blocked = easyConnectBlockedReason(opts);
  if (blocked) return { ok: false, reason: blocked };
  _lastEasyConnectAttemptMs = Date.now();

  const pin =
    String(opts.shiftPin || '').trim() ||
    (typeof storage.getLanShiftPin === 'function' ? storage.getLanShiftPin() : '');
  if (!isLanSkipShiftPin() && !/^\d{6}$/.test(pin)) {
    return { ok: false, reason: 'no_pin' };
  }

  const sala = String(opts.sala || '').trim() || resolveAutoJoinSalaFromProfile();
  const connectOpts = { ...opts, sala, forceRediscover: true };

  if (!opts.force && (await isCurrentLanHostReachable())) {
    resetShiftPinBackoff();
    return { ok: true, reason: 'already_live' };
  }

  if (!opts.silent) {
    showEasyToast('Buscando anfitrión del turno…', 'info');
  }

  const ok = await connectLanWithShiftPin(pin, connectOpts);
  if (ok) {
    resetShiftPinBackoff();
    recordAutoHostDetectSuccess();
    if (!opts.silent) {
      showEasyToast('Listo: conectado al turno.', 'success');
    }
    return { ok: true, reason: 'connected' };
  }
  return reportEasyConnectFailure(opts);
}

/**
 * Re-find ward host after Wi‑Fi/VLAN change using saved shift PIN.
 * @param {{ shiftPin?: string, sala?: string, roomId?: string, silent?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function rediscoverLanHostWithShiftPin(opts = {}) {
  const result = await tryEasyLanShiftPinConnect({ ...opts, force: true, silent: opts.silent });
  return result.ok;
}
