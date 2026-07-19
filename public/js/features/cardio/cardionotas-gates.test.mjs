import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCardionotasLanUiEnabled,
  isCardionotasInterconsultaEnabled,
  filterSalidaSectionsForCardionotas,
} from './cardionotas-gates.mjs';

test('isCardionotasLanUiEnabled is false in Cardionotas MVP', () => {
  assert.equal(isCardionotasLanUiEnabled(), false);
});

test('isCardionotasInterconsultaEnabled is false in Cardionotas MVP', () => {
  assert.equal(isCardionotasInterconsultaEnabled(), false);
});

test('filterSalidaSectionsForCardionotas removes vpo and recetaHu', () => {
  assert.deepEqual(
    filterSalidaSectionsForCardionotas(['listado', 'vpo', 'recetaHu']),
    ['listado']
  );
});

test('filterSalidaSectionsForCardionotas handles empty and null', () => {
  assert.deepEqual(filterSalidaSectionsForCardionotas([]), []);
  assert.deepEqual(filterSalidaSectionsForCardionotas(null), []);
  assert.deepEqual(filterSalidaSectionsForCardionotas(undefined), []);
});

test('filterSalidaSectionsForCardionotas keeps listado-only', () => {
  assert.deepEqual(filterSalidaSectionsForCardionotas(['listado']), ['listado']);
});
