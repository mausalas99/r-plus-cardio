'use strict';
const { test, mock } = require('node:test');
const assert = require('node:assert');
const { createTicketStore, TTL_MS } = require('./ticket-store.js');

const HOST_TOKEN = 'a'.repeat(64);

function makeStore() {
  return createTicketStore({ getHostToken: () => HOST_TOKEN });
}

test('mint returns ticketId, pin, and expiresAt ISO', () => {
  const store = makeStore();
  const m = store.mint();
  assert.match(m.ticketId, /^req_[a-f0-9]{12}$/);
  assert.match(m.pin, /^[1-9]\d{5}$/);
  const pinNum = Number(m.pin);
  assert.ok(pinNum >= 100000 && pinNum <= 999999);
  assert.doesNotThrow(() => new Date(m.expiresAt).toISOString());
});

test('exchange by ticket returns host token', () => {
  const store = makeStore();
  const { ticketId } = store.mint();
  const result = store.exchange({ ticket: ticketId });
  assert.strictEqual(result.token, HOST_TOKEN);
});

test('exchange by pin burns ticket', () => {
  const store = makeStore();
  const { ticketId, pin } = store.mint();
  const first = store.exchange({ pin });
  assert.ok(first.token);
  assert.strictEqual(store.exchange({ pin }), null);
  assert.strictEqual(store.exchange({ ticket: ticketId }), null);
});

test('exchange burns ticket after first read by ticket', () => {
  const store = makeStore();
  const { ticketId } = store.mint();
  assert.ok(store.exchange({ ticket: ticketId }));
  assert.strictEqual(store.exchange({ ticket: ticketId }), null);
});

test('exchange returns null for expired ticket', () => {
  mock.timers.enable({ apis: ['Date'] });
  try {
    const store = makeStore();
    const { ticketId } = store.mint();
    mock.timers.tick(TTL_MS + 1);
    assert.strictEqual(store.exchange({ ticket: ticketId }), null);
    assert.strictEqual(store.exchange({ ticket: ticketId }), null);
  } finally {
    mock.timers.reset();
  }
});

test('exchange returns null for unknown ticket or pin', () => {
  const store = makeStore();
  assert.strictEqual(store.exchange({ ticket: 'req_deadbeef0000' }), null);
  assert.strictEqual(store.exchange({ pin: '999999' }), null);
  assert.strictEqual(store.exchange({}), null);
});

test('mint assigns unique PINs across many tickets', () => {
  const store = makeStore();
  const pins = new Set();
  for (let i = 0; i < 50; i++) {
    const { pin } = store.mint();
    assert.ok(!pins.has(pin), `PIN collision on attempt ${i}`);
    pins.add(pin);
  }
});

test('sweep removes expired tickets', () => {
  mock.timers.enable({ apis: ['Date'] });
  try {
    const store = makeStore();
    const { ticketId } = store.mint();
    mock.timers.tick(TTL_MS + 1);
    store.sweep();
    assert.strictEqual(store.exchange({ ticket: ticketId }), null);
  } finally {
    mock.timers.reset();
  }
});
