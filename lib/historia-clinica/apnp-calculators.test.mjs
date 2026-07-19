import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcTobaccoIndex, calcAlcoholBurden } from './apnp-calculators.mjs';

test('tobacco negado', () => {
  const r = calcTobaccoIndex({ status: 'negado' });
  assert.equal(r.packYears, null);
  assert.match(r.summary, /negado/i);
});

test('tobacco pack-years active smoker', () => {
  const r = calcTobaccoIndex({
    status: 'activo',
    ageStarted: 18,
    cigarettesPerDay: 20,
    yearsSmoked: 10,
    currentAge: 28,
  });
  assert.equal(r.packYears, 10);
  assert.equal(r.alert, null);
});

test('tobacco ex-smoker uses effective years from ages', () => {
  const r = calcTobaccoIndex({
    status: 'exfumador',
    ageStarted: 15,
    ageStopped: 35,
    cigarettesPerDay: 10,
  });
  assert.equal(r.effectiveYears, 20);
  assert.equal(r.packYears, 10);
});

test('tobacco high index alert', () => {
  const r = calcTobaccoIndex({
    status: 'activo',
    cigarettesPerDay: 20,
    yearsSmoked: 50,
  });
  assert.equal(r.packYears, 50);
  assert.equal(r.alert, 'high');
});

test('alcohol weekly grams', () => {
  const r = calcAlcoholBurden({
    status: 'activo',
    drinksPerOccasion: 3,
    frequencyKind: 'semana',
    frequencyCount: 2,
  });
  assert.equal(r.gramsPerWeek, 3 * 14 * 2);
});

test('alcohol daily frequency', () => {
  const r = calcAlcoholBurden({
    status: 'activo',
    drinksPerOccasion: 2,
    frequencyKind: 'dia',
    frequencyCount: 1,
  });
  assert.equal(r.gramsPerWeek, 2 * 14 * 7);
});
