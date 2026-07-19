import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPinnedHostUrl,
  setPinnedHostUrl,
  clearPinnedHostUrl,
  isPinnedHostLocal,
  isPinnedHostRemote,
} from './lan-host-pin.mjs';

describe('lan-host-pin', () => {
  it('stores and clears pinned host URL', () => {
    const store = {
      getItem(k) {
        return this._[k] || null;
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
    setPinnedHostUrl('http://10.0.0.5:3738/');
    assert.equal(getPinnedHostUrl(), 'http://10.0.0.5:3738');
    clearPinnedHostUrl();
    assert.equal(getPinnedHostUrl(), '');
  });

  it('isPinnedHostLocal distinguishes local vs remote pin', () => {
    const store = {
      getItem(k) {
        return this._[k] || null;
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
    setPinnedHostUrl('http://10.0.0.5:3738');
    assert.equal(isPinnedHostLocal('http://10.0.0.5:3738'), true);
    assert.equal(isPinnedHostRemote('http://10.0.0.5:3738'), false);
    assert.equal(isPinnedHostLocal('http://10.0.0.8:3738'), false);
    assert.equal(isPinnedHostRemote('http://10.0.0.8:3738'), true);
    clearPinnedHostUrl();
    assert.equal(isPinnedHostLocal('http://10.0.0.5:3738'), false);
  });
});
