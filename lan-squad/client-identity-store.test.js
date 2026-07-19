'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const { createClientIdentityStore, TTL_MS } = require('./client-identity-store.js');

test('issue and resolve roundtrip', () => {
  const store = createClientIdentityStore();
  const token = store.issue('lc_test_client');
  assert.match(token, /^cit_[a-f0-9]{32}$/);
  assert.strictEqual(store.resolve(token), 'lc_test_client');
});

test('issue rejects malformed clientId', () => {
  const store = createClientIdentityStore();
  assert.strictEqual(store.issue(''), null);
  assert.strictEqual(store.issue('ab'), null);
  assert.strictEqual(store.issue('x'.repeat(80)), null);
});

test('resolve returns empty for unknown token', () => {
  const store = createClientIdentityStore();
  assert.strictEqual(store.resolve('cit_deadbeef'), '');
  assert.strictEqual(store.resolve(''), '');
});

test('sweep drops expired tokens', () => {
  mock.timers.enable({ apis: ['Date'] });
  try {
    const store = createClientIdentityStore();
    const token = store.issue('lc_ttl_client');
    assert.strictEqual(store.resolve(token), 'lc_ttl_client');
    mock.timers.tick(TTL_MS + 1);
    store.sweep();
    assert.strictEqual(store.resolve(token), '');
  } finally {
    mock.timers.reset();
  }
});
