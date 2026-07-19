/**
 * R+ Móvil: mirror the desktop user who shared the invite (not a separate sala-join flow).
 * @see docs/superpowers/specs/2026-06-01-guardia-lan-hub-design.md §5
 */

import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import { persistClinicalUserBinding, readRpcSettings } from './clinical-settings.mjs';
import { normalizeUsername } from './clinical-username.mjs';
import { rememberLiveSyncRoomMembership } from './clinical-profile-lan-sync.mjs';
import { liveSyncRoomLabel, parseLanJoinQuery, resolveLiveSyncRoomIdFromSala } from './lan-join-link.mjs';
import { getRoomMembership } from './live-sync-membership.mjs';
import { isMobileWeb } from './mobile-web.mjs';

/**
 * LiveSync room encoded in a mobile invite (active room, membership, or sharer sala).
 * @param {string} [activeRoomId]
 * @returns {string}
 */
export function resolveMobilePairingRoomId(activeRoomId) {
  const rid = String(activeRoomId || '').trim();
  if (rid) return rid;
  try {
    const mem = getRoomMembership();
    if (mem?.roomId) return String(mem.roomId).trim();
  } catch (_e) { void _e; }
  const s = readRpcSettings();
  return resolveLiveSyncRoomIdFromSala(s.clinicalSala);
}

/**
 * Ticket URL + sharer identity for iPad (mirrors desktop user). Not for sala-only Mac invites.
 * @param {string} url
 * @param {string} [activeRoomId]
 */
export function appendMobileSharerParamsToJoinUrl(url, activeRoomId) {
  const s = readRpcSettings();
  try {
    const u = new URL(url);
    if (s.clinicalDisplayName) u.searchParams.set('name', s.clinicalDisplayName);
    if (s.clinicalRank) u.searchParams.set('rank', s.clinicalRank);
    if (s.clinicalSala) u.searchParams.set('sala', s.clinicalSala);
    const uname = String(s.clinicalUsername || '').trim();
    const uid = String(s.clinicalUserId || '').trim();
    if (uname) u.searchParams.set('user', uname);
    else if (uid) u.searchParams.set('user', uid);
    const roomId = resolveMobilePairingRoomId(activeRoomId);
    if (roomId) u.searchParams.set('room', roomId);
    return u.toString();
  } catch {
    return url;
  }
}

/** @returns {string}
 */
export function mobileSharerDisplayLabel() {
  const s = readRpcSettings();
  const name = String(s.clinicalDisplayName || '').trim();
  if (name) return name;
  const user = String(s.clinicalUsername || s.clinicalUserId || '').trim();
  return user || 'tu compañero';
}

function hasMobileSharerUrlContext(userRaw, name, rank, sala, roomId) {
  return !!(userRaw || name || rank || sala || roomId);
}

function buildMobileSharerBinding(userRaw, name, rank, sala) {
  const binding = { registered: true };
  if (name) binding.displayName = name;
  if (rank) binding.rank = rank;
  if (sala != null) binding.sala = sala;
  if (!userRaw) return binding;
  const normalized = normalizeUsername(userRaw.replace(/^@/, ''));
  if (normalized) binding.username = normalized;
  else binding.userId = userRaw;
  return binding;
}

function rememberMobileSharerRoom(roomId) {
  if (!roomId) return;
  rememberLiveSyncRoomMembership(roomId, liveSyncRoomLabel(roomId) || roomId);
}

/**
 * Apply name/rank/sala/user from the mobile pairing URL into rpc-settings + session stub.
 */
export function applyMobileSharerContextFromUrl() {
  if (!isMobileWeb() || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const userRaw = String(params.get('user') || '').trim();
  const name = String(params.get('name') || '').trim();
  const rank = String(params.get('rank') || '').trim();
  const sala = String(params.get('sala') || '').trim();
  const parsed = parseLanJoinQuery(window.location.search, window.location.origin);
  const roomId = String(parsed.roomId || '').trim();
  if (!hasMobileSharerUrlContext(userRaw, name, rank, sala, roomId)) return false;

  persistClinicalUserBinding(buildMobileSharerBinding(userRaw, name, rank, sala));
  rememberMobileSharerRoom(roomId);
  hydrateMobileSharerSessionFromSettings();
  return true;
}

/** Lightweight session user for sidebar scope on mobile (no SQLCipher). */
export function hydrateMobileSharerSessionFromSettings() {
  if (!isMobileWeb()) return;
  const s = readRpcSettings();
  const userId = String(s.clinicalUserId || '').trim();
  const username = String(s.clinicalUsername || '').trim();
  if (!userId && !username && !s.clinicalRegistered) return;
  clinicalSessionContext.user = {
    user_id: userId || username || 'mobile-sharer',
    username: username || null,
    rank: String(s.clinicalRank || 'R1').trim() || 'R1',
    sala: s.clinicalSala || null,
    clinical_name: s.clinicalDisplayName || null,
    is_program_admin: 0,
  };
}
