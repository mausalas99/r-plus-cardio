'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_HTTP_PORT,
  DEFAULT_BEACON_PORT,
  resolveHttpPort,
  resolveBeaconPort,
} = require('./http-port.js');

test('Cardionotas defaults differ from R+ (3738/3739)', () => {
  assert.equal(DEFAULT_HTTP_PORT, 3838);
  assert.equal(DEFAULT_BEACON_PORT, 3840);
  assert.notEqual(DEFAULT_HTTP_PORT, 3738);
  assert.notEqual(DEFAULT_BEACON_PORT, 3739);
});

test('resolveHttpPort respects CARDIONOTAS_HTTP_PORT', () => {
  const prev = process.env.CARDIONOTAS_HTTP_PORT;
  process.env.CARDIONOTAS_HTTP_PORT = '3911';
  try {
    assert.equal(resolveHttpPort(), 3911);
  } finally {
    if (prev == null) delete process.env.CARDIONOTAS_HTTP_PORT;
    else process.env.CARDIONOTAS_HTTP_PORT = prev;
  }
});

test('resolveBeaconPort respects CARDIONOTAS_BEACON_PORT', () => {
  const prev = process.env.CARDIONOTAS_BEACON_PORT;
  process.env.CARDIONOTAS_BEACON_PORT = '3912';
  try {
    assert.equal(resolveBeaconPort(), 3912);
  } finally {
    if (prev == null) delete process.env.CARDIONOTAS_BEACON_PORT;
    else process.env.CARDIONOTAS_BEACON_PORT = prev;
  }
});
