import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const roomSnapshotSrc = fs.readFileSync(new URL('./lan/room-snapshot.mjs', import.meta.url), 'utf8');
const roomWireSrc = fs.readFileSync(new URL('./lan/room-wire.mjs', import.meta.url), 'utf8');
const orchestratorApplySrc = fs.readFileSync(
  new URL('./lan/orchestrator-bundle-apply.mjs', import.meta.url),
  'utf8'
);
const pushBundleSrc = fs.readFileSync(new URL('./lan/push-bundle.mjs', import.meta.url), 'utf8');
const outboxSrc = fs.readFileSync(new URL('../live-sync-outbox.mjs', import.meta.url), 'utf8');

test('LAN room advertises delta capability and handles applied deltas', () => {
  assert.match(roomSnapshotSrc, /deltaSync:\s*1/);
  assert.match(roomSnapshotSrc, /lastDeltaSeq/);
  assert.match(roomWireSrc, /livesync:delta:applied/);
});

test('orchestrator applies remote deltas under guard and suppresses own echoes', () => {
  assert.match(orchestratorApplySrc, /withRemoteDeltaApply/);
  assert.match(orchestratorApplySrc, /createDeltaEchoTracker/);
  assert.match(orchestratorApplySrc, /deltaLabelForPath/);
});

test('push flushes delta outbox through HTTP delta endpoint', () => {
  assert.match(outboxSrc, /item\.kind === 'delta'/);
  assert.match(pushBundleSrc, /\/delta/);
});
