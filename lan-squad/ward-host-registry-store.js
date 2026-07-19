'use strict';

const { subnetPrefixFromIpv4 } = require('./lan-candidate-url.js');
const {
  MAX_URLS,
  MAX_PREFIXES,
  tsNow,
  createRegistryPersistence,
} = require('./ward-host-registry-persistence.js');

const MAX_HINT_URLS = 8;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PORT = 3738;

function normalizeHostUrl(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `http://${s}`;
}

function hostIpv4FromBase(base) {
  try {
    const u = new URL(normalizeHostUrl(base));
    return String(u.hostname || '');
  } catch {
    return '';
  }
}

function prefixFromUrl(url) {
  return subnetPrefixFromIpv4(hostIpv4FromBase(url));
}

function createRegistryRecords(persistence) {
  const { load, save } = persistence;

  function recordPrefix(prefix, regIn) {
    const p = String(prefix || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(p)) return regIn || load();
    const reg = regIn || load();
    const idx = reg.prefixes.indexOf(p);
    if (idx >= 0) reg.prefixes.splice(idx, 1);
    reg.prefixes.unshift(p);
    reg.prefixes = reg.prefixes.slice(0, MAX_PREFIXES);
    return regIn ? reg : save(reg);
  }

  function recordUrl(url, meta = {}) {
    const normalized = normalizeHostUrl(url);
    if (!normalized) return load();
    const reg = load();
    const prefix = prefixFromUrl(normalized);
    const source =
      meta.source === 'manual' || meta.source === 'client' || meta.source === 'host'
        ? meta.source
        : 'host';
    const ts = tsNow();
    const idx = reg.hostUrls.findIndex((e) => normalizeHostUrl(e.url) === normalized);
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
    if (prefix) recordPrefix(prefix, reg);
    reg.hostUrls = reg.hostUrls.slice(0, MAX_URLS);
    return save(reg);
  }

  function merge(other) {
    if (!other || typeof other !== 'object') return load();
    if (Array.isArray(other.hostUrls)) {
      for (const item of other.hostUrls) {
        const url = typeof item === 'string' ? item : item && item.url;
        if (!url) continue;
        const src = typeof item === 'object' && item.source === 'host' ? 'host' : 'client';
        recordUrl(url, { source: src });
      }
    }
    if (Array.isArray(other.prefixes)) {
      for (const p of other.prefixes) recordPrefix(p);
    }
    return load();
  }

  function prune(maxAgeMs = DEFAULT_MAX_AGE_MS) {
    const cutoff = tsNow() - maxAgeMs;
    const reg = load();
    reg.hostUrls = reg.hostUrls.filter(
      (e) => Number(e.lastOkAt || e.lastSeenAt || 0) >= cutoff
    );
    return save(reg);
  }

  return { recordUrl, recordPrefix, merge, prune };
}

function createRegistryStorage(filePath) {
  const persistence = createRegistryPersistence(filePath);
  const records = createRegistryRecords(persistence);
  return { ...persistence, ...records };
}

function buildHintsForExchange(load, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const cutoff = tsNow() - maxAgeMs;
  const reg = load();
  const seen = new Set();
  const hostUrls = [];
  const sorted = [...reg.hostUrls].sort(
    (a, b) =>
      Number(b.lastOkAt || b.lastSeenAt || 0) - Number(a.lastOkAt || a.lastSeenAt || 0)
  );
  for (const row of sorted) {
    const url = normalizeHostUrl(row.url);
    if (!url || seen.has(url)) continue;
    if (Number(row.lastOkAt || row.lastSeenAt || 0) < cutoff) continue;
    seen.add(url);
    hostUrls.push({
      url,
      prefix: String(row.prefix || prefixFromUrl(url)),
      source: row.source === 'client' ? 'client' : 'host',
    });
    if (hostUrls.length >= MAX_HINT_URLS) break;
  }
  return {
    hostUrls,
    prefixes: reg.prefixes.slice(0, MAX_PREFIXES),
  };
}

function seedFromCandidateBaseUrl(storage, candidateBaseUrl) {
  const { listPrivateIpv4SubnetPrefixes } = require('./lan-candidate-url.js');
  const url = normalizeHostUrl(candidateBaseUrl);
  if (url) storage.recordUrl(url, { source: 'host' });
  for (const p of listPrivateIpv4SubnetPrefixes()) storage.recordPrefix(p);
  return storage.load();
}

module.exports = {
  DEFAULT_PORT,
  DEFAULT_MAX_AGE_MS,
  normalizeHostUrl,
  createRegistryStorage,
  buildHintsForExchange,
  seedFromCandidateBaseUrl,
};
