import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTourTarget,
  getSalaTourSteps,
  getInterconsultaTourSteps,
  stepRequiresUserAction,
} from './tour-targets.mjs';

test('getSalaTourSteps Cardio: labs, clínico con descongestión, manejo, hoja IC', () => {
  const steps = getSalaTourSteps();
  assert.equal(steps.length, 19);
  assert.ok(!steps.includes('lab_bulk_separator'));
  assert.ok(steps.includes('sala_manejo'));
  assert.ok(steps.includes('cardio_descongestion'));
  assert.ok(steps.includes('sala_ic_hoja'));
  assert.ok(!steps.includes('servicio_default'));
  assert.ok(!steps.includes('listado_problemas'));
  assert.ok(!steps.includes('sala_vpo'));
  assert.ok(!steps.includes('sala_receta_hu'));
  assert.ok(!steps.includes('livesync_desktop'));
  assert.equal(steps.indexOf('estado_actual'), steps.indexOf('historia_clinica') + 1);
  assert.equal(steps.indexOf('cardio_descongestion'), steps.indexOf('estado_actual') + 1);
  assert.ok(steps.includes('sala_agenda'));
  assert.equal(steps[steps.length - 1], 'wrap');
});

test('getInterconsultaTourSteps is empty in Cardio', () => {
  assert.deepEqual(getInterconsultaTourSteps(), []);
});

test('getTourTarget devuelve selector para lab_parse en Laboratorio', () => {
  const t = getTourTarget('lab_parse', 'sala');
  assert.equal(t.appTab, 'lab');
  assert.match(t.selector, /procesar|btn-procesar|lab-input/i);
  assert.equal(stepRequiresUserAction('lab_parse'), true);
});

test('getTourTarget para estado_actual apunta al segmento Estado actual (Sala)', () => {
  const t = getTourTarget('estado_actual', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'estadoActual');
  assert.match(t.selector, /ea-snapshot|ea-charts-summary/);
  assert.equal(t.spotlightClass, 'tour-spotlight-action');
});

test('getTourTarget cardio_demo_intro apunta al censo / EA', () => {
  const t = getTourTarget('cardio_demo_intro', 'quick-route');
  assert.equal(t.appTab, 'nota');
  assert.match(t.selector, /patient-list|ea-snapshot/);
});

test('getTourTarget cardio_descongestion apunta a paneles IC en Estado actual', () => {
  const t = getTourTarget('cardio_descongestion', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'estadoActual');
  assert.match(t.selector, /descongestion|congestion/);
});

test('getTourTarget sala_manejo apunta a pestaña principal Manejo', () => {
  const t = getTourTarget('sala_manejo', 'sala');
  assert.equal(t.appTab, 'med');
  assert.match(t.selector, /med-pane-cardio-manejo|manejo-panel/);
});

test('getTourTarget sala_ic_hoja apunta a Generar hoja IC', () => {
  const t = getTourTarget('sala_ic_hoja', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'icHoja');
  assert.match(t.selector, /ic-hoja|btn-gen-ic-hoja/);
});

test('getTourTarget para estado_actual_review combina snapshot, gráficas e historial', () => {
  const review = getTourTarget('estado_actual_review', 'sala');
  assert.match(review.selector, /ea-snapshot/);
  assert.match(review.selector, /ea-charts-summary/);
  assert.match(review.selector, /ea-historial/);
});

test('getTourTarget para historia_clinica y eventualidades en Clínico (Sala)', () => {
  const hc = getTourTarget('historia_clinica', 'sala');
  assert.equal(hc.innerTab, 'historia');
  assert.match(hc.selector, /exp-segment-historia/);
  const ev = getTourTarget('eventualidades', 'sala');
  assert.equal(ev.innerTab, 'eventualidades');
  assert.match(ev.selector, /exp-segment-eventualidades/);
});

test('getTourTarget para sala_agenda', () => {
  const ag = getTourTarget('sala_agenda', 'sala');
  assert.equal(ag.appTab, 'agenda');
  assert.match(ag.selector, /agenda/);
});

test('getTourTarget para sala_tend_chart resalta botón Gráfica', () => {
  const t = getTourTarget('sala_tend_chart', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'tend');
  assert.match(t.selector, /tend-section-chart-btn/);
  assert.equal(t.spotlightClass, 'tour-spotlight-action');
});

test('stepRequiresUserAction es false para pasos puramente narrativos', () => {
  assert.equal(stepRequiresUserAction('map_sidebar'), false);
  assert.equal(stepRequiresUserAction('map_tabs'), false);
  assert.equal(stepRequiresUserAction('map_lab_teaser'), false);
  assert.equal(stepRequiresUserAction('wrap'), false);
  assert.equal(stepRequiresUserAction('sala_manejo'), false);
  assert.equal(stepRequiresUserAction('sala_ic_hoja'), false);
});

test('getTourTarget for sala_expediente_tabs apunta a barra de pestañas', () => {
  const t = getTourTarget('sala_expediente_tabs', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.selector, '.inner-tab-bar');
});
