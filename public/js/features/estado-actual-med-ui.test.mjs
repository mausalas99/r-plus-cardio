import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMedFieldItems,
  serializeMedFieldItems,
  addMedFieldItem,
  removeMedFieldItem,
} from './estado-actual-med-ui.mjs';
import { emptyMonitoreo } from './estado-actual-data.mjs';

test('parseMedFieldItems splits pipe-separated meds', () => {
  assert.deepEqual(parseMedFieldItems('A | B | C'), ['A', 'B', 'C']);
  assert.deepEqual(parseMedFieldItems(''), []);
});

test('addMedFieldItem appends without duplicates', () => {
  const m = emptyMonitoreo();
  addMedFieldItem(m, 'abx', 'MEROPENEM 1 G IV C/8H');
  addMedFieldItem(m, 'abx', 'FLUCONAZOL 400MG VO C/24H');
  addMedFieldItem(m, 'abx', 'MEROPENEM 1 G IV C/8H');
  assert.equal(m.estadoClinico.abx, 'MEROPENEM 1 G IV C/8H | FLUCONAZOL 400MG VO C/24H');
  assert.equal(m.confirmado.abx, true);
});

test('removeMedFieldItem drops by index', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.nm = serializeMedFieldItems(['INSULINA GLARGINA 12UI SC C/24H', 'LEVOTIROXINA 50MCG VO C/24H']);
  removeMedFieldItem(m, 'nm', 0);
  assert.equal(m.estadoClinico.nm, 'LEVOTIROXINA 50MCG VO C/24H');
});
