import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clinicalTufteLineChartOptions,
  clinicalTufteLineElements,
  clinicalTufteLineScales,
} from './chart-clinical-tufte.mjs';

test('clinicalTufteLineChartOptions disables animation and uses straight lines', () => {
  const opts = clinicalTufteLineChartOptions();
  assert.equal(opts.animation, false);
  assert.equal(opts.elements.line.tension, 0);
  assert.equal(opts.scales.y.border.display, false);
  assert.equal(opts.scales.x.grid.display, false);
});

test('clinicalTufteLineScales hides chart frame borders', () => {
  const scales = clinicalTufteLineScales();
  assert.equal(scales.x.border.display, false);
  assert.equal(scales.y.border.display, false);
});

test('clinicalTufteLineElements uses token-sized stroke and points', () => {
  const el = clinicalTufteLineElements();
  assert.ok(el.line.borderWidth >= 1);
  assert.ok(el.point.radius >= 1);
});
