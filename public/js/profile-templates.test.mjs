import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLANK_NOTA_EVOLUCION,
  looksLikeLegacyIdentifiableTemplate,
  ensureProfileTemplateDefaults,
  resetProfileTemplatesToBlank,
  applyNotaFormatScaffoldIfEmpty,
} from './profile-templates.mjs';

test('plantillas en blanco no contienen fármacos de ejemplo', () => {
  assert.equal(looksLikeLegacyIdentifiableTemplate(BLANK_NOTA_EVOLUCION), false);
  assert.equal(looksLikeLegacyIdentifiableTemplate('PARACETAMOL 1G'), true);
});

test('ensureProfileTemplateDefaults solo rellena vacíos', () => {
  var st = { defaultDieta: 'Mi dieta personal' };
  ensureProfileTemplateDefaults(st);
  assert.equal(st.defaultDieta, 'Mi dieta personal');
  assert.ok(st.defaultNotaEvolucion);
});

test('applyNotaFormatScaffoldIfEmpty', () => {
  var note = {};
  applyNotaFormatScaffoldIfEmpty(note, { defaultNotaEvolucion: 'N: test' });
  assert.equal(note.evolucion, 'N: test');
});

test('resetProfileTemplatesToBlank', () => {
  var st = { defaultDieta: 'x', defaultNotaEvolucion: 'y' };
  resetProfileTemplatesToBlank(st);
  assert.equal(st.defaultDieta, '');
  assert.equal(st.defaultNotaEvolucion, BLANK_NOTA_EVOLUCION);
});
