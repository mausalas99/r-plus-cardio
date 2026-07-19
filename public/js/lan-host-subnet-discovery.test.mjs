import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverLanHostsOnSubnet,
  discoverLanHostsOnSubnetViaBeacon,
  lanHostBasesSameMachine,
  normalizeLanHostBase,
  resolveLocalLanSubnetPrefixes,
} from './lan-host-subnet-discovery.mjs';

describe('lan-host-subnet-discovery', () => {
  it('returns empty without team code or private IP', async () => {
    assert.deepEqual(await discoverLanHostsOnSubnet('', 'http://10.1.2.3:3738'), []);
    assert.deepEqual(await discoverLanHostsOnSubnet('tok', ''), []);
    assert.deepEqual(await discoverLanHostsOnSubnet('tok', 'not-a-url'), []);
  });

  it('beacon discovery returns empty without private IP', async () => {
    assert.deepEqual(await discoverLanHostsOnSubnetViaBeacon(''), []);
    assert.deepEqual(await discoverLanHostsOnSubnetViaBeacon('not-a-url'), []);
  });

  it('lanHostBasesSameMachine detects matching host IPv4', () => {
    assert.equal(
      lanHostBasesSameMachine('http://127.0.0.1:3738', 'http://127.0.0.1:3738'),
      true
    );
    assert.equal(
      lanHostBasesSameMachine('http://10.0.0.2:3738', 'http://10.0.0.3:3738'),
      false
    );
  });

  it('normalizeLanHostBase adds http scheme', () => {
    assert.equal(normalizeLanHostBase('10.0.0.2:3738'), 'http://10.0.0.2:3738');
  });

  it('resolveLocalLanSubnetPrefixes falls back from own URL', async () => {
    const prefixes = await resolveLocalLanSubnetPrefixes('http://10.55.1.9:3738');
    assert.ok(Array.isArray(prefixes));
    if (prefixes.length) assert.equal(prefixes[0], '10.55.1');
  });

  it('discoverLanHostsOnSubnet skips scan when explicit prefixes are empty', async () => {
    assert.deepEqual(
      await discoverLanHostsOnSubnet('tok', 'http://10.1.2.3:3738', { subnetPrefixes: [] }),
      []
    );
  });
});
