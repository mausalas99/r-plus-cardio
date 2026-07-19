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
} from './onboarding-curriculum.mjs';

test('CURRICULUM_VERSION is 10 with guardia-v7 and quick-route tracks', () => {
  assert.equal(CURRICULUM_VERSION, 10);
});

test('getSalaTourSteps has 22 base steps without Neo or Manejo', () => {
  const steps = getSalaTourSteps();
  assert.equal(steps.length, 22);
  assert.ok(!steps.includes('sala_manejo'));
  assert.ok(!steps.includes('sala_casiopea_lab'));
  assert.ok(!steps.includes('sala_casiopea_trends'));
  assert.ok(!steps.includes('estado_actual_snapshot'));
  assert.ok(steps.includes('estado_actual_review'));
  assert.equal(steps[0], 'map_sidebar');
  assert.equal(steps.indexOf('lab_view'), 4);
  assert.equal(steps.indexOf('servicio_default'), 5);
  assert.equal(steps.indexOf('sala_expediente_tabs'), 6);
  assert.equal(steps.indexOf('historia_clinica'), 7);
  assert.equal(steps.indexOf('estado_actual'), 8);
  assert.equal(steps.indexOf('estado_actual_registro'), 9);
  assert.equal(steps.indexOf('estado_actual_review'), 10);
  assert.equal(steps.indexOf('eventualidades'), 11);
  assert.ok(steps.indexOf('estado_actual_review') < steps.indexOf('eventualidades'));
  assert.ok(steps.includes('listado_problemas'));
  assert.ok(steps.includes('sala_vpo'));
  assert.ok(steps.includes('sala_receta_hu'));
  assert.equal(steps.indexOf('listado_problemas'), steps.indexOf('sala_med') + 1);
  assert.ok(steps.includes('sala_agenda'));
  assert.equal(steps[steps.length - 1], 'wrap');
});

test('getQuickRouteTourSteps has 6 cross-track steps', () => {
  const steps = getQuickRouteTourSteps();
  assert.equal(steps.length, 6);
  assert.equal(steps[0], 'map_lab_teaser');
  assert.equal(steps[1], 'lab_parse');
  assert.equal(steps[2], 'gv7_guardia_chip');
  assert.equal(steps[steps.length - 1], 'quick_wrap');
});

test('getChapterProgressLabel quick-route uses linear index', () => {
  const label = getChapterProgressLabel('gv7_guardia_chip', 'quick-route');
  assert.equal(label.stepInChapter, 3);
  assert.equal(label.chapterSteps, 6);
  assert.match(label.chapterTitle, /Ruta rápida/i);
});

test('migrateTourStepId maps legacy estado_actual substeps', () => {
  assert.equal(migrateTourStepId('estado_actual_charts', 'sala'), 'estado_actual_review');
  assert.equal(migrateTourStepId('lab_view', 'sala'), 'lab_view');
});

test('getChapterForStep maps servicio_default to ch-patient-lab', () => {
  const ch = getChapterForStep('servicio_default', 'sala');
  assert.equal(ch.id, 'ch-patient-lab');
  assert.match(ch.title, /Paciente|laboratorio/i);
});

test('estado_actual is in ch-chart not ch-salida', () => {
  assert.equal(getChapterForStep('estado_actual', 'sala').id, 'ch-chart');
  assert.equal(getChapterForStep('sala_vpo', 'sala').id, 'ch-salida');
  assert.equal(getChapterForStep('sala_agenda', 'sala').id, 'ch-agenda');
});

test('guardia-v7 censo chapter precedes entrega', () => {
  assert.equal(getChapterForStep('gv7_censo_r1', 'guardia-v7').id, 'ch-guardia-censo');
  const steps = getGuardiaV7TourSteps();
  assert.ok(steps.indexOf('gv7_censo_sync') < steps.indexOf('gv7_entrega_phase'));
});

test('getChapterProgressLabel for step in chapter 2', () => {
  const label = getChapterProgressLabel('historia_clinica', 'sala');
  assert.match(label.chapterTitle, /Clínico|Expediente/i);
  assert.ok(label.stepInChapter >= 1);
  assert.ok(label.chapterSteps >= 1);
});

test('HUB_MODULES includes agenda module without neo companion cards', () => {
  assert.ok(!HUB_MODULES.some((m) => m.id === 'neo-lab'));
  assert.ok(!HUB_MODULES.some((m) => m.id === 'neo-trends'));
  assert.ok(HUB_MODULES.some((m) => m.chapterId === 'ch-agenda'));
});

test('getInterconsultaTourSteps still lab-first and no Neo', () => {
  const steps = getInterconsultaTourSteps();
  assert.equal(steps.indexOf('lab_parse'), steps.indexOf('map_lab_teaser') + 1);
  assert.ok(!steps.includes('sala_casiopea_lab'));
});
