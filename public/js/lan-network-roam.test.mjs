import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHostOnCurrentSubnets,
  applyLanNetworkRoamingWithFingerprint,
} from './lan-network-roam.mjs';
import {
  upsertHost,
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

describe('lan-network-roam', () => {
  beforeEach(() => {
    mockLocalStorage();
    _resetRegistryForTest();
    clearPinnedFingerprint();
  });

  it('isHostOnCurrentSubnets matches /24 prefix', () => {
    assert.equal(
      isHostOnCurrentSubnets('http://10.55.1.9:3738', ['10.55.1', '10.9.8']),
      true
    );
    assert.equal(
      isHostOnCurrentSubnets('http://10.55.2.9:3738', ['10.55.1', '10.9.8']),
      false
    );
    assert.equal(isHostOnCurrentSubnets('', ['10.55.1']), false);
    assert.equal(isHostOnCurrentSubnets('http://10.55.1.9:3738', []), false);
  });

  it('applyLanNetworkRoamingWithFingerprint: no pinned fp → shortcut false', async () => {
    const result = await applyLanNetworkRoamingWithFingerprint({}, {
      savedHostUrl: 'http://10.0.0.1:3738',
      pingFn: async () => true,
    });
    assert.equal(result.shortcut, false);
  });

  it('applyLanNetworkRoamingWithFingerprint: fp not in registry → shortcut false', async () => {
    setPinnedFingerprint('missing:9999');
    const result = await applyLanNetworkRoamingWithFingerprint({}, {
      savedHostUrl: 'http://10.0.0.1:3738',
      pingFn: async () => true,
    });
    assert.equal(result.shortcut, false);
  });

  it('applyLanNetworkRoamingWithFingerprint: registry new IP + ping ok → shortcut true + newUrl', async () => {
    setPinnedFingerprint('lc_1:1000');
    upsertHost({
      fingerprint: 'lc_1:1000',
      clientId: 'lc_1',
      startedAt: 1000,
      currentUrl: 'http://10.55.2.9:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 20,
      lastSeenAt: Date.now(),
      source: 'heartbeat',
    });

    const result = await applyLanNetworkRoamingWithFingerprint({}, {
      savedHostUrl: 'http://10.55.1.9:3738',
      teamCode: 'TEAM1',
      pingFn: async (url) => url === 'http://10.55.2.9:3738',
    });

    assert.equal(result.shortcut, true);
    assert.equal(result.newUrl, 'http://10.55.2.9:3738');
  });

  it('applyLanNetworkRoamingWithFingerprint: ping fails → shortcut false', async () => {
    setPinnedFingerprint('lc_1:1000');
    upsertHost({
      fingerprint: 'lc_1:1000',
      clientId: 'lc_1',
      startedAt: 1000,
      currentUrl: 'http://10.55.2.9:3738',
      rank: 'R4',
      dbUnlocked: true,
      shiftPinActive: false,
      rttMs: 20,
      lastSeenAt: Date.now(),
      source: 'heartbeat',
    });

    const result = await applyLanNetworkRoamingWithFingerprint({}, {
      savedHostUrl: 'http://10.55.1.9:3738',
      pingFn: async () => false,
    });

    assert.equal(result.shortcut, false);
    assert.equal(result.newUrl, undefined);
  });
});
