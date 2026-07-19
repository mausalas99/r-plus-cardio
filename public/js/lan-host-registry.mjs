/**
 * In-memory host registry keyed by fingerprint (clientId:startedAt).
 * All discovery paths write here; all reconnect paths read from here.
 */

import { mergeHostRegistryRecord, SOURCE_WEIGHT } from './lan-host-registry-upsert.mjs';

const PINNED_FP_KEY = 'rplus.lan.pinnedFingerprint';

/** @type {Map<string, object>} */
const _registry = new Map();

/** For tests only — clears all registry entries. */
export function _resetRegistryForTest() {
  _registry.clear();
}

/**
 * @param {object} record
 * @param {string} record.fingerprint
 * @param {string} record.clientId
 * @param {number} record.startedAt
 * @param {string} record.currentUrl
 * @param {string} [record.rank]
 * @param {boolean} [record.dbUnlocked]
 * @param {boolean} [record.shiftPinActive]
 * @param {number} [record.rttMs]
 * @param {number} record.lastSeenAt
 * @param {keyof typeof SOURCE_WEIGHT} record.source
 */
export function upsertHost(record) {
  if (!record || !record.fingerprint) return;
  const fp = String(record.fingerprint);
  const existing = _registry.get(fp);
  const incomingWeight = SOURCE_WEIGHT[record.source] ?? 0;
  _registry.set(fp, mergeHostRegistryRecord(existing, record, incomingWeight));
}

/** @param {string} fingerprint @returns {object|null} */
export function findByFingerprint(fingerprint) {
  return _registry.get(String(fingerprint)) ?? null;
}

/** @param {string} url @returns {object|null} */
export function findByUrl(url) {
  const normalized = String(url || '').replace(/\/+$/, '');
  for (const r of _registry.values()) {
    if (r.currentUrl.replace(/\/+$/, '') === normalized) return r;
  }
  return null;
}

/** @returns {object[]} All registry entries (not yet evicted). */
export function listHosts() {
  return [..._registry.values()];
}

const FAST_DISCOVERY_SOURCES = new Set(['heartbeat', 'mdns', 'health_poll', 'udp']);

/**
 * URLs from recent high-fidelity discovery (mDNS, UDP, heartbeat, health poll).
 * @param {number} [maxAgeMs=90000]
 * @returns {string[]}
 */
export function listRegistryDiscoveryUrls(maxAgeMs = 90_000) {
  const cutoff = Date.now() - maxAgeMs;
  return listHosts()
    .filter(
      (r) =>
        r.currentUrl &&
        FAST_DISCOVERY_SOURCES.has(r.source) &&
        Number(r.lastSeenAt) >= cutoff
    )
    .sort((a, b) => (SOURCE_WEIGHT[b.source] || 0) - (SOURCE_WEIGHT[a.source] || 0))
    .map((r) => String(r.currentUrl).replace(/\/+$/, ''));
}

/**
 * Remove entries older than maxAgeMs.
 * @param {number} [maxAgeMs=90000]
 */
export function evictStale(maxAgeMs = 90_000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [fp, r] of _registry) {
    if (r.lastSeenAt < cutoff) _registry.delete(fp);
  }
}

/** Reads localStorage 'rplus.lan.pinnedFingerprint'. */
export function getPinnedFingerprint() {
  try {
    return String(localStorage.getItem(PINNED_FP_KEY) || '').trim();
  } catch {
    return '';
  }
}

/** @param {string} fp */
export function setPinnedFingerprint(fp) {
  try {
    if (!fp) {
      localStorage.removeItem(PINNED_FP_KEY);
      return;
    }
    localStorage.setItem(PINNED_FP_KEY, String(fp));
  } catch {
    /* localStorage unavailable */
  }
}

export function clearPinnedFingerprint() {
  try {
    localStorage.removeItem(PINNED_FP_KEY);
  } catch {
    /* localStorage unavailable */
  }
}

/** One-time migration: seed registry from legacy rpc-lan-pinned-host-url if no fingerprint yet. */
function _migrateFromLegacyPinnedUrl() {
  try {
    if (getPinnedFingerprint()) return;
    const legacyUrl = String(localStorage.getItem('rpc-lan-pinned-host-url') || '')
      .trim()
      .replace(/\/+$/, '');
    if (!legacyUrl) return;
    const provisionalFp = `legacy:${legacyUrl}`;
    upsertHost({
      fingerprint: provisionalFp,
      clientId: 'legacy',
      startedAt: 0,
      currentUrl: legacyUrl,
      rank: '',
      dbUnlocked: false,
      shiftPinActive: false,
      rttMs: 0,
      lastSeenAt: Date.now(),
      source: 'scan',
    });
    setPinnedFingerprint(provisionalFp);
  } catch {
    /* localStorage unavailable */
  }
}

_migrateFromLegacyPinnedUrl();
