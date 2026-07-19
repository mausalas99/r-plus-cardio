import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeLastActivityIso,
  clinicalUserActivityTier,
  formatClinicalUserLastActivity,
} from './clinical-user-activity.mjs';

describe('clinical-user-activity', () => {
  const now = new Date('2026-06-10T18:00:00.000Z').getTime();

  it('mergeLastActivityIso keeps the newest ISO timestamp', () => {
    assert.equal(
      mergeLastActivityIso('2026-06-09T10:00:00.000Z', '2026-06-10T08:00:00.000Z'),
      '2026-06-10T08:00:00.000Z'
    );
    assert.equal(mergeLastActivityIso('', '2026-06-10T08:00:00.000Z'), '2026-06-10T08:00:00.000Z');
  });

  it('clinicalUserActivityTier classifies active, recent, and stale', () => {
    assert.equal(
      clinicalUserActivityTier('2026-06-10T17:30:00.000Z', now),
      'active'
    );
    assert.equal(
      clinicalUserActivityTier('2026-06-08T18:00:00.000Z', now),
      'recent'
    );
    assert.equal(
      clinicalUserActivityTier('2026-05-01T18:00:00.000Z', now),
      'stale'
    );
    assert.equal(clinicalUserActivityTier(null, now), 'unknown');
  });

  it('formatClinicalUserLastActivity returns Spanish relative labels', () => {
    assert.equal(formatClinicalUserLastActivity('2026-06-10T17:59:00.000Z', now), 'Activo hace 1 min');
    assert.equal(formatClinicalUserLastActivity('2026-06-09T18:00:00.000Z', now), 'Activo ayer');
    assert.equal(formatClinicalUserLastActivity(null, now), 'Sin actividad registrada');
  });
});
