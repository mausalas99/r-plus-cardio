import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultHistoriaClinicaData, HC_INTERROGADO_NEGADO } from './defaults.mjs';

test('defaultHistoriaClinicaData seeds every ipas system negado', () => {
  const catalogs = { ipasSystems: { general: 'General', tegumentos: 'Tegumentos' } };
  const data = defaultHistoriaClinicaData('p1', catalogs, { labLookbackHours: 48 });
  assert.equal(data.ipas.general.negado, true);
  assert.equal(data.ipas.general.descripcion, HC_INTERROGADO_NEGADO);
  assert.deepEqual(data.genero, {});
  assert.equal(data.datosNegados, HC_INTERROGADO_NEGADO);
  assert.deepEqual(data.app.conditions, []);
});
