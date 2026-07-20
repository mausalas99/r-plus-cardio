import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCardionotasLanUiEnabled,
  isCardionotasInterconsultaEnabled,
  isCardionotasManejoAppTab,
  isCardionotasPendientesHidden,
  isCardionotasDriveImportHidden,
  isCardionotasEntregaHidden,
  cardionotasSalidaTabLabel,
  filterSalidaSectionsForCardionotas,
  filterExpedienteTabsForCardionotas,
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

test('isCardionotasManejoAppTab is true (Manejo IC in app tab)', () => {
  assert.equal(isCardionotasManejoAppTab(), true);
});

test('filterExpedienteTabsForCardionotas drops manejo and paciente', () => {
  assert.deepEqual(
    filterExpedienteTabsForCardionotas(['paciente', 'clinico', 'resultados', 'manejo', 'salida']),
    ['clinico', 'resultados', 'salida'],
  );
});

test('Cardionotas hides pendientes, Drive import and entrega', () => {
  assert.equal(isCardionotasPendientesHidden(), true);
  assert.equal(isCardionotasDriveImportHidden(), true);
  assert.equal(isCardionotasEntregaHidden(), true);
  assert.equal(cardionotasSalidaTabLabel(), 'Hoja IC');
});
