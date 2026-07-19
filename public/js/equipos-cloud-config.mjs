/**
 * Cloud equipos queue config (desktop renderer).
 * Persisted in rpc-settings + localStorage fallback.
 */

import { readRpcSettings } from './clinical-settings.mjs';

const URL_KEY = 'rpc-equipos-cloud-url';
const ADMIN_KEY = 'rpc-equipos-admin-key';

/** Public URL after account subdomain change (rmas-workersdev). */
export const EQUIPOS_CLOUD_DEFAULT_URL =
  'https://rmas-lista-de-espera.rmas-workersdev.workers.dev';

const LEGACY_CLOUD_URL_PATTERNS = [
  /^https?:\/\/rplus-equipos\./i,
  /laboratoriazo-lic\.workers\.dev/i,
];

/** Public QR links should use a custom domain, not *.workers.dev account URLs. */
export function isEquiposWorkersDevUrl(url) {
  try {
    return /\.workers\.dev$/i.test(new URL(String(url || '').trim()).hostname);
  } catch {
    return false;
  }
}

/** @param {string} url */
export function migrateLegacyEquiposCloudUrl(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  const isLegacy = LEGACY_CLOUD_URL_PATTERNS.some((re) => re.test(raw));
  if (!isLegacy) return raw;
  // Do not rewrite to another *.laboratoriazo-lic.workers.dev URL — use a custom domain.
  return '';
}

/** @param {string} url */
export function normalizeEquiposCloudUrl(url) {
  let u = migrateLegacyEquiposCloudUrl(String(url || '').trim()).replace(/\/+$/, '');
  if (!u) return '';
  if (/\.workers$/i.test(u) && !/\.workers\.dev$/i.test(u)) {
    u = `${u}.dev`;
  }
  return u;
}

/** @returns {{ enabled: boolean, url: string, adminKey: string }} */
export function getEquiposCloudConfig() {
  const settings = readRpcSettings();
  const rawUrl = String(settings.equiposCloudUrl || localStorage.getItem(URL_KEY) || '')
    .trim()
    .replace(/\/+$/, '');
  const url = normalizeEquiposCloudUrl(rawUrl);
  if (url && url !== rawUrl) {
    setEquiposCloudConfig({ url, adminKey: undefined });
  }
  const adminKey = String(
    settings.equiposAdminKey || localStorage.getItem(ADMIN_KEY) || ''
  ).trim();
  return { enabled: !!url, url, adminKey };
}

/**
 * @param {{ url?: string, adminKey?: string }} cfg
 */
export function setEquiposCloudConfig(cfg) {
  const settings = readRpcSettings();
  if (cfg.url !== undefined) {
    const u = normalizeEquiposCloudUrl(String(cfg.url || '').trim());
    if (u) {
      settings.equiposCloudUrl = u;
      localStorage.setItem(URL_KEY, u);
    } else {
      delete settings.equiposCloudUrl;
      localStorage.removeItem(URL_KEY);
    }
  }
  if (cfg.adminKey !== undefined) {
    const k = String(cfg.adminKey || '').trim();
    if (k) {
      settings.equiposAdminKey = k;
      localStorage.setItem(ADMIN_KEY, k);
    } else {
      delete settings.equiposAdminKey;
      localStorage.removeItem(ADMIN_KEY);
    }
  }
  try {
    localStorage.setItem('rpc-settings', JSON.stringify(settings));
  } catch (_e) {
    void _e;
  }
}

function equiposCloudErrorMessage(code, fallback) {
  if (code === 'admin_required') {
    return 'Clave admin incorrecta o no configurada en el worker (wrangler secret put EQUIPOS_ADMIN_KEY).';
  }
  if (code === 'admin_invalid') {
    return 'Clave de administrador incorrecta. Debe ser exactamente EQUIPOS_ADMIN_KEY del worker desplegado en esta URL.';
  }
  if (code === 'admin_not_configured') {
    return 'El worker no tiene EQUIPOS_ADMIN_KEY. Ejecuta: wrangler secret put EQUIPOS_ADMIN_KEY';
  }
  if (code === 'auth_required') {
    return 'Genera el enlace y QR primero, o guarda la clave admin.';
  }
  return fallback;
}

/**
 * @param {string} path e.g. `/admin/access`
 * @param {{ method?: string, body?: object, useAdminKey?: boolean, programToken?: string }} [opts]
 */
export async function equiposCloudFetch(path, opts = {}) {
  const cfg = getEquiposCloudConfig();
  if (!cfg.url) throw new Error('Equipos cloud no configurado.');
  const headers = { 'Content-Type': 'application/json' };
  const programToken = String(opts.programToken || '').trim();
  if (programToken) headers['X-Equipos-Token'] = programToken;
  if (opts.useAdminKey !== false && cfg.adminKey) {
    headers['X-Equipos-Admin-Key'] = cfg.adminKey;
  }
  let res;
  try {
    res = await fetch(`${cfg.url}/api/equipos/v1${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (_e) {
    const hint =
      cfg.url.includes('.workers') && !cfg.url.includes('.workers.dev')
        ? 'La URL debe terminar en .workers.dev'
        : 'Revisa URL, red y que el worker esté desplegado (npm run deploy).';
    throw new Error(`No se pudo conectar al servicio cloud. ${hint}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data.error || '';
    const err = new Error(equiposCloudErrorMessage(code, data.message || 'Error de red.'));
    err.code = code;
    throw err;
  }
  return data;
}

/** @param {string} [_token] kept for LAN parity; cloud URL needs no query param */
export function equiposCloudMobileUrl(_token) {
  const cfg = getEquiposCloudConfig();
  if (!cfg.url) return '';
  return cfg.url;
}
