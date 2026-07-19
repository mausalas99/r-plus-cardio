/** Admin API client for equipos mobile dashboard. */

import { bearerHeaders } from '../lib/equipos/equipos-http-headers.mjs';

const ADMIN_KEY_KEY = 'rpc-equipos-admin-key-session';

export const EQUIPOS_ADMIN_HISTORY_DAYS = 14;
export const EQUIPOS_ADMIN_PAGE_SIZE = 25;

/** @param {string} s */
export function normalizeAdminKey(s) {
  return String(s || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export function getEquiposAdminKey() {
  return sessionStorage.getItem(ADMIN_KEY_KEY) || '';
}

/** @param {string} key */
export function setEquiposAdminKey(key) {
  const k = normalizeAdminKey(key);
  if (k) sessionStorage.setItem(ADMIN_KEY_KEY, k);
  else sessionStorage.removeItem(ADMIN_KEY_KEY);
}

export function clearEquiposAdminKey() {
  sessionStorage.removeItem(ADMIN_KEY_KEY);
}

export function isEquiposAdminUnlocked() {
  return !!getEquiposAdminKey();
}

/** @param {object} data */
function adminApiError(data, fallback) {
  const code = data.error || '';
  let message = data.message || fallback;
  if (code === 'admin_invalid') {
    message = 'Clave de administrador incorrecta. Debe coincidir con EQUIPOS_ADMIN_KEY del worker.';
  } else if (code === 'admin_not_configured') {
    message = 'El worker no tiene clave admin configurada (wrangler secret put EQUIPOS_ADMIN_KEY).';
  } else if (code === 'admin_required') {
    message = 'Se requiere clave de administrador.';
  }
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * @param {string} apiBase
 * @param {string} token
 * @param {string} path
 * @param {{ method?: string, body?: object, query?: Record<string, string|number> }} [opts]
 */
export async function equiposAdminFetch(apiBase, token, path, opts = {}) {
  const adminKey = normalizeAdminKey(getEquiposAdminKey());
  if (!adminKey) {
    const err = new Error('Falta clave de administrador.');
    err.code = 'admin_required';
    throw err;
  }
  const q = { ...(opts.query || {}), ak: adminKey };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const u = new URL(`${apiBase}/api/equipos/v1${path}`);
  if (token) u.searchParams.set('t', token);
  for (const [k, v] of qs.entries()) u.searchParams.set(k, v);
  const headers = {
    'Content-Type': 'application/json',
    'X-Equipos-Admin-Key': adminKey,
  };
  if (token) Object.assign(headers, bearerHeaders(token));
  const res = await fetch(u.toString(), {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify({ ...opts.body, adminKey }) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw adminApiError(data, 'Error de red.');
  return data;
}

/**
 * @param {string} apiBase
 * @param {string} token
 * @param {string} photoId
 */
export function equiposAdminPhotoUrl(apiBase, token, photoId) {
  if (!photoId) return '';
  const adminKey = normalizeAdminKey(getEquiposAdminKey());
  const u = new URL(`${apiBase}/api/equipos/v1/photos/${encodeURIComponent(photoId)}`);
  if (token) u.searchParams.set('t', token);
  if (adminKey) u.searchParams.set('ak', adminKey);
  return u.toString();
}

/** @param {string} apiBase @param {string} token @param {string} adminKey */
export async function verifyEquiposAdminKey(apiBase, token, adminKey) {
  const key = normalizeAdminKey(adminKey);
  if (!key) {
    const err = new Error('Escribe la clave admin.');
    err.code = 'admin_required';
    throw err;
  }
  const u = new URL(`${apiBase}/api/equipos/v1/admin/verify`);
  if (token) u.searchParams.set('t', token);
  u.searchParams.set('ak', key);
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Equipos-Admin-Key': key,
      ...bearerHeaders(token || ''),
    },
    body: JSON.stringify({ adminKey: key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw adminApiError(data, 'Clave incorrecta.');
  return data;
}
