import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTourTarget,
  getSalaTourSteps,
  getInterconsultaTourSteps,
  stepRequiresUserAction,
} from './tour-targets.mjs';

test('getSalaTourSteps orden overhaul: lab primero, clinico HC EA Eventualidades, salida VPO receta agenda', () => {
  const steps = getSalaTourSteps();
  assert.equal(steps.length, 22);
  assert.ok(!steps.includes('lab_bulk_separator'));
  assert.ok(!steps.includes('sala_manejo'));
  assert.equal(steps.indexOf('servicio_default'), steps.indexOf('lab_view') + 1);
  assert.equal(steps.indexOf('estado_actual'), steps.indexOf('historia_clinica') + 1);
  assert.equal(steps.indexOf('estado_actual_registro'), steps.indexOf('estado_actual') + 1);
  assert.equal(steps.indexOf('estado_actual_review'), steps.indexOf('estado_actual_registro') + 1);
  assert.equal(steps.indexOf('eventualidades'), steps.indexOf('estado_actual_review') + 1);
  assert.ok(!steps.includes('sala_casiopea_lab'));
  assert.ok(!steps.includes('sala_casiopea_trends'));
  assert.ok(steps.includes('listado_problemas'));
  assert.ok(steps.includes('sala_vpo'));
  assert.ok(steps.includes('sala_receta_hu'));
  assert.ok(steps.includes('sala_agenda'));
  assert.equal(steps[steps.length - 1], 'wrap');
});

test('getInterconsultaTourSteps no incluye pasos de Modo Pase', () => {
  const steps = getInterconsultaTourSteps();
  assert.ok(!steps.includes('pase_enter'));
  assert.ok(!steps.includes('pase_board'));
  assert.equal(steps[1], 'map_tabs');
  assert.ok(steps.includes('sala_tend_chart'));
});

test('getInterconsultaTourSteps mantiene pasos clásicos sin Estado Actual ni Listado', () => {
  const steps = getInterconsultaTourSteps();
  assert.ok(steps.includes('map_sidebar'));
  assert.ok(!steps.includes('map'));
  assert.ok(!steps.includes('estado_actual'));
  assert.ok(!steps.includes('listado_problemas'));
  assert.ok(steps.includes('ic_nota'));
  assert.ok(steps.includes('ic_indica'));
  assert.ok(steps.includes('livesync_desktop'));
  assert.ok(steps.includes('livesync_mobile'));
  assert.equal(steps[steps.length - 1], 'wrap');
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

test('getTourTarget para estado_actual_review combina snapshot, gráficas e historial', () => {
  const review = getTourTarget('estado_actual_review', 'sala');
  assert.match(review.selector, /ea-snapshot/);
  assert.match(review.selector, /ea-charts-summary/);
  assert.match(review.selector, /ea-historial/);
});

test('gv7 action steps require user interaction', () => {
  assert.equal(stepRequiresUserAction('gv7_guardia_toggle'), true);
  assert.equal(stepRequiresUserAction('gv7_lan_wifi'), true);
  assert.equal(stepRequiresUserAction('gv7_mobile_link'), true);
  assert.equal(stepRequiresUserAction('livesync_desktop'), true);
});

test('getTourTarget para historia_clinica y eventualidades en Clínico (Sala)', () => {
  const hc = getTourTarget('historia_clinica', 'sala');
  assert.equal(hc.innerTab, 'historia');
  assert.match(hc.selector, /exp-segment-historia/);
  const ev = getTourTarget('eventualidades', 'sala');
  assert.equal(ev.innerTab, 'eventualidades');
  assert.match(ev.selector, /exp-segment-eventualidades/);
});

test('getTourTarget para sala_vpo, sala_receta_hu y sala_agenda', () => {
  const vpo = getTourTarget('sala_vpo', 'sala');
  assert.equal(vpo.innerTab, 'vpo');
  assert.match(vpo.selector, /vpo/);
  const rec = getTourTarget('sala_receta_hu', 'sala');
  assert.equal(rec.innerTab, 'recetaHu');
  const ag = getTourTarget('sala_agenda', 'sala');
  assert.equal(ag.appTab, 'agenda');
  assert.match(ag.selector, /agenda/);
});

test('getTourTarget para listado_problemas abre listado y resalta Generar', () => {
  const t = getTourTarget('listado_problemas', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'listado');
  assert.equal(t.selector, '#listado-form, #exp-segment-listado, #btn-gen-listado');
  assert.equal(t.spotlightClass, 'tour-spotlight-action');
  assert.equal(stepRequiresUserAction('listado_problemas'), false);
});

test('getTourTarget para servicio_default apunta a Mi Perfil', () => {
  const t = getTourTarget('servicio_default', 'sala');
  assert.match(t.selector, /servicio|profile-default-servicio|profile-modal/i);
});

test('getTourTarget para sala_tend_chart resalta botón Gráfica', () => {
  const t = getTourTarget('sala_tend_chart', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.innerTab, 'tend');
  assert.match(t.selector, /tend-section-chart-btn/);
  assert.equal(t.spotlightClass, 'tour-spotlight-action');
});

test('getTourTarget livesync_desktop resalta icono LiveSync', () => {
  const t = getTourTarget('livesync_desktop', 'sala');
  assert.match(t.selector || '', /team-sync/);
  assert.equal(t.openConnection, undefined);
});

test('stepRequiresUserAction es false para pasos puramente narrativos', () => {
  assert.equal(stepRequiresUserAction('map_sidebar'), false);
  assert.equal(stepRequiresUserAction('map_tabs'), false);
  assert.equal(stepRequiresUserAction('map_lab_teaser'), false);
  assert.equal(stepRequiresUserAction('wrap'), false);
  assert.equal(stepRequiresUserAction('livesync_desktop'), true);
  assert.equal(stepRequiresUserAction('livesync_mobile'), false);
});

test('getInterconsultaTourSteps orden curriculum: 17 pasos, lab antes de expediente', () => {
  const steps = getInterconsultaTourSteps();
  assert.equal(steps.length, 17);
  assert.equal(steps.indexOf('lab_parse'), 3);
  assert.ok(!steps.includes('sala_casiopea_lab'));
  assert.ok(!steps.includes('sala_casiopea_trends'));
  assert.ok(!steps.includes('sala_manejo'));
  assert.ok(steps.includes('ic_expediente_tabs'));
  assert.equal(steps.indexOf('ic_expediente_tabs'), steps.indexOf('lab_view') + 1);
  assert.equal(steps.indexOf('sala_tend'), steps.indexOf('ic_expediente_tabs') + 1);
});

test('getTourTarget for sala_expediente_tabs apunta a barra de pestañas', () => {
  const t = getTourTarget('sala_expediente_tabs', 'sala');
  assert.equal(t.appTab, 'nota');
  assert.equal(t.selector, '.inner-tab-bar');
});
