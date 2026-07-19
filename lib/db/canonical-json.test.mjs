import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalStringify } from './canonical-json.mjs';

describe('canonical-json', () => {
  it('sorts object keys deterministically', () => {
    const a = canonicalStringify({ z: 1, a: { y: 2, b: 3 } });
    const b = canonicalStringify({ a: { b: 3, y: 2 }, z: 1 });
    assert.equal(a, b);
  });
});
