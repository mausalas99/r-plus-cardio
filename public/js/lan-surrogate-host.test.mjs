import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  surrogateElectionDelayMs,
  pruneLivePeers,
  recordLivePeer,
  listLivePeerHostUrls,
} from './lan-surrogate-host.mjs';

describe('lan-surrogate-host', () => {
  it('surrogateElectionDelayMs is stable and bounded', () => {
    const a = surrogateElectionDelayMs('lc_abc');
    const b = surrogateElectionDelayMs('lc_abc');
    const c = surrogateElectionDelayMs('lc_xyz');
    assert.equal(a, b);
    assert.ok(a >= 400 && a < 2800);
    assert.ok(c >= 400 && c < 2800);
  });

  it('recordLivePeer and listLivePeerHostUrls dedupe urls', () => {
    const store = {
      getItem(k) {
        return this._[k] || null;
      },
      setItem(k, v) {
        this._[k] = v;
      },
      _: {},
    };
    globalThis.localStorage = store;
    recordLivePeer('a', { hostUrl: 'http://10.0.0.2:3738', canHost: true });
    recordLivePeer('b', { hostUrl: 'http://10.0.0.2:3738', canHost: true });
    recordLivePeer('c', { hostUrl: 'http://10.0.0.3:3738', canHost: true });
    const urls = listLivePeerHostUrls('self');
    assert.deepEqual(urls, ['http://10.0.0.2:3738', 'http://10.0.0.3:3738']);
    pruneLivePeers(Date.now() + 6 * 60 * 1000);
    assert.deepEqual(listLivePeerHostUrls('self'), []);
  });
});
