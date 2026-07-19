import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLanCommand,
  normalizeCommandPushResponse,
  shouldRemoveCommandOutboxEntry,
} from './lan-command-client.mjs';

describe('lan-command-client', () => {
  it('buildLanCommand creates restart-safe command envelope', () => {
    const cmd = buildLanCommand({
      domain: 'eventualidades',
      op: 'add',
      roomId: 'sala-1',
      patientId: 'pat_1',
      clientId: 'lc_a',
      baseSeq: 7,
      payload: { eventualidadId: 'ev_1', text: 'Fiebre' },
      nowMs: () => 1718293049000,
      randomId: () => 'abc',
    });

    assert.equal(cmd.commandId, 'cmd_abc');
    assert.equal(cmd.domain, 'eventualidades');
    assert.equal(cmd.op, 'add');
    assert.equal(cmd.entityId, 'pat_1:eventualidades');
    assert.equal(cmd.clientCreatedAt, 1718293049000);
    assert.equal(cmd.baseSeq, 7);
  });

  it('normalizes accepted duplicate and stale-base responses', () => {
    assert.deepEqual(
      normalizeCommandPushResponse({ ok: true, status: 200, body: { ok: true, status: 'accepted' } }),
      { ok: true, removeOutbox: true, staleBase: false, duplicate: false, status: 'accepted' }
    );
    assert.deepEqual(
      normalizeCommandPushResponse({ ok: true, status: 200, body: { ok: true, status: 'duplicate_ignored' } }),
      { ok: true, removeOutbox: true, staleBase: false, duplicate: true, status: 'duplicate_ignored' }
    );
    assert.deepEqual(
      normalizeCommandPushResponse({ ok: false, status: 409, body: { code: 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT' } }),
      { ok: false, removeOutbox: false, staleBase: true, duplicate: false, status: 'stale_base_seq_requires_snapshot' }
    );
  });

  it('removes command outbox entries only after accepted or duplicate ack', () => {
    assert.equal(shouldRemoveCommandOutboxEntry({ ok: true, status: 'accepted' }), true);
    assert.equal(shouldRemoveCommandOutboxEntry({ ok: true, status: 'duplicate_ignored' }), true);
    assert.equal(shouldRemoveCommandOutboxEntry({ ok: false, code: 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT' }), false);
  });
});
