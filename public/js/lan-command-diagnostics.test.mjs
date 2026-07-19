import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommandSyncDiagnostics } from './lan-sync-diagnostics.mjs';

describe('command sync diagnostics', () => {
  it('reports command queue and scheduler fields', () => {
    const out = buildCommandSyncDiagnostics({
      commandQueueDepth: 2,
      oldestPendingCommandAgeMs: 15000,
      lastCommandAck: { status: 'accepted', at: '2026-06-06T14:34:10.000Z' },
      lastAppliedSeq: 12,
      lastAckedCommandId: 'cmd_1',
      schedulerPendingRooms: ['sala-1'],
      lastFlush: { reason: 'sync-now', ok: true },
      staleBaseCount: 1,
      duplicateCommandCount: 3,
      clockDriftWarnings: 1,
      replayGapCount: 2,
      fullBundleFallbackCount: 1,
    });

    assert.equal(out.commandQueueDepth, 2);
    assert.equal(out.lastAppliedSeq, 12);
    assert.deepEqual(out.schedulerPendingRooms, ['sala-1']);
    assert.equal(out.staleBaseCount, 1);
  });
});
