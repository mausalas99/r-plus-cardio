import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRICULUM_VERSION,
  GUARDIA_V7_CHAPTERS,
  getGuardiaV7TourSteps,
  getFirstStepIdForChapter,
  isValidStepForBranch,
  getChapterForStep,
  getTourStepsForChapter,
} from './onboarding-curriculum.mjs';

test('CURRICULUM_VERSION is 12', () => {
  assert.equal(CURRICULUM_VERSION, 12);
});

test('cardio short track has 5 chapters', () => {
  assert.equal(GUARDIA_V7_CHAPTERS.length, 5);
  assert.ok(getGuardiaV7TourSteps().length >= 5);
  assert.ok(GUARDIA_V7_CHAPTERS.every((ch) => String(ch.id).startsWith('ch-cardio-')));
});

test('getFirstStepIdForChapter cardio branch', () => {
  assert.equal(getFirstStepIdForChapter('ch-cardio-labs', 'guardia-v7'), 'sala_tend');
  assert.equal(getFirstStepIdForChapter('ch-cardio-hoja', 'guardia-v7'), 'sala_ic_hoja');
});

test('isValidStepForBranch accepts cardio steps on guardia-v7', () => {
  assert.equal(isValidStepForBranch('sala_manejo', 'guardia-v7', 'base'), true);
  assert.equal(isValidStepForBranch('sala_ic_hoja', 'guardia-v7', 'base'), true);
  assert.equal(isValidStepForBranch('gv7_guardia_chip', 'guardia-v7', 'base'), false);
});

test('getChapterForStep maps cardio short modules', () => {
  assert.equal(getChapterForStep('cardio_descongestion', 'guardia-v7').id, 'ch-cardio-descongestion');
  assert.equal(getChapterForStep('sala_manejo', 'guardia-v7').id, 'ch-cardio-manejo');
});

test('labs chapter precedes descongestion in short-track order', () => {
  const steps = getGuardiaV7TourSteps();
  assert.ok(steps.indexOf('sala_tend') < steps.indexOf('cardio_descongestion'));
  assert.ok(steps.indexOf('cardio_descongestion') < steps.indexOf('sala_manejo'));
  assert.ok(steps.indexOf('sala_manejo') < steps.indexOf('sala_ic_hoja'));
});

test('getTourStepsForChapter returns scoped step list', () => {
  const steps = getTourStepsForChapter('ch-cardio-labs', 'guardia-v7');
  assert.equal(steps.length, 2);
  assert.equal(steps[0], 'sala_tend');
  assert.equal(steps[steps.length - 1], 'sala_tend_chart');
});
