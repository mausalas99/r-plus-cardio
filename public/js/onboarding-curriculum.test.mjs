import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRICULUM_VERSION,
  getSalaTourSteps,
  getInterconsultaTourSteps,
  getGuardiaV7TourSteps,
  getQuickRouteTourSteps,
  getChapterForStep,
  getChapterProgressLabel,
  HUB_MODULES,
  migrateTourStepId,
  GUARDIA_V7_HUB_MODULES,
  QUICK_ROUTE_HUB_MODULE,
} from './onboarding-curriculum.mjs';

test('CURRICULUM_VERSION is 12 for R+ Cardio tracks', () => {
  assert.equal(CURRICULUM_VERSION, 12);
});

test('getSalaTourSteps covers labs → clínico → manejo → hoja IC', () => {
  const steps = getSalaTourSteps();
  assert.equal(steps.length, 19);
  assert.ok(steps.includes('sala_manejo'));
  assert.ok(steps.includes('cardio_descongestion'));
  assert.ok(steps.includes('sala_ic_hoja'));
  assert.ok(!steps.includes('sala_casiopea_lab'));
  assert.ok(!steps.includes('sala_vpo'));
  assert.ok(!steps.includes('sala_receta_hu'));
  assert.ok(!steps.includes('listado_problemas'));
  assert.ok(!steps.includes('livesync_desktop'));
  assert.ok(!steps.includes('servicio_default'));
  assert.equal(steps[0], 'map_sidebar');
  assert.equal(steps.indexOf('lab_view'), 4);
  assert.equal(steps.indexOf('sala_expediente_tabs'), 5);
  assert.equal(steps.indexOf('historia_clinica'), 6);
  assert.equal(steps.indexOf('estado_actual'), 7);
  assert.equal(steps.indexOf('cardio_descongestion'), 8);
  assert.ok(steps.indexOf('sala_manejo') < steps.indexOf('sala_ic_hoja'));
  assert.ok(steps.includes('sala_agenda'));
  assert.equal(steps[steps.length - 1], 'wrap');
});

test('getQuickRouteTourSteps is IC path without Pérez/García lab gate', () => {
  const steps = getQuickRouteTourSteps();
  assert.equal(steps.length, 5);
  assert.equal(steps[0], 'cardio_demo_intro');
  assert.equal(steps[1], 'cardio_descongestion');
  assert.ok(steps.includes('sala_manejo'));
  assert.ok(steps.includes('sala_ic_hoja'));
  assert.ok(!steps.includes('lab_parse'));
  assert.ok(!steps.includes('map_lab_teaser'));
  assert.equal(steps[steps.length - 1], 'quick_wrap');
  assert.match(QUICK_ROUTE_HUB_MODULE.label, /caso IC/i);
});

test('getChapterProgressLabel quick-route uses linear index', () => {
  const label = getChapterProgressLabel('cardio_descongestion', 'quick-route');
  assert.equal(label.stepInChapter, 2);
  assert.equal(label.chapterSteps, 5);
  assert.match(label.chapterTitle, /Ruta rápida/i);
});

test('migrateTourStepId maps legacy R+ steps to Cardio equivalents', () => {
  assert.equal(migrateTourStepId('estado_actual_charts', 'sala'), 'estado_actual_review');
  assert.equal(migrateTourStepId('sala_vpo', 'sala'), 'sala_ic_hoja');
  assert.equal(migrateTourStepId('livesync_desktop', 'sala'), 'wrap');
  assert.equal(migrateTourStepId('gv7_guardia_chip', 'guardia-v7'), 'map_lab_teaser');
  assert.equal(migrateTourStepId('lab_parse', 'quick-route'), 'cardio_demo_intro');
  assert.equal(migrateTourStepId('lab_view', 'sala'), 'lab_view');
});

test('estado_actual and hoja IC chapter mapping', () => {
  assert.equal(getChapterForStep('estado_actual', 'sala').id, 'ch-chart');
  assert.equal(getChapterForStep('sala_ic_hoja', 'sala').id, 'ch-salida');
  assert.equal(getChapterForStep('sala_manejo', 'sala').id, 'ch-manejo');
  assert.equal(getChapterForStep('sala_agenda', 'sala').id, 'ch-agenda');
});

test('cardio short modules replace guardia-v7 track', () => {
  assert.equal(GUARDIA_V7_HUB_MODULES.length, 5);
  assert.ok(GUARDIA_V7_HUB_MODULES.every((m) => String(m.chapterId).startsWith('ch-cardio-')));
  assert.equal(getChapterForStep('sala_manejo', 'guardia-v7').id, 'ch-cardio-manejo');
  const steps = getGuardiaV7TourSteps();
  assert.ok(steps.includes('sala_ic_hoja'));
  assert.ok(!steps.includes('gv7_censo_r1'));
});

test('getChapterProgressLabel for step in chapter 2', () => {
  const label = getChapterProgressLabel('historia_clinica', 'sala');
  assert.match(label.chapterTitle, /Clínico|Expediente/i);
  assert.ok(label.stepInChapter >= 1);
  assert.ok(label.chapterSteps >= 1);
});

test('HUB_MODULES includes Manejo and hoja IC without neo', () => {
  assert.ok(!HUB_MODULES.some((m) => m.id === 'neo-lab'));
  assert.ok(HUB_MODULES.some((m) => m.chapterId === 'ch-manejo'));
  assert.ok(HUB_MODULES.some((m) => m.chapterId === 'ch-salida'));
  assert.ok(HUB_MODULES.some((m) => m.chapterId === 'ch-agenda'));
});

test('getInterconsultaTourSteps is empty in Cardio', () => {
  assert.deepEqual(getInterconsultaTourSteps(), []);
});
