'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createShiftPinStore, endOfCalendarMonthMs } = require('./shift-pin-store.js');

function tempPinFile() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'lan-shift-pin-')),
    'lan-shift-pin.json'
  );
}

test('shift PIN is reusable until expiry', () => {
  const token = 'x'.repeat(64);
  const store = createShiftPinStore({ getHostToken: () => token });
  const { pin } = store.ensure();

  const first = store.exchange(pin);
  const second = store.exchange(pin);
  assert.strictEqual(first.token, token);
  assert.strictEqual(second.token, token);
});

test('ensure expires at start of next calendar month', () => {
  const token = 'z'.repeat(64);
  const store = createShiftPinStore({ getHostToken: () => token });
  const now = new Date('2026-06-15T12:00:00').getTime();
  const { expiresAt } = store.ensure(now);
  assert.strictEqual(expiresAt, new Date('2026-07-01T00:00:00').toISOString());
  assert.strictEqual(endOfCalendarMonthMs(now), new Date('2026-07-01T00:00:00').getTime());
});

test('regenerate keeps previous PIN in grace until month end', () => {
  const token = 'y'.repeat(64);
  const store = createShiftPinStore({ getHostToken: () => token });
  const old = store.ensure().pin;
  const fresh = store.regenerate().pin;

  assert.notStrictEqual(old, fresh);
  assert.strictEqual(store.exchange(fresh).token, token);
  assert.strictEqual(store.exchange(old).token, token);
});

test('persisted PIN survives store restart within same month', () => {
  const token = 'p'.repeat(64);
  const filePath = tempPinFile();
  const now = new Date('2030-06-20T10:00:00').getTime();

  const first = createShiftPinStore({ getHostToken: () => token, filePath });
  const { pin } = first.ensure(now);

  const second = createShiftPinStore({ getHostToken: () => token, filePath });
  const status = second.getStatus();
  assert.strictEqual(status.pin, pin);
  assert.strictEqual(second.exchange(pin).token, token);
});

test('grace PIN survives restart after manual regenerate', () => {
  const token = 'g'.repeat(64);
  const filePath = tempPinFile();
  const now = new Date('2030-06-20T10:00:00').getTime();

  const host = createShiftPinStore({ getHostToken: () => token, filePath });
  const oldPin = host.ensure(now).pin;
  const newPin = host.regenerate().pin;

  const restarted = createShiftPinStore({ getHostToken: () => token, filePath });
  assert.strictEqual(restarted.getStatus().pin, newPin);
  assert.strictEqual(restarted.exchange(oldPin).token, token);
  assert.strictEqual(restarted.exchange(newPin).token, token);
});

test('expired grace PIN is rejected', () => {
  const token = 'e'.repeat(64);
  const filePath = tempPinFile();
  const expiredAt = Date.now() - 60_000;
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      version: 1,
      active: { pin: '333333', expiresAt: endOfCalendarMonthMs() },
      grace: [{ pin: '222222', expiresAt: expiredAt }],
    })
  );

  const store = createShiftPinStore({ getHostToken: () => token, filePath });
  assert.strictEqual(store.exchange('222222'), null);
  assert.strictEqual(store.exchange('333333').token, token);
});
