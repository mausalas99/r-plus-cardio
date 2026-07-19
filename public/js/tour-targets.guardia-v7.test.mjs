import test from 'node:test';
import assert from 'node:assert/strict';
import { getTourTarget, getGuardiaV7TourSteps } from './tour-targets.mjs';

test('every gv7 step has a target', () => {
  for (const id of getGuardiaV7TourSteps()) {
    const t = getTourTarget(id, 'guardia-v7');
    assert.ok(t.selector, `missing selector for ${id}`);
  }
});
