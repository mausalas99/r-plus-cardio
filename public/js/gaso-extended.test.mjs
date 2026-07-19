import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGasoExtended } from './gaso-extended.mjs';
import { computeAnionGapValue_ } from './labs.js';

test('Winter: HCO3 12 → PaCO2 esperada ≈ 26', () => {
  const r = evaluateGasoExtended({ hco3: 12 });
  assert.equal(r.steps.compensation.expectedPCO2, 26);
});

test('Trastorno mixto: PaCO2 por encima del rango Winter con acidosis metabólica', () => {
  const r = evaluateGasoExtended({
    pH: 7.08,
    hco3: 17,
    pCO2: 55,
    na: 140,
    cl: 103,
    pO2: 75,
    fio2: 0.21
  });
  assert.equal(r.steps.primary.disorder, 'mixed');
  assert.match(r.steps.compensation.note, /discrepa|Winter/i);
  assert.match(r.steps.primary.rationale, /Winter/i);
  assert.match(r.steps.primary.rationale, /por encima/i);
});

test('Trastorno mixto alcalino: HCO3 bajo y PaCO2 bajo frente a Winter', () => {
  const r = evaluateGasoExtended({
    pH: 7.48,
    hco3: 17.9,
    pCO2: 24,
    na: 140,
    cl: 100,
  });
  assert.equal(r.steps.primary.disorder, 'mixed');
  assert.equal(r.steps.primary.type, 'alkalosis');
  assert.match(r.steps.primary.rationale, /alcalemia/i);
  assert.match(r.steps.primary.rationale, /Winter/i);
  assert.match(r.steps.primary.rationale, /por debajo/i);
});

test('Anión gap reutiliza computeAnionGapValue_ de labs.js', () => {
  const agFromLabs = computeAnionGapValue_('140', '103', '17');
  const r = evaluateGasoExtended({ na: 140, cl: 103, hco3: 17 });
  assert.equal(r.steps.anionGap.value, Math.round((agFromLabs + Number.EPSILON) * 10) / 10);
});

test('AGc y UAG en evaluateGasoExtended', () => {
  const r = evaluateGasoExtended({
    na: 134.5,
    cl: 102.3,
    hco3: 17.1,
    alb: 2.1,
    naU: 40,
    kU: 22,
    clU: 34,
  });
  assert.equal(r.steps.anionGap.value, 15.1);
  assert.equal(r.steps.anionGap.corrected, 19.8);
  assert.equal(r.steps.urinaryAnionGap.value, 28);
  assert.match(r.steps.urinaryAnionGap.interpretation, /positivo|ATR/i);
  assert.match(r.steps.anionGap.interpretation, /AGc|albúmina/i);
});

test('UAG negativo interpreta excreción de NH₄⁺', () => {
  const r = evaluateGasoExtended({ uag: -15 });
  assert.equal(r.steps.urinaryAnionGap.value, -15);
  assert.match(r.steps.urinaryAnionGap.interpretation, /negativo|NH/i);
});
