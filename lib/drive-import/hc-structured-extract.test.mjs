import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHcStructuredSuggestions,
  applyStructuredSuggestionsToHcPatch,
  enrichHcPatchWithStructuredSuggestions,
  isNegatedDriveText,
  matchCatalogConditions,
  parseMedicamentosList,
} from './hc-structured-extract.mjs';

test('isNegatedDriveText recognizes institutional negation', () => {
  assert.equal(isNegatedDriveText('INTERROGADO Y NEGADO'), true);
  assert.equal(isNegatedDriveText('NEGADO'), true);
  assert.equal(isNegatedDriveText('DIABETES MELLITUS TIPO 2'), false);
});

test('matchCatalogConditions finds diabetes and hypertension in APP text', () => {
  const text =
    'ENFERMEDADES CRÓNICO-DEGENERATIVAS: DIABETES MELLITUS TIPO 2, HIPERTENSIÓN ARTERIAL SISTÉMICA, ENFERMEDAD RENAL CRÓNICA';
  const hits = matchCatalogConditions(text, {
    diabetes: 'Diabetes mellitus',
    hipertension: 'Hipertensión arterial',
    enfermedadRenal: 'Enfermedad renal crónica',
  });
  assert.deepEqual(
    hits.map(function (h) {
      return h.id;
    }),
    ['diabetes', 'hipertension', 'enfermedadRenal']
  );
});

test('buildHcStructuredSuggestions for APP block with meds and negated allergies', () => {
  const text = [
    'ENFERMEDADES CRÓNICO-DEGENERATIVAS: DIABETES MELLITUS TIPO 2, HIPERTENSIÓN ARTERIAL',
    'MEDICAMENTOS: NIFEDIPINO 20 MG CADA 12 HORAS, DAPAGLIFLOZINA 10 MG CADA 12 HORAS',
    'ALERGIAS: INTERROGADO Y NEGADO',
    'INMUNIZACIONES: COVID-19 2024, INFLUENZA 2025',
  ].join('\n');
  const suggestions = buildHcStructuredSuggestions('app', text);
  assert.ok(
    suggestions.some(function (s) {
      return s.id === 'app_cond_diabetes' && s.target === 'app.conditions';
    })
  );
  assert.ok(
    suggestions.some(function (s) {
      return s.id === 'app_alergias_negado';
    })
  );
  assert.equal(
    suggestions.filter(function (s) {
      return s.target === 'app.medicamentosActuales';
    }).length,
    2
  );
});

test('applyStructuredSuggestionsToHcPatch merges accepted suggestions', () => {
  const suggestions = buildHcStructuredSuggestions(
    'app',
    'DIABETES MELLITUS\nMEDICAMENTOS: METFORMINA 850 MG VO CADA 12 H'
  );
  const patch = applyStructuredSuggestionsToHcPatch({}, suggestions);
  assert.ok(Array.isArray(patch.app.conditions));
  assert.ok(patch.app.conditions.indexOf('diabetes') >= 0);
  assert.equal(patch.app.medicamentosActuales.length, 1);
});

test('parseMedicamentosList splits comma-separated drugs', () => {
  const meds = parseMedicamentosList('NIFEDIPINO 20 MG, DAPAGLIFLOZINA 10 MG');
  assert.equal(meds.length, 2);
  assert.match(meds[0].medication, /NIFEDIPINO/);
});

test('buildHcStructuredSuggestions for APNP negated habits', () => {
  const text = 'TABAQUISMO: NEGADO\nETILISMO: INTERROGADO Y NEGADO';
  const suggestions = buildHcStructuredSuggestions('apnp', text);
  assert.ok(
    suggestions.some(function (s) {
      return s.id === 'apnp_tabaquismo_negado';
    })
  );
  assert.ok(
    suggestions.some(function (s) {
      return s.id === 'apnp_alcoholismo_negado';
    })
  );
});

test('enrichHcPatchWithStructuredSuggestions uses drive sections', () => {
  const patch = enrichHcPatchWithStructuredSuggestions(
    { app: { descripcionDetallada: 'x' } },
    {
      app: 'DIABETES MELLITUS TIPO 2',
      apnp: 'TABAQUISMO: NEGADO',
    }
  );
  assert.ok(patch.app.conditions.indexOf('diabetes') >= 0);
  assert.equal(patch.apnp.tabaquismoDetail.status, 'negado');
});

test('buildHcStructuredSuggestions parses AHF relative lines', () => {
  const text = 'MADRE: FINADA\nPADRE: DIABETES MELLITUS\nHERMANO: INTERROGADO Y NEGADO';
  const suggestions = buildHcStructuredSuggestions('ahf', text);
  assert.ok(
    suggestions.some(function (s) {
      return s.target === 'ahf.entries' && s.value && s.value.relativeId === 'madre';
    })
  );
  assert.ok(
    suggestions.some(function (s) {
      return (
        s.target === 'ahf.entries' &&
        s.value &&
        s.value.relativeId === 'padre' &&
        s.value.conditionId === 'diabetes'
      );
    })
  );
  assert.equal(
    suggestions.filter(function (s) {
      return s.target === 'ahf.entries';
    }).length,
    2
  );
});

test('stripIntegratedAppDescription removes negated and integrated subsections', () => {
  const text = [
    'CIRUGIAS: INTERROGADO Y NEGADO',
    'FRACTURAS: INTERROGADO Y NEGADO',
    'HOSPITALIZACIONES: HOSPITALIZACIÓN HACE 11 AÑOS POR MELENA',
    'OTRO ANTECEDENTE RELEVANTE',
  ].join('\n');
  const suggestions = buildHcStructuredSuggestions('app', text);
  const patch = applyStructuredSuggestionsToHcPatch(
    { app: { descripcionDetallada: text } },
    suggestions
  );
  assert.equal(patch.app.hospitalizaciones.length, 1);
  assert.match(patch.app.descripcionDetallada, /OTRO ANTECEDENTE/);
  assert.doesNotMatch(patch.app.descripcionDetallada, /CIRUGIAS/);
  assert.doesNotMatch(patch.app.descripcionDetallada, /FRACTURAS/);
  assert.doesNotMatch(patch.app.descripcionDetallada, /HOSPITALIZACIÓN HACE 11/);
});

test('applyStructuredSuggestionsToHcPatch strips integrated AHF lines', () => {
  const text = 'MADRE: FINADA\nPADRE: DIABETES MELLITUS\nNOTA LIBRE';
  const suggestions = buildHcStructuredSuggestions('ahf', text);
  const patch = applyStructuredSuggestionsToHcPatch(
    { ahf: { descripcionDetallada: text, entries: [], conditions: [] } },
    suggestions
  );
  assert.ok((patch.ahf.entries || []).length >= 2);
  assert.match(patch.ahf.descripcionDetallada || '', /NOTA LIBRE/);
  assert.doesNotMatch(patch.ahf.descripcionDetallada || '', /MADRE:/);
});
