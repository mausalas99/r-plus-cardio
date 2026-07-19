import {
  normalizeHostOverride,
  isLoopbackHostname,
  isPrivateIpv4,
  subnetPrefixFromIpv4,
  orderedSubnetHosts,
} from '../interno/host-discovery.mjs';
import { isCloudEquiposMode } from '../lib/equipos/equipos-cloud-mode.mjs';

const PING_PATH = '/api/equipos/v1/ping';
const PROBE_TIMEOUT_MS = 500;
const PROBE_CONCURRENCY = 6;
const HOST_OVERRIDE_KEY = 'rpc-equipos-host-override';

export async function probeEquiposHost(base, signal) {
  const url = `${String(base || '').replace(/\/+$/, '')}${PING_PATH}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.equipos ? String(base).replace(/\/+$/, '') : null;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function probeBatch(bases, signal) {
  const results = await Promise.all(bases.map((b) => probeEquiposHost(b, signal)));
  return results.find(Boolean) || null;
}

async function probeHosts(protocol, port, hosts, signal) {
  const bases = hosts.map((host) => `${protocol}//${host}:${port}`);
  for (let i = 0; i < bases.length; i += PROBE_CONCURRENCY) {
    const hit = await probeBatch(bases.slice(i, i + PROBE_CONCURRENCY), signal);
    if (hit) return hit;
  }
  return null;
}

export async function resolveEquiposApiBase(opts = {}) {
  const origin = typeof window !== 'undefined' ? window.location : null;
  if (!origin) return '';

  if (isCloudEquiposMode()) {
    const base = `${origin.protocol}//${origin.host}`;
    const hit = await probeEquiposHost(base, opts.signal);
    return hit || base;
  }

  const port = origin.port || '3738';
  const protocol = origin.protocol;
  const hostname = origin.hostname;
  const signal = opts.signal;

  const override = normalizeHostOverride(
    opts.hostOverride ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(HOST_OVERRIDE_KEY) : '')
  );
  if (override) {
    const hit = await probeEquiposHost(override, signal);
    if (hit) return hit;
  }

  if (hostname && !isLoopbackHostname(hostname)) {
    const direct = await probeEquiposHost(`${protocol}//${hostname}:${port}`, signal);
    if (direct) return direct;
    if (isPrivateIpv4(hostname)) return `${protocol}//${hostname}:${port}`;
  }

  const prefix = subnetPrefixFromIpv4(hostname);
  if (prefix && isLoopbackHostname(hostname)) {
    const hosts = orderedSubnetHosts(prefix, '');
    const hit = await probeHosts(protocol, port, hosts, signal);
    if (hit) return hit;
  }

  if (hostname && !isLoopbackHostname(hostname)) {
    return `${protocol}//${hostname}:${port}`;
  }
  return '';
}

export { normalizeHostOverride, isLoopbackHostname };
