'use strict';
const assert = require('node:assert');
const { test } = require('node:test');
const { createUdpBeacon } = require('./lan-udp-beacon.js');

test('UDP beacon: listener responds to discover datagram', async () => {
  const beacon = createUdpBeacon({
    clientId: 'lc_test', startedAt: 12345, rank: 'R4',
    teamHash: 'abcd1234', port: 0,
  });
  const assignedPort = await beacon.startListening();
  assert.ok(assignedPort > 0, 'port must be > 0');

  const results = await beacon.discoverOnPort(assignedPort, 300);
  assert.ok(Array.isArray(results), 'results should be array');
  assert.ok(results.length >= 1, 'at least one beacon response expected');
  const r = results[0];
  assert.strictEqual(r.clientId, 'lc_test');
  assert.strictEqual(r.teamHash, 'abcd1234');

  beacon.stop();
});

test('UDP beacon: discover returns empty array on timeout with no listeners', async () => {
  const beacon = createUdpBeacon({
    clientId: 'lc_dummy', startedAt: 1, rank: 'R1', teamHash: 'x', port: 0,
  });
  const results = await beacon.discoverOnPort(39999, 100);
  assert.deepEqual(results, []);
  beacon.stop();
});
