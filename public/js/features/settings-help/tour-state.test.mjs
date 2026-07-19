import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('tour-state', () => {
  it('exports guided-tour-running class for clinical onboarding CSS gate', async () => {
    const { GUIDED_TOUR_RUNNING_CLASS } = await import('./tour-state.mjs');
    assert.equal(GUIDED_TOUR_RUNNING_CLASS, 'guided-tour-running');
  });
});
