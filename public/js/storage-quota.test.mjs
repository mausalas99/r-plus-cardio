import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateJsonBytes,
  estimateRpcPersistBytes,
  assessStoragePressure,
  STORAGE_WARN_RATIO,
  STORAGE_BLOCK_RATIO,
  FALLBACK_LOCAL_STORAGE_QUOTA,
} from './storage-quota.mjs';

describe('storage-quota', () => {
  it('estimateJsonBytes returns positive size for object', () => {
    assert.ok(estimateJsonBytes({ a: 1, b: 'x' }) > 0);
  });

  it('assessStoragePressure blocks near quota', () => {
    var quota = FALLBACK_LOCAL_STORAGE_QUOTA;
    var level = assessStoragePressure(quota * STORAGE_BLOCK_RATIO, { usage: 0, quota });
    assert.strictEqual(level, 'block');
  });

  it('assessStoragePressure warns before block', () => {
    var quota = FALLBACK_LOCAL_STORAGE_QUOTA;
    var level = assessStoragePressure(quota * STORAGE_WARN_RATIO, { usage: 0, quota });
    assert.strictEqual(level, 'warn');
  });

  it('estimateRpcPersistBytes sums payload parts', () => {
    var n = estimateRpcPersistBytes({
      patients: [{ id: 'p1' }],
      notes: { p1: { estudios: 'x' } },
      indicaciones: {},
      labHistory: { p1: [{ id: 's1', resLabs: ['a'] }] },
      medRecetaByPatient: {},
    });
    assert.ok(n > estimateJsonBytes([{ id: 'p1' }]));
  });
});
