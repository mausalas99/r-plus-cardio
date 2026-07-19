import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reflowLabsForCensoDisplay,
  classifyCensoTableLine,
  splitCensoLabPanelsLine,
} from './censo-table-style.mjs';

test('reflowLabsForCensoDisplay separa fecha y paneles', () => {
  var out = reflowLabsForCensoDisplay([
    '04/06/2026 BH · Hb 5.8*  Hto 18* QS · Glu 145  Cr 1.2',
  ]);
  assert.equal(out[0], '04/06/2026');
  assert.ok(out.some((l) => /^BH ·/.test(l)));
  assert.ok(out.some((l) => /^QS ·/.test(l)));
});

test('splitCensoLabPanelsLine normaliza dos puntos a punto medio', () => {
  assert.deepEqual(splitCensoLabPanelsLine('BH: Hb 5.8'), ['BH · Hb 5.8']);
});

test('classifyCensoTableLine paciente y labs', () => {
  assert.equal(classifyCensoTableLine('JUAN PEREZ', 'paciente', 0), 'emphasis');
  assert.equal(classifyCensoTableLine('123', 'paciente', 1), 'muted');
  assert.equal(classifyCensoTableLine('04/06/2026', 'labs'), 'lab-date');
  assert.equal(classifyCensoTableLine('BH · Hb 5.8', 'labs'), 'lab-panel');
});
