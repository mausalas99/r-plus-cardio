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

test('cardionotasProductName is R+ Cardio', async () => {
  const { cardionotasProductName } = await import('./cardionotas-gates.mjs');
  assert.equal(cardionotasProductName(), 'R+ Cardio');
});

test('isCardionotasInterconsultaEnabled is false in Cardionotas MVP', () => {
  assert.equal(isCardionotasInterconsultaEnabled(), false);
});

test('filterSalidaSectionsForCardionotas removes listado, vpo and recetaHu', () => {
  assert.deepEqual(
    filterSalidaSectionsForCardionotas(['icHoja', 'listado', 'vpo', 'recetaHu']),
    ['icHoja'],
  );
});

test('filterSalidaSectionsForCardionotas handles empty and null', () => {
  assert.deepEqual(filterSalidaSectionsForCardionotas([]), []);
  assert.deepEqual(filterSalidaSectionsForCardionotas(null), []);
  assert.deepEqual(filterSalidaSectionsForCardionotas(undefined), []);
});

test('filterSalidaSectionsForCardionotas drops listado-only', () => {
  assert.deepEqual(filterSalidaSectionsForCardionotas(['listado']), []);
});

test('filterSalidaSectionsForCardionotas keeps icHoja', () => {
  assert.deepEqual(
    filterSalidaSectionsForCardionotas(['icHoja', 'listado']),
    ['icHoja'],
  );
});
