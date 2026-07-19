import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortPatientsForExportPicker } from './export-patients-selection.mjs';

test('sortPatientsForExportPicker orders by cuarto/cama then nombre', () => {
  var sorted = sortPatientsForExportPicker([
    { id: 'b', nombre: 'ZETA', cuarto: '2', cama: '1' },
    { id: 'a', nombre: 'ALFA', cuarto: '1', cama: '2' },
    { id: 'c', nombre: 'BETA', cuarto: '1', cama: '1' },
  ]);
  assert.deepEqual(
    sorted.map(function (p) {
      return p.id;
    }),
    ['c', 'a', 'b']
  );
});

test('sortPatientsForExportPicker does not mutate input', () => {
  var input = [{ id: '1', nombre: 'A', cuarto: '2' }];
  var copy = input.slice();
  sortPatientsForExportPicker(input);
  assert.deepEqual(input, copy);
});
