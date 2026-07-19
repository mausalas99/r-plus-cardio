// public/js/lan-host-registry.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertHost,
  findByFingerprint,
  findByUrl,
  listHosts,
  listRegistryDiscoveryUrls,
  evictStale,
  getPinnedFingerprint,
  setPinnedFingerprint,
  clearPinnedFingerprint,
  _resetRegistryForTest,
} from './lan-host-registry.mjs';

function mockLocalStorage() {
  const store = {
    getItem(k) {
      return this._[k] ?? null;
    },
    setItem(k, v) {
      this._[k] = v;
    },
    removeItem(k) {
      delete this._[k];
    },
    _: {},
  };
  globalThis.localStorage = store;
  return store;
}

describe('lan-host-registry', () => {
  beforeEach(() => {
    mockLocalStorage();
    _resetRegistryForTest();
    clearPinnedFingerprint();
  });

  it('upsertHost stores and retrieves by fingerprint', () => {
    upsertHost({
      fingerprint: 'lc_1:1000',
      clientId: 'lc_1',
      startedAt: 1000,
      currentUrl: 'http://10.0.0.1:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: true,
      rttMs: 20,
      lastSeenAt: Date.now(),
      source: 'scan',
    });
    const r = findByFingerprint('lc_1:1000');
    assert.ok(r);
    assert.equal(r.currentUrl, 'http://10.0.0.1:3738');
  });

  it('findByUrl reverse-lookup', () => {
    upsertHost({
      fingerprint: 'lc_2:2000',
      clientId: 'lc_2',
      startedAt: 2000,
      currentUrl: 'http://10.0.0.2:3738',
      rank: 'R3',
      dbUnlocked: false,
      shiftPinActive: false,
      rttMs: 50,
      lastSeenAt: Date.now(),
      source: 'mdns',
    });
    const r = findByUrl('http://10.0.0.2:3738');
    assert.ok(r);
    assert.equal(r.fingerprint, 'lc_2:2000');
  });

  it('higher-weight source overwrites URL from lower-weight source', () => {
    const now = Date.now();
    upsertHost({
      fingerprint: 'lc_3:3000',
      clientId: 'lc_3',
      startedAt: 3000,
      currentUrl: 'http://10.0.0.3:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 10,
      lastSeenAt: now - 100,
      source: 'scan',
    });
    upsertHost({
      fingerprint: 'lc_3:3000',
      clientId: 'lc_3',
      startedAt: 3000,
      currentUrl: 'http://10.0.0.99:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 10,
      lastSeenAt: now,
      source: 'mdns',
    });
    assert.equal(findByFingerprint('lc_3:3000').currentUrl, 'http://10.0.0.99:3738');
  });

  it('lower-weight source does NOT overwrite URL from higher-weight source', () => {
    const now = Date.now();
    upsertHost({
      fingerprint: 'lc_4:4000',
      clientId: 'lc_4',
      startedAt: 4000,
      currentUrl: 'http://10.0.0.4:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 10,
      lastSeenAt: now,
      source: 'heartbeat',
    });
    upsertHost({
      fingerprint: 'lc_4:4000',
      clientId: 'lc_4',
      startedAt: 4000,
      currentUrl: 'http://10.0.0.5:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 10,
      lastSeenAt: now + 1,
      source: 'scan',
    });
    assert.equal(findByFingerprint('lc_4:4000').currentUrl, 'http://10.0.0.4:3738');
  });

  it('evictStale removes old entries', () => {
    upsertHost({
      fingerprint: 'lc_5:5000',
      clientId: 'lc_5',
      startedAt: 5000,
      currentUrl: 'http://10.0.0.5:3738',
      rank: 'R3',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 10,
      lastSeenAt: Date.now() - 200_000,
      source: 'scan',
    });
    evictStale(90_000);
    assert.equal(findByFingerprint('lc_5:5000'), null);
  });

  it('listHosts returns only non-evicted entries after evictStale', () => {
    upsertHost({
      fingerprint: 'fresh:1',
      clientId: 'fresh',
      startedAt: 1,
      currentUrl: 'http://10.0.0.6:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 5,
      lastSeenAt: Date.now(),
      source: 'mdns',
    });
    upsertHost({
      fingerprint: 'stale:2',
      clientId: 'stale',
      startedAt: 2,
      currentUrl: 'http://10.0.0.7:3738',
      rank: 'R3',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 5,
      lastSeenAt: Date.now() - 200_000,
      source: 'scan',
    });
    evictStale(90_000);
    const hosts = listHosts();
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0].fingerprint, 'fresh:1');
  });

  it('pinnedFingerprint roundtrip (mocked localStorage)', () => {
    setPinnedFingerprint('lc_x:9999');
    assert.equal(getPinnedFingerprint(), 'lc_x:9999');
    clearPinnedFingerprint();
    assert.equal(getPinnedFingerprint(), '');
  });

  it('listRegistryDiscoveryUrls returns recent mdns/udp/heartbeat only', () => {
    const now = Date.now();
    upsertHost({
      fingerprint: 'mdns:1',
      clientId: 'a',
      startedAt: 1,
      currentUrl: 'http://10.0.0.2:3738',
      source: 'mdns',
      lastSeenAt: now,
    });
    upsertHost({
      fingerprint: 'scan:1',
      clientId: 'b',
      startedAt: 2,
      currentUrl: 'http://10.0.0.3:3738',
      source: 'scan',
      lastSeenAt: now,
    });
    upsertHost({
      fingerprint: 'stale:1',
      clientId: 'c',
      startedAt: 3,
      currentUrl: 'http://10.0.0.4:3738',
      source: 'udp',
      lastSeenAt: now - 120_000,
    });
    assert.deepEqual(listRegistryDiscoveryUrls(90_000), ['http://10.0.0.2:3738']);
  });
});
