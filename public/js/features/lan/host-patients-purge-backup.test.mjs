import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPurgeGhostsBackupPayload } from './host-patients-purge-backup.mjs';

describe('buildPurgeGhostsBackupPayload', () => {
  it('uses standard r-plus-backup format and merges host-only bundle entries', () => {
    const localBackup = {
      format: 'r-plus-backup',
      version: 1,
      data: { patients: [{ id: 'l1', nombre: 'Local' }] },
    };
    const hostSnap = {
      ok: true,
      patients: [{ id: 'h1', nombre: 'Host only' }],
      clinicalOps: { teams: [] },
    };
    const bundles = { room1: [{ patient: { id: 'h1', nombre: 'Host only', registro: 'R9' }, note: { x: 1 } }] };
    const payload = buildPurgeGhostsBackupPayload(localBackup, hostSnap, bundles);
    assert.equal(payload.format, 'r-plus-backup');
    assert.equal(payload.version, 1);
    assert.equal(payload.data.patients.length, 2);
    assert.deepEqual(payload.purgeGhostsHost.bundleEntriesByRoom, bundles);
  });

  it('omits purgeGhostsHost when snapshot failed', () => {
    const payload = buildPurgeGhostsBackupPayload(
      { format: 'r-plus-backup', version: 1, data: { patients: [] } },
      { ok: false },
      {}
    );
    assert.equal(payload.purgeGhostsHost, undefined);
  });
});
