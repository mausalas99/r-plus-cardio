import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectShiftPinProbeUrls,
  getShiftPinCooldownMs,
  recordShiftPinFailure,
  resetShiftPinBackoff,
} from './lan-shift-pin-connect.mjs';
import { clearWardHostRegistry, recordWardHostUrl } from './lan-ward-host-registry.mjs';

const shiftPinSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'lan-shift-pin-connect.mjs'),
  'utf8'
);

function mockLocalStorage() {
  const data = {};
  return {
    getItem(k) {
      return data[k] ?? null;
    },
    setItem(k, v) {
      data[k] = String(v);
    },
    removeItem(k) {
      delete data[k];
    },
  };
}

describe('lan-shift-pin-connect probe order', () => {
  beforeEach(() => {
    globalThis.localStorage = mockLocalStorage();
    clearWardHostRegistry();
  });

  it('collectShiftPinProbeUrls prefers explicit hostUrl, then cfg, then registry', () => {
    recordWardHostUrl('http://10.0.99.1:3738', { source: 'host' });
    const urls = collectShiftPinProbeUrls(
      { hostUrl: 'http://10.0.57.52:3738' },
      { hostUrl: 'http://10.0.166.59:3738' }
    );
    assert.equal(urls[0], 'http://10.0.57.52:3738');
    assert.equal(urls[1], 'http://10.0.166.59:3738');
    assert.ok(urls.includes('http://10.0.99.1:3738'));
  });

  it('connectLanWithShiftPin probes registry before ward subnet beacon scan', () => {
    const fnStart = shiftPinSrc.indexOf('async function tryShiftPinJoinSequence');
    assert.ok(fnStart > 0);
    const fnBody = shiftPinSrc.slice(fnStart);
    const probeIdx = fnBody.indexOf('collectShiftPinProbeUrls');
    const fastIdx = fnBody.indexOf('collectShiftPinFastDiscoveryUrls');
    const beaconIdx = fnBody.indexOf('discoverLanHostsOnAllLocalSubnetsViaBeacon');
    const wardExtraIdx = fnBody.indexOf('discoverExtraWardHosts');
    const wardPrefixIdx = shiftPinSrc.indexOf('listWardSubnetPrefixesForProbe');
    assert.ok(probeIdx > 0 && fastIdx > probeIdx && beaconIdx > fastIdx);
    assert.ok(wardExtraIdx > beaconIdx);
    assert.ok(wardPrefixIdx > 0);
  });

  it('connectLanWithShiftPin skips loopback for remote join clients', () => {
    assert.ok(shiftPinSrc.includes('shouldTryLoopbackShiftPin'));
    assert.ok(shiftPinSrc.includes('isLanRemoteJoinMode'));
  });

  it('shift-pin exchange sends clientId from localStorage', () => {
    assert.ok(shiftPinSrc.includes("clientId: readShiftPinClientId()"));
    assert.ok(shiftPinSrc.includes("localStorage.setItem('rpc-lan-client-token'"));
  });
});

describe('lan-shift-pin-connect backoff', () => {
  beforeEach(() => {
    resetShiftPinBackoff();
  });

  it('starts at 12s and backs off through 30/60/120', () => {
    assert.equal(getShiftPinCooldownMs(), 12_000);
    recordShiftPinFailure();
    assert.equal(getShiftPinCooldownMs(), 30_000);
    recordShiftPinFailure();
    assert.equal(getShiftPinCooldownMs(), 60_000);
    recordShiftPinFailure();
    assert.equal(getShiftPinCooldownMs(), 120_000);
    recordShiftPinFailure();
    assert.equal(getShiftPinCooldownMs(), 120_000);
  });

  it('resets on resetShiftPinBackoff', () => {
    recordShiftPinFailure();
    recordShiftPinFailure();
    assert.equal(getShiftPinCooldownMs(), 60_000);
    resetShiftPinBackoff();
    assert.equal(getShiftPinCooldownMs(), 12_000);
  });
});
