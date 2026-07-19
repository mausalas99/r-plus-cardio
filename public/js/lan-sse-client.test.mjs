// public/js/lan-sse-client.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseLine } from './lan-sse-client.mjs';

describe('parseSseLine', () => {
  it('parses a data line', () => {
    const ev = parseSseLine('data: {"type":"hello","x":1}');
    assert.deepEqual(ev, { type: 'hello', x: 1 });
  });

  it('returns null for comment lines', () => {
    assert.equal(parseSseLine(':'), null);
    assert.equal(parseSseLine(''), null);
  });

  it('returns null for malformed JSON', () => {
    assert.equal(parseSseLine('data: not-json'), null);
  });
});
