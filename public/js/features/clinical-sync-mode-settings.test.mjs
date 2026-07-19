import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isClinicalLocalOnlyMode,
  setClinicalSyncModeLocalOnly,
} from '../clinical-settings.mjs';

describe('clinical-sync-mode-settings', () => {
  it('setClinicalSyncModeLocalOnly(false) clears local-only flag', () => {
    const store = { 'rpc-settings': JSON.stringify({ clinicalLocalOnly: true }) };
    const prev = globalThis.localStorage;
    globalThis.localStorage = {
      getItem(k) {
        return store[k];
      },
      setItem(k, v) {
        store[k] = v;
      },
    };
    try {
      setClinicalSyncModeLocalOnly(false);
      assert.equal(isClinicalLocalOnlyMode(JSON.parse(store['rpc-settings'])), false);
    } finally {
      if (prev === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prev;
    }
  });
});
