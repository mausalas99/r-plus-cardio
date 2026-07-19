import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  WARD_HOST_REGISTRY_KEY,
  loadWardHostRegistry,
  recordWardHostUrl,
  mergeWardHostRegistry,
  pruneWardHostRegistry,
  listWardHostUrlsForProbe,
  listWardSubnetPrefixesForProbe,
  clearWardHostRegistry,
  recordWardHostPrefix,
  seedBundledWardConnectionPoints,
} from './lan-ward-host-registry.mjs';

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

describe('lan-ward-host-registry', () => {
  /** @type {ReturnType<typeof mockLocalStorage>} */
  let store;

  beforeEach(() => {
    store = mockLocalStorage();
    globalThis.localStorage = store;
    clearWardHostRegistry();
  });

  it('listWardHostUrlsForProbe always includes bundled ward host', () => {
    assert.deepEqual(listWardHostUrlsForProbe(), ['http://10.0.57.65:3738']);
  });

  it('listWardHostUrlsForProbe skips registry URLs off current subnet', () => {
    recordWardHostUrl('http://172.20.10.2:3738', { source: 'client' });
    recordWardHostUrl('http://10.0.166.59:3738', { source: 'host' });
    const filtered = listWardHostUrlsForProbe(undefined, {
      localSubnetPrefixes: ['10.0.166'],
    });
    assert.ok(filtered.includes('http://10.0.57.65:3738'));
    assert.ok(filtered.includes('http://10.0.166.59:3738'));
    assert.ok(!filtered.includes('http://172.20.10.2:3738'));
  });

  it('record + merge dedupes URLs and prefixes', () => {
    recordWardHostUrl('http://10.0.57.52:3738', { source: 'host' });
    recordWardHostUrl('http://10.0.57.52:3738', { source: 'client' });
    mergeWardHostRegistry({
      hostUrls: [
        { url: 'http://10.0.166.59:3738', source: 'host' },
        'http://10.0.57.52:3738',
      ],
      prefixes: ['10.0.57', '10.0.166', '10.0.57'],
    });
    const reg = loadWardHostRegistry();
    const urls = reg.hostUrls.map((e) => e.url);
    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes('http://10.0.57.52:3738'));
    assert.ok(urls.includes('http://10.0.166.59:3738'));
    assert.deepEqual(new Set(reg.prefixes), new Set(['10.0.166', '10.0.57']));
  });

  it('prune drops stale entries', () => {
    const reg = loadWardHostRegistry();
    const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
    reg.hostUrls = [
      {
        url: 'http://10.0.1.1:3738',
        prefix: '10.0.1',
        lastSeenAt: stale,
        lastOkAt: stale,
        source: 'host',
      },
      {
        url: 'http://10.0.2.2:3738',
        prefix: '10.0.2',
        lastSeenAt: Date.now(),
        lastOkAt: Date.now(),
        source: 'host',
      },
    ];
    store.setItem(WARD_HOST_REGISTRY_KEY, JSON.stringify(reg));
    pruneWardHostRegistry();
    const after = loadWardHostRegistry();
    assert.equal(after.hostUrls.length, 1);
    assert.equal(after.hostUrls[0].url, 'http://10.0.2.2:3738');
    const probeUrls = listWardHostUrlsForProbe();
    assert.equal(probeUrls.length, 2);
    assert.ok(probeUrls.includes('http://10.0.57.65:3738'));
    assert.ok(probeUrls.includes('http://10.0.2.2:3738'));
  });

  it('listWardSubnetPrefixesForProbe unions local and saved', async () => {
    recordWardHostPrefix('10.0.166');
    const prefixes = await listWardSubnetPrefixesForProbe('http://10.0.57.9:3738');
    assert.ok(prefixes.includes('10.0.57'));
    assert.ok(prefixes.includes('10.0.166'));
  });

  it('seedBundledWardConnectionPoints writes shipped host URL and prefix', () => {
    const reg = seedBundledWardConnectionPoints();
    assert.ok(reg.hostUrls.some((e) => e.url === 'http://10.0.57.65:3738'));
    assert.ok(reg.prefixes.includes('10.0.57'));
  });
});
