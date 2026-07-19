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

test('CURRICULUM_VERSION is 10', () => {
  assert.equal(CURRICULUM_VERSION, 10);
});

test('guardia-v7 has 5 chapters and 19 steps', () => {
  assert.equal(GUARDIA_V7_CHAPTERS.length, 5);
  assert.equal(getGuardiaV7TourSteps().length, 19);
});

test('getFirstStepIdForChapter guardia-v7 branch', () => {
  assert.equal(getFirstStepIdForChapter('ch-guardia-modo', 'guardia-v7'), 'gv7_guardia_chip');
});

test('isValidStepForBranch accepts gv7 steps on guardia-v7', () => {
  assert.equal(isValidStepForBranch('gv7_guardia_chip', 'guardia-v7', 'base'), true);
  assert.equal(isValidStepForBranch('gv7_guardia_chip', 'sala', 'base'), false);
});

test('getChapterForStep maps gv7 steps to guardia chapters', () => {
  assert.equal(getChapterForStep('gv7_entrega_phase', 'guardia-v7').id, 'ch-guardia-entrega');
  assert.equal(getChapterForStep('gv7_censo_r1', 'guardia-v7').id, 'ch-guardia-censo');
});

test('censo steps precede entrega in guardia-v7 linear order', () => {
  const steps = getGuardiaV7TourSteps();
  assert.ok(steps.indexOf('gv7_guardia_exit') < steps.indexOf('gv7_censo_r1'));
  assert.ok(steps.indexOf('gv7_censo_sync') < steps.indexOf('gv7_entrega_phase'));
});

test('getTourStepsForChapter returns scoped step list', () => {
  const steps = getTourStepsForChapter('ch-guardia-modo', 'guardia-v7');
  assert.equal(steps.length, 5);
  assert.equal(steps[0], 'gv7_guardia_chip');
  assert.equal(steps[steps.length - 1], 'gv7_guardia_exit');
});
