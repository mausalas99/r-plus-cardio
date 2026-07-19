/**
 * Probe LAN host for interno API (same subnet as current page).
 */
const PING_PATH = '/api/interno/v1/ping';
const PROBE_TIMEOUT_MS = 500;
const PROBE_CONCURRENCY = 6;
const HOST_OVERRIDE_KEY = 'rpc-interno-host-override';

/** @param {string} hostname */
export function isLoopbackHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

/** @param {string} hostname */
export function isPrivateIpv4(hostname) {
  const h = String(hostname || '').split(':')[0];
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** @param {string} ip */
export function subnetPrefixFromIpv4(ip) {
  const s = String(ip || '');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(s)) return '';
  return s.split('.').slice(0, 3).join('.');
}

/**
 * DHCP-friendly probe order for a /24 subnet.
 * @param {string} prefix e.g. 192.168.1
 * @param {string} [skipHost] full IPv4 to skip (already tried)
 */
export function orderedSubnetHosts(prefix, skipHost = '') {
  const skip = String(skipHost || '');
  /** @type {string[]} */
  const order = [];
  const seen = new Set();
  const add = (n) => {
    const host = `${prefix}.${n}`;
    if (host === skip || seen.has(host)) return;
    seen.add(host);
    order.push(host);
  };
  add(1);
  add(254);
  for (let i = 2; i <= 50; i += 1) add(i);
  for (let i = 100; i <= 200; i += 1) add(i);
  for (let i = 51; i <= 99; i += 1) add(i);
  for (let i = 201; i <= 253; i += 1) add(i);
  return order;
}

/** @param {string} raw */
export function normalizeHostOverride(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `http://${s}`;
}

/**
 * @param {string} base
 * @param {AbortSignal} [signal]
 */
export async function probeInternoHost(base, signal) {
  const url = `${String(base || '').replace(/\/+$/, '')}${PING_PATH}`;
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
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.interno ? String(base).replace(/\/+$/, '') : null;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * @param {string[]} bases
 * @param {AbortSignal} [signal]
 */
async function probeBatch(bases, signal) {
  const results = await Promise.all(bases.map((base) => probeInternoHost(base, signal)));
  return results.find(Boolean) || null;
}

/**
 * @param {string} protocol
 * @param {string} port
 * @param {string[]} hosts
 * @param {AbortSignal} [signal]
 */
async function probeHosts(protocol, port, hosts, signal) {
  const bases = hosts.map((host) => `${protocol}//${host}:${port}`);
  for (let i = 0; i < bases.length; i += PROBE_CONCURRENCY) {
    if (signal?.aborted) return null;
    const hit = await probeBatch(bases.slice(i, i + PROBE_CONCURRENCY), signal);
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {{ hostOverride?: string, signal?: AbortSignal }} [opts]
 */
export async function resolveInternoApiBase(opts = {}) {
  const origin = typeof window !== 'undefined' ? window.location : null;
  if (!origin) return '';

  const port = origin.port || '3738';
  const protocol = origin.protocol;
  const hostname = origin.hostname;
  const signal = opts.signal;

  const overrideRaw =
    opts.hostOverride ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(HOST_OVERRIDE_KEY) : '') ||
    '';
  const override = normalizeHostOverride(overrideRaw);
  if (override) {
    let useOverride = true;
    try {
      const overrideHost = new URL(override).hostname;
      if (
        !isLoopbackHostname(hostname) &&
        isPrivateIpv4(hostname) &&
        overrideHost !== hostname
      ) {
        useOverride = false;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(HOST_OVERRIDE_KEY);
        }
      }
    } catch (_e) {
      useOverride = false;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(HOST_OVERRIDE_KEY);
      }
    }
    if (useOverride) {
      const hit = await probeInternoHost(override, signal);
      if (hit) return hit;
    }
  }

  if (hostname && !isLoopbackHostname(hostname)) {
    const direct = await probeInternoHost(`${protocol}//${hostname}:${port}`, signal);
    if (direct) return direct;
    // La página ya cargó desde este host; confiar en el origen aunque falle el ping.
    if (isPrivateIpv4(hostname)) {
      return `${protocol}//${hostname}:${port}`;
    }
  }

  const prefix = subnetPrefixFromIpv4(hostname);
  if (prefix && isLoopbackHostname(hostname)) {
    const skip = isLoopbackHostname(hostname) ? '' : hostname;
    const hosts = orderedSubnetHosts(prefix, skip);
    const hit = await probeHosts(protocol, port, hosts, signal);
    if (hit) return hit;
  }

  if (hostname && !isLoopbackHostname(hostname)) {
    return `${protocol}//${hostname}:${port}`;
  }

  return '';
}

/** @param {string} hostOverride */
export function saveInternoHostOverride(hostOverride) {
  const base = normalizeHostOverride(hostOverride);
  if (!base) {
    sessionStorage.removeItem(HOST_OVERRIDE_KEY);
    return '';
  }
  sessionStorage.setItem(HOST_OVERRIDE_KEY, base);
  return base;
}

/** @param {string} path */
export function parseInternoPath(path) {
  const m = String(path || '').match(/\/interno\/(sala-[12e])/i);
  return m ? m[1].toLowerCase() : '';
}

/** @param {string} slug */
export function salaKeyFromSlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (s === 'sala-1') return 'Sala 1';
  if (s === 'sala-2') return 'Sala 2';
  if (s === 'sala-e') return 'Sala E';
  return '';
}
