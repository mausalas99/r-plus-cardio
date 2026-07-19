import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_MODES, ALL_MOTION_CLASSES, normalizeMotionMode, motionClassFor } from './motion-mode.mjs';

test('MOTION_MODES lists the three presets', () => {
  assert.deepEqual(MOTION_MODES, ['sobrio', 'mixto', 'expresivo']);
});

test('normalizeMotionMode passes valid modes through', () => {
  assert.equal(normalizeMotionMode('sobrio'), 'sobrio');
  assert.equal(normalizeMotionMode('mixto'), 'mixto');
  assert.equal(normalizeMotionMode('expresivo'), 'expresivo');
});

test('normalizeMotionMode defaults everything else to mixto', () => {
  assert.equal(normalizeMotionMode(null), 'mixto');
  assert.equal(normalizeMotionMode(undefined), 'mixto');
  assert.equal(normalizeMotionMode(''), 'mixto');
  assert.equal(normalizeMotionMode('full'), 'mixto');
  assert.equal(normalizeMotionMode(42), 'mixto');
});

test('motionClassFor maps mixto to null and others to html classes', () => {
  assert.equal(motionClassFor('mixto'), null);
  assert.equal(motionClassFor('sobrio'), 'motion-sobrio');
  assert.equal(motionClassFor('expresivo'), 'motion-expresivo');
  assert.equal(motionClassFor('garbage'), null);
});

test('ALL_MOTION_CLASSES covers every non-default class', () => {
  assert.deepEqual(ALL_MOTION_CLASSES, ['motion-sobrio', 'motion-expresivo']);
});
