'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSyncScheduler } = require('./sync-scheduler.js');

test('scheduleMaterialize coalesces multiple room requests into one flush', async () => {
  const calls = [];
  const scheduler = createSyncScheduler({
    windowMs: 5,
    hostStore: {
      materializeRoomViews(roomId, opts) {
        calls.push({ roomId, opts });
        return { revision: 7, deltaSeq: 3 };
      },
      getRoomSyncBundle() {
        return { revision: 7, deltaSeq: 3 };
      },
    },
  });

  scheduler.scheduleMaterialize('room-a', { reason: 'command' });
  scheduler.scheduleMaterialize('room-a', { reason: 'command' });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].roomId, 'room-a');
});

test('flush pre-empts pending throttle and returns latest revision and deltaSeq', async () => {
  const calls = [];
  const scheduler = createSyncScheduler({
    windowMs: 50,
    hostStore: {
      materializeRoomViews(roomId, opts) {
        calls.push({ roomId, opts });
      },
      getRoomSyncBundle() {
        return { revision: 9, deltaSeq: 4 };
      },
    },
  });

  scheduler.scheduleMaterialize('room-a', { reason: 'command' });
  const out = await scheduler.flush('room-a', { reason: 'sync-now' });

  assert.equal(calls.length, 1);
  assert.equal(out.ok, true);
  assert.equal(out.revision, 9);
  assert.equal(out.latestDeltaSeq, 4);
  assert.equal(out.reason, 'sync-now');
});

test('flush appends sync.flush audit entry with reason and clientId', async () => {
  const audits = [];
  const scheduler = createSyncScheduler({
    windowMs: 50,
    hostStore: {
      materializeRoomViews() {},
      getRoomSyncBundle() {
        return { revision: 9, deltaSeq: 4 };
      },
      appendRoomBundleAudit(roomId, entry) {
        audits.push({ roomId, entry });
      },
    },
  });
  await scheduler.flush('room-a', { reason: 'manual-troubleshooting', clientId: 'lc_a' });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entry.action, 'sync.flush');
  assert.equal(audits[0].entry.detail.reason, 'manual-troubleshooting');
  assert.equal(audits[0].entry.clientId, 'lc_a');
});
