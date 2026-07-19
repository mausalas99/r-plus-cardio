import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMinVersionPayload } from './min-version-fetch.mjs';

describe('fetchMinVersionPayload', () => {
  it('returns null without fetch', async () => {
    const prev = globalThis.fetch;
    globalThis.fetch = undefined;
    try {
      assert.equal(await fetchMinVersionPayload(), null);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
