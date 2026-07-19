import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
const mockLocalStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
};

const { isPerfEnabled } = await import('./perf-markers.mjs');

describe('isPerfEnabled', () => {
  beforeEach(() => {
    store = {};
    global.localStorage = mockLocalStorage;
    delete globalThis.__RPLUS_PERF__;
  });

  afterEach(() => {
    delete globalThis.__RPLUS_PERF__;
  });

  it('returns false by default', () => {
    assert.equal(isPerfEnabled(), false);
  });

  it('returns true when localStorage rplus-perf is 1', () => {
    store['rplus-perf'] = '1';
    assert.equal(isPerfEnabled(), true);
  });

  it('returns false when localStorage rplus-perf is not 1', () => {
    store['rplus-perf'] = '0';
    assert.equal(isPerfEnabled(), false);
  });

  it('returns true when globalThis.__RPLUS_PERF__ is set', () => {
    globalThis.__RPLUS_PERF__ = true;
    assert.equal(isPerfEnabled(), true);
  });
});
