/**
 * Discover other R+ LAN hosts on the same /24 subnet (split-brain guard).
 */
import {
  isLoopbackHostname,
  isPrivateIpv4,
  orderedSubnetHosts,
  subnetPrefixFromIpv4,
} from '../interno/host-discovery.mjs';

const LAN_BEACON_PATH = '/api/lan/v1/beacon';
const LAN_PING_PATH = '/api/lan/v1/ping';
const PROBE_TIMEOUT_MS = 500;
/** Chrome ~6 connections per host; ward scans must not flood the pool. */
const PROBE_CONCURRENCY = 6;
const MAX_FOUND = 4;
const DEFAULT_PORT = '3738';

/** @param {string} raw */
export function normalizeLanHostBase(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `http://${s}`;
}

/** @param {string} hostUrl @param {string[]} prefixes */
export function isHostOnCurrentSubnets(hostUrl, prefixes) {
  const host = hostIpv4FromBase(hostUrl);
  if (!host || !Array.isArray(prefixes) || !prefixes.length) return false;
  const prefix = subnetPrefixFromIpv4(host);
  return !!prefix && prefixes.includes(prefix);
}

/** @param {string} base */
export function hostIpv4FromBase(base) {
  try {
    return new URL(normalizeLanHostBase(base)).hostname;
  } catch {
    return '';
  }
}

/** @param {string} a @param {string} b */
export function lanHostBasesSameMachine(a, b) {
  const ha = hostIpv4FromBase(a);
  const hb = hostIpv4FromBase(b);
  if (!ha || !hb) return false;
  if (ha === hb) return true;
  const loop = (h) => isLoopbackHostname(h);
  return loop(ha) && loop(hb);
}

/**
 * @param {string} base
 * @param {string} teamCode
 * @param {AbortSignal} [signal]
 */
export async function probeLanHostBase(base, teamCode, signal) {
  const normalized = normalizeLanHostBase(base);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      return null;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const code = String(teamCode || '').trim();
    if (!normalized || !code) return null;
    const res = await fetch(`${normalized}${LAN_PING_PATH}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${code}` },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.lan !== true) return null;
    return normalized;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * @param {string} base
 * @param {AbortSignal} [signal]
 */
export async function probeLanHostBeacon(base, signal) {
  const normalized = normalizeLanHostBase(base);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      return null;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    if (!normalized) return null;
    const res = await fetch(`${normalized}${LAN_BEACON_PATH}`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.lan !== true) return null;
    return normalized;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * @returns {Promise<string[]>}
 */
async function readSubnetPrefixesFromIpc() {
  if (typeof window === 'undefined' || !window.electronAPI?.getLanSubnetPrefixes) return [];
  try {
    const fromIpc = await window.electronAPI.getLanSubnetPrefixes();
    if (!Array.isArray(fromIpc) || !fromIpc.length) return [];
    return fromIpc
      .map((p) => String(p || '').trim())
      .filter((p) => /^\d+\.\d+\.\d+$/.test(p));
  } catch (_e) {
    void _e;
    return [];
  }
}

async function resolveSeedHostFromElectron() {
  if (typeof window === 'undefined' || !window.electronAPI?.getLanCandidateBaseUrl) return '';
  try {
    const fromElectron = normalizeLanHostBase(await window.electronAPI.getLanCandidateBaseUrl());
    const h = hostIpv4FromBase(fromElectron);
    return h && !isLoopbackHostname(h) ? h : '';
  } catch (_e) {
    void _e;
    return '';
  }
}

async function scanPrefixesForHosts(prefixes, skip, own, probeFn) {
  /** @type {Set<string>} */
  const found = new Set();
  for (const prefix of prefixes) {
    if (found.size >= MAX_FOUND) break;
    const hosts = orderedSubnetHosts(prefix, skip);
    for (let i = 0; i < hosts.length && found.size < MAX_FOUND; i += PROBE_CONCURRENCY) {
      const batch = hosts.slice(i, i + PROBE_CONCURRENCY);
      const bases = batch.map((host) => `http://${host}:${DEFAULT_PORT}`);
      const probes = await Promise.all(bases.map((base) => probeFn(base)));
      for (const url of probes) {
        if (!url || (own && (url === own || lanHostBasesSameMachine(url, own)))) continue;
        found.add(url);
        if (found.size >= MAX_FOUND) break;
      }
    }
  }
  return [...found].sort();
}

export async function resolveLocalLanSubnetPrefixes(ownBaseUrl) {
  const fromIpc = await readSubnetPrefixesFromIpc();
  if (fromIpc.length) return fromIpc;
  const own = normalizeLanHostBase(ownBaseUrl);
  let seedHost = hostIpv4FromBase(own);
  if (!seedHost || isLoopbackHostname(seedHost)) {
    seedHost = await resolveSeedHostFromElectron() || seedHost;
  }
  if (!seedHost && own) seedHost = hostIpv4FromBase(own);
  const prefix = subnetPrefixFromIpv4(seedHost);
  if (!prefix || !isPrivateIpv4(seedHost)) return [];
  return [prefix];
}

/**
 * Discover ward hosts without bearer (beacon only). Used with shift PIN exchange.
 * @param {string} ownBaseUrl
 * @param {{ subnetPrefixes?: string[] }} [opts]
 * @returns {Promise<string[]>}
 */
function resolveDiscoverySkipHost(own, prefixes) {
  let seedHost = hostIpv4FromBase(own);
  if (!seedHost || isLoopbackHostname(seedHost)) {
    for (const prefix of prefixes) {
      const probe = `${prefix}.1`;
      if (isPrivateIpv4(probe)) return probe;
    }
  }
  return seedHost && !isLoopbackHostname(seedHost) ? seedHost : '';
}

export async function discoverLanHostsOnSubnetViaBeacon(ownBaseUrl, opts = {}) {
  const own = normalizeLanHostBase(ownBaseUrl);
  const prefixes =
    Array.isArray(opts.subnetPrefixes) && opts.subnetPrefixes.length
      ? opts.subnetPrefixes
      : await resolveLocalLanSubnetPrefixes(own);
  if (!prefixes.length) return [];
  const skip = resolveDiscoverySkipHost(own, prefixes);
  return scanPrefixesForHosts(prefixes, skip, own, probeLanHostBeacon);
}

/**
 * Beacon scan on every local /24 (hospital Wi‑Fi with multiple VLANs/NICs).
 * @param {string} ownBaseUrl
 * @returns {Promise<string[]>}
 */
export async function discoverLanHostsOnAllLocalSubnetsViaBeacon(ownBaseUrl) {
  const prefixes = await resolveLocalLanSubnetPrefixes(ownBaseUrl);
  return discoverLanHostsOnSubnetViaBeacon(ownBaseUrl, { subnetPrefixes: prefixes });
}

/**
 * Bearer-authenticated ward scan on every local /24 (multi-VLAN hospital Wi‑Fi).
 * @param {string} teamCode
 * @param {string} ownBaseUrl
 * @param {{ subnetPrefixes?: string[] }} [opts]
 * @returns {Promise<string[]>}
 */
export async function discoverLanHostsOnSubnet(teamCode, ownBaseUrl, opts = {}) {
  const own = normalizeLanHostBase(ownBaseUrl);
  const code = String(teamCode || '').trim();
  if (!code) return [];

  const prefixes =
    Array.isArray(opts.subnetPrefixes) && opts.subnetPrefixes.length
      ? opts.subnetPrefixes
      : await resolveLocalLanSubnetPrefixes(own);
  if (!prefixes.length) return [];

  let seedHost = hostIpv4FromBase(own);
  if (!seedHost || isLoopbackHostname(seedHost)) {
    seedHost = (await resolveSeedHostFromElectron()) || seedHost;
  }
  if (!seedHost && own) seedHost = hostIpv4FromBase(own);

  const skip = seedHost && !isLoopbackHostname(seedHost) ? seedHost : '';
  return scanPrefixesForHosts(prefixes, skip, own, (base) => probeLanHostBase(base, code));
}

/**
 * @param {string} teamCode
 * @param {string} ownBaseUrl
 * @returns {Promise<string[]>}
 */
export async function discoverLanHostsOnAllLocalSubnets(teamCode, ownBaseUrl) {
  return discoverLanHostsOnSubnet(teamCode, ownBaseUrl);
}
