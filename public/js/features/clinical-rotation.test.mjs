import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIncomingPreviewWindow,
  isChartLockedForPatient,
  syncRotationConfigButton,
} from './clinical-rotation.mjs';
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';

describe('clinical-rotation preview window', () => {
  const cycle = {
    preview_start_at: '2026-05-30T00:00:00.000Z',
    effective_at: '2026-06-01T00:00:00.000Z',
  };

  it('preview window is active between preview_start and effective', () => {
    assert.equal(isIncomingPreviewWindow(cycle, new Date('2026-05-31T12:00:00Z')), true);
    assert.equal(
      isChartLockedForPatient({ effective_at: cycle.effective_at }, new Date('2026-05-31T12:00:00Z')),
      true
    );
  });

  it('returns false before preview_start_at', () => {
    assert.equal(isIncomingPreviewWindow(cycle, new Date('2026-05-29T23:59:59Z')), false);
  });

  it('returns false at or after effective_at', () => {
    assert.equal(isIncomingPreviewWindow(cycle, new Date('2026-06-01T00:00:00Z')), false);
    assert.equal(isIncomingPreviewWindow(cycle, new Date('2026-06-02T00:00:00Z')), false);
  });

  it('returns false when cycle is missing dates', () => {
    assert.equal(isIncomingPreviewWindow(null, new Date()), false);
    assert.equal(isIncomingPreviewWindow({}, new Date()), false);
  });

  it('syncRotationConfigButton hides control for non-R4 users', () => {
    if (typeof document === 'undefined') return;
    document.body.innerHTML =
      '<button type="button" id="btn-rotation-config-open"></button>';
    const prev = clinicalSessionContext.user;
    clinicalSessionContext.user = { rank: 'R2' };
    syncRotationConfigButton();
    assert.equal(document.getElementById('btn-rotation-config-open').hidden, true);
    clinicalSessionContext.user = { rank: 'R4' };
    syncRotationConfigButton();
    assert.equal(document.getElementById('btn-rotation-config-open').hidden, false);
    clinicalSessionContext.user = prev;
  });

  it('unlock chart when now is at or past assignment effective_at', () => {
    assert.equal(
      isChartLockedForPatient({ effective_at: '2026-06-01T00:00:00.000Z' }, new Date('2026-06-01T00:00:00Z')),
      false
    );
    assert.equal(
      isChartLockedForPatient({ effective_at: '2026-06-01T00:00:00.000Z' }, new Date('2026-06-02T00:00:00Z')),
      false
    );
  });
});
