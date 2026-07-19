import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import { getRoomMembership } from './live-sync-membership.mjs';
import { parseLanJoinQuery, resolveLiveSyncRoomIdFromSala } from './lan-join-link.mjs';

function roomFromMembership() {
  try {
    const mem = getRoomMembership();
    return String(mem?.roomId || '').trim();
  } catch {
    return '';
  }
}

function roomFromUrl() {
  if (typeof location === 'undefined') return '';
  const parsed = parseLanJoinQuery(location.search, location.origin);
  return String(parsed.roomId || '').trim();
}

function roomFromSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    return resolveLiveSyncRoomIdFromSala(settings.clinicalSala);
  } catch {
    return '';
  }
}

/**
 * @param {{ roomId?: string, sala?: string }} opts
 * @returns {string}
 */
export function resolveRoomIdForUsernameRegister(opts = {}) {
  const explicit = String(opts.roomId || '').trim();
  if (explicit) return explicit;

  const fromSala = resolveLiveSyncRoomIdFromSala(opts.sala);
  if (fromSala) return fromSala;

  const fromMem = roomFromMembership();
  if (fromMem) return fromMem;

  const fromUrl = roomFromUrl();
  if (fromUrl) return fromUrl;

  const fromSettings = roomFromSettings();
  if (fromSettings) return fromSettings;

  return resolveLiveSyncRoomIdFromSala(clinicalSessionContext.user?.sala);
}
