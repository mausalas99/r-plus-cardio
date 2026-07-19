import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isVitalAltered,
  buildAlteredAtDefaults,
  isGluAltered,
  isGlucometriaMarkedAltered,
  isBpHypotensive,
  isHemodynamicallyUnstable,
  isTempFebrile,
  isTempFeverPeak,
  TEMP_FEVER_PICO_MIN,
} from './estado-actual-ranges.mjs';

test('isVitalAltered flags out-of-range FR', () => {
  assert.equal(isVitalAltered('fr', 28), true);
  assert.equal(isVitalAltered('fr', 16), false);
});

test('isVitalAltered ignores empty values', () => {
  assert.equal(isVitalAltered('tas', ''), false);
  assert.equal(isVitalAltered('fc', null), false);
  assert.equal(isVitalAltered('sat', '   '), false);
});

test('isVitalAltered evaluates TA components separately', () => {
  assert.equal(isVitalAltered('tas', 88), true);
  assert.equal(isVitalAltered('tad', 52), true);
});

test('buildAlteredAtDefaults only includes altered keys', () => {
  const altered = buildAlteredAtDefaults({ fr: 28, fc: 80 }, '11:40');
  assert.equal(altered.fr, '11:40');
  assert.equal(altered.fc, undefined);
});

test('buildAlteredAtDefaults omits turn-close 00:00 placeholder', () => {
  const altered = buildAlteredAtDefaults({ temp: 38.2 }, '00:00');
  assert.deepEqual(altered, {});
});

test('isGluAltered flags hypo and hyper', () => {
  assert.equal(isGluAltered(65), true);
  assert.equal(isGluAltered(200), true);
  assert.equal(isGluAltered(110), false);
});

test('isGlucometriaMarkedAltered respects manual flag', () => {
  assert.equal(isGlucometriaMarkedAltered({ value: 110, altered: true }), true);
  assert.equal(isGlucometriaMarkedAltered({ value: 110 }), false);
});

test('isBpHypotensive flags low TA components only', () => {
  assert.equal(isBpHypotensive(88, 70), true);
  assert.equal(isBpHypotensive(120, 52), true);
  assert.equal(isBpHypotensive(150, 95), false);
});

test('isHemodynamicallyUnstable uses hypotension, FC altered, or vasopressors', () => {
  assert.equal(isHemodynamicallyUnstable({ tas: 85, tad: 60, fc: 80 }, ''), true);
  assert.equal(isHemodynamicallyUnstable({ tas: 120, tad: 70, fc: 118 }, ''), true);
  assert.equal(isHemodynamicallyUnstable({ tas: 120, tad: 70, fc: 80 }, 'NOREPINEFRINA'), true);
  assert.equal(isHemodynamicallyUnstable({ tas: 150, tad: 90, fc: 80 }, ''), false);
});

test('isTempFebrile flags fever above upper range', () => {
  assert.equal(isTempFebrile(38), true);
  assert.equal(isTempFebrile(37.2), false);
});

test('isTempFeverPeak — PICO solo ≥ 38 °C', () => {
  assert.equal(isTempFeverPeak(38), true);
  assert.equal(isTempFeverPeak(38.2), true);
  assert.equal(isTempFeverPeak(37.9), false);
  assert.equal(isTempFeverPeak(37.2), false);
  assert.equal(TEMP_FEVER_PICO_MIN, 38);
});
