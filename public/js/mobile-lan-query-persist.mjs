/**
 * Mobile PWA / Safari: persist LAN invite (host, token, room, sharer) before the bundle boots.
 * Keep imports minimal — do not pull clinical-access-runtime before app.bundle.
 */

import { persistClinicalUserBinding } from './clinical-settings.mjs';
import { liveSyncRoomLabel, resolveLiveSyncRoomIdFromSala } from './lan-join-link.mjs';
import { setRoomMembership } from './live-sync-membership.mjs';

export const MOBILE_MODE_KEY = 'rpc-mobile-mode';
const LAN_CONFIG_KEY = 'rpc-lan-config';

/**
 * @param {string} [search]
 * @param {string} [origin]
 * @returns {{ hostUrl: string, teamCode: string, roomId?: string, sala?: string, sharer?: { user?: string, name?: string, rank?: string, sala?: string } } | null}
 */
function resolvePairingRoomId(roomParam, salaParam) {
  return resolveLiveSyncRoomIdFromSala(roomParam) ||
    resolveLiveSyncRoomIdFromSala(salaParam) ||
    roomParam;
}

function buildPairingSharer(params, salaParam) {
  const user = String(params.get('user') || '').trim();
  const name = String(params.get('name') || '').trim();
  const rank = String(params.get('rank') || '').trim();
  if (!user && !name && !rank && !salaParam) return undefined;
  return { user, name, rank, sala: salaParam || undefined };
}

export function buildMobilePairingFromSearch(search, origin) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const token = String(params.get('token') || params.get('code') || '').trim();
  if (!token) return null;
  const hostUrl = String(origin || '').trim().replace(/\/+$/, '');
  if (!hostUrl) return null;

  const roomParam = String(params.get('room') || '').trim();
  const salaParam = String(params.get('sala') || '').trim();
  const roomId = resolvePairingRoomId(roomParam, salaParam);
  const sharer = buildPairingSharer(params, salaParam);

  const out = { hostUrl, teamCode: token };
  if (roomId) out.roomId = roomId;
  if (salaParam) out.sala = salaParam;
  if (sharer) out.sharer = sharer;
  return out;
}

/** @deprecated */
export function buildMobileLanConfigFromSearch(search, origin) {
  return buildMobilePairingFromSearch(search, origin);
}

/**
 * @param {Record<string, unknown>} next
 * @param {Record<string, unknown> | null} prev
 */
function copyLanConfigStringField(merged, next, prev, key) {
  const value = String(next[key] || prev[key] || '').trim();
  if (value) merged[key] = value;
}

export function mergeMobileLanConfig(next, prev) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const merged = { hostUrl: '', teamCode: '' };
  copyLanConfigStringField(merged, next, p, 'hostUrl');
  copyLanConfigStringField(merged, next, p, 'teamCode');
  copyLanConfigStringField(merged, next, p, 'roomId');
  copyLanConfigStringField(merged, next, p, 'sala');
  const sharer = next.sharer || p.sharer;
  if (sharer && typeof sharer === 'object') merged.sharer = sharer;
  return merged;
}

function readStoredLanConfig() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAN_CONFIG_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

function writeStoredLanConfig(cfg) {
  if (!cfg || typeof localStorage === 'undefined') return;
  localStorage.setItem(LAN_CONFIG_KEY, JSON.stringify(cfg));
}

export function markMobileWebModePersisted() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MOBILE_MODE_KEY, '1');
  } catch (_e) { void _e; }
}

export function isMobileWebModePersisted() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(MOBILE_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {string} [search]
 * @param {string} [origin]
 * @returns {boolean}
 */
export function persistMobilePairingFromSearch(search, origin) {
  const pairing = buildMobilePairingFromSearch(search, origin);
  if (!pairing) return false;
  try {
    const merged = mergeMobileLanConfig(pairing, readStoredLanConfig());
    writeStoredLanConfig(merged);
    markMobileWebModePersisted();
    return true;
  } catch {
    return false;
  }
}

/** @deprecated */
export function persistMobileLanConfigFromSearch(search, origin) {
  return persistMobilePairingFromSearch(search, origin);
}

/**
 * Restore room membership + sharer profile from stored mobile pairing (PWA relaunch without query).
 * @returns {boolean}
 */
function bindingFromStoredSharer(sharer, cfgSala) {
  const binding = { registered: true };
  if (sharer.name) binding.displayName = String(sharer.name).trim();
  if (sharer.rank) binding.rank = String(sharer.rank).trim();
  if (sharer.sala != null) binding.sala = String(sharer.sala).trim();
  if (sharer.user) {
    const user = String(sharer.user).trim().replace(/^@/, '');
    if (user) binding.username = user;
  }
  if (cfgSala && binding.sala == null) binding.sala = String(cfgSala).trim();
  return binding;
}

export function restoreMobilePairingFromStorage() {
  const cfg = readStoredLanConfig();
  if (!cfg) return false;
  let applied = false;

  const roomId = String(cfg.roomId || '').trim() || resolveLiveSyncRoomIdFromSala(cfg.sala);
  if (roomId) {
    setRoomMembership({ roomId, label: liveSyncRoomLabel(roomId) || roomId });
    applied = true;
  }

  const sharer = cfg.sharer;
  if (sharer && typeof sharer === 'object') {
    persistClinicalUserBinding(bindingFromStoredSharer(sharer, cfg.sala));
    applied = true;
  } else if (cfg.sala) {
    persistClinicalUserBinding({ registered: true, sala: String(cfg.sala).trim() });
    applied = true;
  }

  return applied;
}

/**
 * @returns {string}
 */
export function resolveStoredMobileRoomId() {
  const cfg = readStoredLanConfig();
  if (!cfg) return '';
  return String(cfg.roomId || '').trim() || resolveLiveSyncRoomIdFromSala(cfg.sala);
}
