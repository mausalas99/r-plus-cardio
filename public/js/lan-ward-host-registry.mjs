/**
 * Persistent ward host URL/subnet registry (cross-VLAN hospital Wi‑Fi).
 * Separate from lan-host-registry.mjs (in-memory fingerprint discovery).
 */
import { subnetPrefixFromIpv4 } from '../interno/host-discovery.mjs';
import { bundledWardHostUrl } from './clinical-settings.mjs';
import {
  normalizeLanHostBase,
  hostIpv4FromBase,
  isHostOnCurrentSubnets,
} from './lan-host-subnet-discovery.mjs';

export const WARD_HOST_REGISTRY_KEY = 'rpc-lan-ward-host-registry';
const VERSION = 1;
const MAX_URLS = 20;
const MAX_PREFIXES = 12;
const MAX_PROBE_URLS = 8;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function tsNow() {
  return Date.now();
}

function emptyRegistry() {
  return { version: VERSION, updatedAt: tsNow(), hostUrls: [], prefixes: [] };
}

function readStorage() {
  if (typeof localStorage === 'undefined') return emptyRegistry();
  try {
    const raw = localStorage.getItem(WARD_HOST_REGISTRY_KEY);
    if (!raw) return emptyRegistry();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== VERSION) return emptyRegistry();
    return {
      version: VERSION,
      updatedAt: Number(parsed.updatedAt) || tsNow(),
      hostUrls: Array.isArray(parsed.hostUrls) ? parsed.hostUrls : [],
      prefixes: Array.isArray(parsed.prefixes)
        ? parsed.prefixes.map((p) => String(p || '').trim()).filter(Boolean)
        : [],
    };
  } catch {
    return emptyRegistry();
  }
}

function writeStorage(reg) {
  const payload = {
    version: VERSION,
    updatedAt: tsNow(),
    hostUrls: Array.isArray(reg.hostUrls) ? reg.hostUrls.slice(0, MAX_URLS) : [],
    prefixes: Array.isArray(reg.prefixes) ? reg.prefixes.slice(0, MAX_PREFIXES) : [],
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(WARD_HOST_REGISTRY_KEY, JSON.stringify(payload));
    } catch (_e) { void _e; }
  }
  return payload;
}

/** @returns {{ version: number, updatedAt: number, hostUrls: object[], prefixes: string[] }} */
export function loadWardHostRegistry() {
  return readStorage();
}

/** @param {ReturnType<typeof loadWardHostRegistry>} reg */
export function saveWardHostRegistry(reg) {
  return writeStorage(reg && typeof reg === 'object' ? reg : emptyRegistry());
}

function prefixFromUrl(url) {
  return subnetPrefixFromIpv4(hostIpv4FromBase(url));
}

/**
 * @param {string} url
 * @param {{ source?: 'host'|'client'|'manual', fingerprint?: string }} [meta]
 */
export function recordWardHostUrl(url, meta = {}) {
  const normalized = normalizeLanHostBase(url);
  if (!normalized) return loadWardHostRegistry();

  const reg = loadWardHostRegistry();
  const prefix = prefixFromUrl(normalized);
  const source =
    meta.source === 'manual' || meta.source === 'client' || meta.source === 'host'
      ? meta.source
      : 'host';
  const ts = tsNow();
  const idx = reg.hostUrls.findIndex(
    (e) => normalizeLanHostBase(e.url) === normalized
  );
  const entry = {
    url: normalized,
    prefix,
    lastSeenAt: ts,
    lastOkAt: ts,
    source,
  };
  if (idx >= 0) {
    const prev = reg.hostUrls[idx];
    entry.source = meta.source || prev.source || source;
    reg.hostUrls.splice(idx, 1);
  }
  reg.hostUrls.unshift(entry);
  if (prefix) {
    const pIdx = reg.prefixes.indexOf(prefix);
    if (pIdx >= 0) reg.prefixes.splice(pIdx, 1);
    reg.prefixes.unshift(prefix);
    reg.prefixes = reg.prefixes.slice(0, MAX_PREFIXES);
  }
  return saveWardHostRegistry(reg);
}

/**
 * @param {string} prefix
 * @param {{ source?: string }} [_meta]
 * @param {ReturnType<typeof loadWardHostRegistry>} [regIn]
 */
export function recordWardHostPrefix(prefix, _meta = {}, regIn) {
  const p = String(prefix || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(p)) return regIn || loadWardHostRegistry();
  const reg = regIn || loadWardHostRegistry();
  const idx = reg.prefixes.indexOf(p);
  if (idx >= 0) reg.prefixes.splice(idx, 1);
  reg.prefixes.unshift(p);
  reg.prefixes = reg.prefixes.slice(0, MAX_PREFIXES);
  return regIn ? reg : saveWardHostRegistry(reg);
}

/**
 * @param {{ hostUrls?: (string|object)[], prefixes?: string[] }} other
 */
export function mergeWardHostRegistry(other) {
  if (!other || typeof other !== 'object') return loadWardHostRegistry();
  if (Array.isArray(other.hostUrls)) {
    for (const item of other.hostUrls) {
      const url = typeof item === 'string' ? item : item?.url;
      if (!url) continue;
      const src = typeof item === 'object' && item.source === 'host' ? 'host' : 'client';
      recordWardHostUrl(url, { source: src });
    }
  }
  if (Array.isArray(other.prefixes)) {
    for (const p of other.prefixes) recordWardHostPrefix(p);
  }
  return loadWardHostRegistry();
}

/**
 * @param {number} [maxAgeMs]
 * @param {{ localSubnetPrefixes?: string[] }} [opts]
 * @returns {string[]}
 */
export function listWardHostUrlsForProbe(maxAgeMs = DEFAULT_MAX_AGE_MS, opts = {}) {
  const cutoff = tsNow() - maxAgeMs;
  const reg = loadWardHostRegistry();
  const seen = new Set();
  const out = [];
  const localPrefixes = Array.isArray(opts.localSubnetPrefixes)
    ? opts.localSubnetPrefixes
    : null;
  const bundled = normalizeLanHostBase(bundledWardHostUrl());
  if (bundled) {
    seen.add(bundled);
    out.push(bundled);
  }
  const sorted = [...reg.hostUrls].sort(
    (a, b) =>
      Number(b.lastOkAt || b.lastSeenAt || 0) - Number(a.lastOkAt || a.lastSeenAt || 0)
  );
  for (const e of sorted) {
    const url = normalizeLanHostBase(e.url);
    if (!url || seen.has(url)) continue;
    if (Number(e.lastOkAt || e.lastSeenAt || 0) < cutoff) continue;
    if (
      localPrefixes &&
      url !== bundled &&
      !isHostOnCurrentSubnets(url, localPrefixes)
    ) {
      continue;
    }
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_PROBE_URLS) break;
  }
  return out;
}

/**
 * Local NIC /24 prefixes union saved ward prefixes.
 * @param {string} [ownBaseUrl]
 * @returns {Promise<string[]>}
 */
export async function listWardSubnetPrefixesForProbe(ownBaseUrl) {
  const { resolveLocalLanSubnetPrefixes } = await import('./lan-host-subnet-discovery.mjs');
  const local = await resolveLocalLanSubnetPrefixes(ownBaseUrl || '');
  const saved = loadWardHostRegistry().prefixes || [];
  const bundledPrefix = prefixFromUrl(bundledWardHostUrl());
  const seen = new Set();
  const out = [];
  for (const p of [...local, ...saved, bundledPrefix]) {
    const s = String(p || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * @param {number} [maxAgeMs]
 */
export function pruneWardHostRegistry(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const cutoff = tsNow() - maxAgeMs;
  const reg = loadWardHostRegistry();
  reg.hostUrls = reg.hostUrls.filter(
    (e) => Number(e.lastOkAt || e.lastSeenAt || 0) >= cutoff
  );
  return saveWardHostRegistry(reg);
}

/** Persist shipped ward host URL + /24 prefix so discovery probes them without user input. */
export function seedBundledWardConnectionPoints() {
  const url = normalizeLanHostBase(bundledWardHostUrl());
  if (!url) return loadWardHostRegistry();
  recordWardHostUrl(url, { source: 'host' });
  const prefix = prefixFromUrl(url);
  if (prefix) recordWardHostPrefix(prefix);
  return loadWardHostRegistry();
}

function wardHostMainIpc() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}

/** Mirror host URL to userData file (Electron host Mac only). */
export function syncWardHostUrlToMainFile(url, meta = {}) {
  const api = wardHostMainIpc();
  if (!api || typeof api.lanWardHostRecord !== 'function') return;
  const normalized = normalizeLanHostBase(url);
  if (!normalized) return;
  void api.lanWardHostRecord({ url: normalized, source: meta.source || 'host' }).catch(() => {});
}

/** Push renderer registry snapshot to userData file on the host Mac. */
export function syncWardHostRegistrySnapshotToMain() {
  const api = wardHostMainIpc();
  if (!api || typeof api.lanWardHostMerge !== 'function') return;
  const reg = loadWardHostRegistry();
  void api
    .lanWardHostMerge({
      hostUrls: reg.hostUrls,
      prefixes: reg.prefixes,
    })
    .catch(() => {});
}

export function clearWardHostRegistry() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(WARD_HOST_REGISTRY_KEY);
    } catch (_e) { void _e; }
  }
  const api = wardHostMainIpc();
  if (api && typeof api.lanWardHostClear === 'function') {
    void api.lanWardHostClear().catch(() => {});
  }
  return emptyRegistry();
}

/** @returns {{ urlCount: number, prefixCount: number, urls: string[], prefixes: string[] }} */
export function summarizeWardHostRegistry() {
  const reg = loadWardHostRegistry();
  return {
    urlCount: reg.hostUrls.length,
    prefixCount: reg.prefixes.length,
    urls: reg.hostUrls.map((e) => normalizeLanHostBase(e.url)).filter(Boolean),
    prefixes: reg.prefixes.slice(),
  };
}
