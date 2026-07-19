import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeHostBundleEntriesIntoBackupData,
  normalizeFullBackupImportPayload,
} from './backup-host-merge.mjs';

describe('mergeHostBundleEntriesIntoBackupData', () => {
  it('adds host-only patients from bundle entries', () => {
    const data = { patients: [{ id: 'l1', nombre: 'Local', registro: 'R1' }], notes: { l1: { a: 1 } } };
    const merged = mergeHostBundleEntriesIntoBackupData(data, {
      room1: [{ patient: { id: 'h1', nombre: 'Ghost', registro: 'R9' }, note: { b: 2 }, labHistory: [] }],
    });
    assert.equal(merged.patients.length, 2);
    assert.deepEqual(merged.notes.h1, { b: 2 });
  });

  it('skips patients already present locally', () => {
    const data = { patients: [{ id: 'p1', nombre: 'Shared', registro: 'R1' }] };
    const merged = mergeHostBundleEntriesIntoBackupData(data, {
      room1: [{ patient: { id: 'p1', nombre: 'Shared', registro: 'R1' }, note: {} }],
    });
    assert.equal(merged.patients.length, 1);
  });
});

describe('normalizeFullBackupImportPayload', () => {
  it('passes through standard backups', () => {
    const payload = { format: 'r-plus-backup', version: 1, data: { patients: [] } };
    assert.equal(normalizeFullBackupImportPayload(payload), payload);
  });

  it('unwraps legacy purge-ghosts backups with host bundles', () => {
    const normalized = normalizeFullBackupImportPayload({
      format: 'r-plus-purge-ghosts-backup',
      version: 1,
      exportedAt: '2026-06-30T12:00:00.000Z',
      local: {
        format: 'r-plus-backup',
        version: 1,
        data: { patients: [] },
      },
      host: {
        bundleEntriesByRoom: {
          room1: [{ patient: { id: 'h1', nombre: 'Host', registro: 'R2' }, note: {} }],
        },
      },
    });
    assert.equal(normalized.format, 'r-plus-backup');
    assert.equal(normalized.data.patients.length, 1);
    assert.equal(normalized.exportedAt, '2026-06-30T12:00:00.000Z');
  });
});
