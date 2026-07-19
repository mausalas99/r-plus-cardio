import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { patientLabHistoryNeedsRepair, repairLabHistoryMapInPlace } from './lab-history-repair.mjs';

describe('lab-history-repair', () => {
  it('detects missing ids', () => {
    assert.strictEqual(
      patientLabHistoryNeedsRepair([{ resLabs: ['Hb 10'], fecha: '01/01/2026' }]),
      true
    );
  });

  it('accepts valid sets without stringify', () => {
    assert.strictEqual(
      patientLabHistoryNeedsRepair([{ id: 's1', resLabs: ['Hb 10'], fecha: '01/01/2026' }]),
      false
    );
  });

  it('repairLabHistoryMapInPlace normalizes bad entries', () => {
    var map = { p1: [{ resLabs: ['Na 140'], fecha: '02/02/2026' }] };
    assert.strictEqual(repairLabHistoryMapInPlace(map), true);
    assert.strictEqual(map.p1[0].id, 'set-0');
  });
});
