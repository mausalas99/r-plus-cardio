/** URLs de unión LAN / móvil (sin DOM). */

import { CLINICAL_SALA_VALUES, clinicalSalaRoomSlug } from '../../lib/clinical-salas.mjs';

const JOIN_TICKET_PATH_RE = /\/join\/(req_[a-f0-9]{12})\b/i;

/** roomId usados en LiveSync (coinciden con ⇄ Salas de guardia). */
export const LIVE_SYNC_SALA_DEFS = CLINICAL_SALA_VALUES.map((key) => ({
  id: clinicalSalaRoomSlug(key),
  label: key,
  key,
}));

/**
 * @param {string} [salaOrRoom] — "Sala 1", sala-1, etc.
 * @returns {string} roomId o ''
 */
export function resolveLiveSyncRoomIdFromSala(salaOrRoom) {
  const raw = String(salaOrRoom || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const hit = LIVE_SYNC_SALA_DEFS.find(
    (d) => d.id === lower || d.key === raw || d.label === raw
  );
  return hit ? hit.id : '';
}

/** @param {string} roomId */
export function liveSyncRoomLabel(roomId) {
  const id = String(roomId || '').trim();
  const hit = LIVE_SYNC_SALA_DEFS.find((d) => d.id === id);
  return hit ? hit.label : id;
}

/**
 * Room ids to pull for Directorio LAN.
 * @param {{ allRooms?: boolean, activeRoomId?: string }} [opts]
 * @returns {string[]}
 */
export function lanClinicalDirectoryPullRoomIds(opts = {}) {
  if (!opts.allRooms) {
    const rid = String(opts.activeRoomId || '').trim();
    return rid ? [rid] : [];
  }
  const ids = LIVE_SYNC_SALA_DEFS.map((d) => String(d.id || '').trim()).filter(Boolean);
  const active = String(opts.activeRoomId || '').trim();
  if (active && !ids.includes(active)) return [active, ...ids];
  return ids;
}

/** Prefer page origin when server/config points at localhost (iPad cannot reach loopback). */
export function resolveLanJoinHostUrl(fromServer, pageOrigin) {
  try {
    const u = new URL(String(fromServer || '').trim());
    if (u.hostname && !/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* fall through */
  }
  const origin = String(pageOrigin || '').trim();
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.hostname && !/^(localhost|127\.0\.0\.1)$/i.test(o.hostname)) {
        return `${o.protocol}//${o.host}`;
      }
    } catch (_e) { void _e; }
  }
  return '';
}

/**
 * SHA-256 truncated to 8 hex chars — ward identity token for QR/mDNS/UDP.
 * @param {string} teamCode
 * @returns {Promise<string>}
 */
export async function buildTeamHash(teamCode) {
  const code = String(teamCode || '');
  if (!code) return '';
  try {
    const buf = new TextEncoder().encode(code);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, 8);
  } catch {
    return '';
  }
}

/** @param {string} url @param {string} th */
function appendTeamHashToUrl(url, th) {
  if (!th) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}th=${encodeURIComponent(th)}`;
}

/**
 * @param {string} hostUrl
 * @param {string} ticketId — p. ej. req_a1b2c3d4e5f6
 * @param {string} [teamCode]
 */
export async function buildLanJoinUrls(hostUrl, ticketId, teamCode) {
  const base = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const id = encodeURIComponent(String(ticketId || '').trim());
  const th = teamCode ? await buildTeamHash(String(teamCode).trim()) : '';
  const path = `${base}/join/${id}`;
  const withTh = appendTeamHashToUrl(path, th);
  return {
    joinUrl: withTh,
    mobileUrl: withTh,
  };
}

/**
 * Bookmarkable iPad URL (team token in query — no one-time /join ticket).
 * @param {string} hostUrl
 * @param {string} teamCode — LAN bearer / código del equipo
 */
export async function buildPermanentMobileJoinUrl(hostUrl, teamCode) {
  const base = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  const code = String(teamCode || '').trim();
  if (!base || !code) return '';
  const u = new URL(`${base}/mobile/`);
  u.searchParams.set('token', code);
  const th = await buildTeamHash(code);
  if (th) u.searchParams.set('th', th);
  return u.toString();
}

/**
 * @param {string} [search] — location.search
 * @param {string} [origin] — location.origin
 */
export function parseLanJoinQuery(search, origin) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const code = String(params.get('code') || params.get('token') || '').trim();
  const roomParam = String(params.get('room') || '').trim();
  const salaParam = String(params.get('sala') || '').trim();
  const roomId =
    resolveLiveSyncRoomIdFromSala(roomParam) ||
    resolveLiveSyncRoomIdFromSala(salaParam) ||
    roomParam;
  const hostParam = String(params.get('host') || '').trim().replace(/\/+$/, '');
  let hostUrl = resolveLanJoinHostUrl(hostParam, origin);
  if (!hostUrl && hostParam) hostUrl = hostParam;
  return { hostUrl, teamCode: code, roomId, sala: salaParam };
}

function hostFromUrl(u) {
  return `${u.protocol}//${u.host}`;
}

function emptyInviteParse() {
  return {
    hostUrl: '',
    teamCode: '',
    roomId: '',
    ticketId: '',
    legacyInvite: false,
    shiftPin: '',
    bareHost: false,
  };
}

/** True when URL is a LAN server base (Copiar dirección), not a /join ticket link. */
export function isBareLanHostBaseUrl(url) {
  try {
    const u = typeof url === 'string' ? new URL(url) : url;
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/' && !/^\/api\/lan\/v1\/?$/i.test(path)) return false;
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    return port === '3738' || port === '' || port === '80';
  } catch {
    return false;
  }
}

/** 6-digit shift PIN in pasted text (ignores digits inside URLs). */
export function extractShiftPinFromPaste(raw) {
  const text = String(raw || '');
  const withoutUrls = text.replace(/https?:\/\/[^\s<>"']+/gi, ' ');
  const m = withoutUrls.match(/\b(\d{6})\b/);
  return m ? m[1] : '';
}

function parseBareHostFromText(text) {
  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch) {
    try {
      const u = new URL(urlMatch[0]);
      if (isBareLanHostBaseUrl(u)) {
        return { hostUrl: hostFromUrl(u), shiftPin: extractShiftPinFromPaste(text) };
      }
    } catch (_e) { void _e; }
  }
  const ipMatch = text.match(
    /^(?:https?:\/\/)?(\d{1,3}(?:\.\d{1,3}){3})(?::3738)?\/?(?:\s+(\d{6}))?\s*$/
  );
  if (ipMatch) {
    return {
      hostUrl: `http://${ipMatch[1]}:3738`,
      shiftPin: ipMatch[2] || extractShiftPinFromPaste(text),
    };
  }
  return null;
}

function parseLanInviteFromUrl(urlMatch, text) {
  try {
    const u = new URL(urlMatch[0]);
    const hostUrl = hostFromUrl(u);
    const ticketM = u.pathname.match(JOIN_TICKET_PATH_RE);
    if (ticketM) {
      return {
        hostUrl,
        teamCode: '',
        roomId: '',
        ticketId: ticketM[1],
        legacyInvite: false,
        shiftPin: extractShiftPinFromPaste(text),
        bareHost: false,
      };
    }
    const search = u.search || '';
    if (/\/mobile\/?$/i.test(u.pathname)) {
      const mobileParsed = parseLanJoinQuery(search, hostUrl);
      if (mobileParsed.teamCode) {
        return {
          hostUrl,
          teamCode: mobileParsed.teamCode,
          roomId: mobileParsed.roomId,
          ticketId: '',
          legacyInvite: false,
          shiftPin: '',
          bareHost: false,
        };
      }
    }
    if (search.includes('code=') || search.includes('token=')) {
      const room = String(new URLSearchParams(search).get('room') || '').trim();
      return {
        hostUrl,
        teamCode: '',
        roomId: room,
        ticketId: '',
        legacyInvite: true,
        shiftPin: '',
        bareHost: false,
      };
    }
    if (isBareLanHostBaseUrl(u)) {
      return {
        hostUrl,
        teamCode: '',
        roomId: '',
        ticketId: '',
        legacyInvite: false,
        shiftPin: extractShiftPinFromPaste(text),
        bareHost: true,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

function parseLanInviteFromQueryText(text) {
  if (!text.includes('code=') && !text.includes('token=') && !text.includes('room=')) {
    return null;
  }
  const q = text.includes('?') ? text.slice(text.indexOf('?')) : text.startsWith('?') ? text : `?${text}`;
  const parsed = parseLanJoinQuery(q, '');
  if (!parsed.teamCode && !parsed.roomId) return null;
  return {
    hostUrl: parsed.hostUrl,
    teamCode: '',
    roomId: parsed.roomId,
    ticketId: '',
    legacyInvite: true,
    shiftPin: '',
    bareHost: false,
  };
}

/**
 * Parsea texto pegado: URL de ticket /join/req_…, URL legacy con ?code=, query suelta,
 * dirección base del anfitrión (http://…:3738), o PIN suelto.
 * @param {string} raw
 * @returns {{ hostUrl: string, teamCode: string, roomId: string, ticketId: string, legacyInvite: boolean, shiftPin: string, bareHost: boolean }}
 */
export function parseLanInviteInput(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return emptyInviteParse();
  }

  if (/^\d{6}$/.test(text)) {
    return { ...emptyInviteParse(), shiftPin: text };
  }

  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch) {
    const fromUrl = parseLanInviteFromUrl(urlMatch, text);
    if (fromUrl) return fromUrl;
  }

  const bare = parseBareHostFromText(text);
  if (bare) {
    return {
      hostUrl: bare.hostUrl,
      teamCode: '',
      roomId: '',
      ticketId: '',
      legacyInvite: false,
      shiftPin: bare.shiftPin || '',
      bareHost: true,
    };
  }

  const pathTicket = text.match(JOIN_TICKET_PATH_RE);
  if (pathTicket) {
    return {
      hostUrl: '',
      teamCode: '',
      roomId: '',
      ticketId: pathTicket[1],
      legacyInvite: false,
      shiftPin: extractShiftPinFromPaste(text),
      bareHost: false,
    };
  }

  const fromQuery = parseLanInviteFromQueryText(text);
  if (fromQuery) return fromQuery;

  return emptyInviteParse();
}

/** True when pasted text is a ⇄ sala /join link (not a clinical team invite code). */
export function isLanSalaInvitePaste(raw) {
  const text = String(raw || '').trim();
  if (!text) return false;
  if (/https?:\/\//i.test(text) && /\/join\//i.test(text)) return true;
  if (JOIN_TICKET_PATH_RE.test(text)) return true;
  const parsed = parseLanInviteInput(text);
  return !!(parsed.ticketId || (parsed.hostUrl && parsed.teamCode));
}
