import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAnionGapValue_,
  computeAlbuminCorrectedAnionGapValue_,
  computeUrinaryAnionGapValue_,
  computeAnionGap_,
  computeAlbuminCorrectedAnionGap_,
  computeUrinaryAnionGap_,
  extractUrineElectrolytes_,
  resolveEffectiveAnionGapValue_,
} from './labs-anion-gap.mjs';

test('AG crudo = Na − (Cl + HCO₃)', () => {
  assert.equal(computeAnionGapValue_('140', '104', '24'), 12);
  assert.equal(computeAnionGap_('140', '104', '24'), '12');
});

test('AGc = AG + 2.5×(4 − Alb)', () => {
  // AG = 134.5 − (102.3 + 17.1) ≈ 15.1; AGc ≈ 15.1 + 2.5×(4−2.1) = 19.8
  const ag = computeAnionGapValue_('134.5', '102.3', '17.1');
  assert.equal(Math.round(ag * 10) / 10, 15.1);
  const agc = computeAlbuminCorrectedAnionGapValue_('134.5', '102.3', '17.1', '2.1');
  assert.ok(agc != null);
  assert.equal(Math.round(agc * 10) / 10, 19.8);
  assert.equal(computeAlbuminCorrectedAnionGap_('134.5', '102.3', '17.1', '2.1'), '19.8*');
});

test('AGc es null sin albúmina', () => {
  assert.equal(computeAlbuminCorrectedAnionGapValue_('140', '104', '24', '---'), null);
  assert.equal(computeAlbuminCorrectedAnionGap_('140', '104', '24'), '---');
});

test('UAG = Naᵤ + Kᵤ − Clᵤ', () => {
  assert.equal(computeUrinaryAnionGapValue_('40', '22', '34'), 28);
  assert.equal(computeUrinaryAnionGap_('40', '22', '34'), '28');
  assert.equal(computeUrinaryAnionGapValue_('20', '10', '50'), -20);
  assert.equal(computeUrinaryAnionGap_('20', '10', '50'), '-20');
});

test('extractUrineElectrolytes_ lee etiquetas de orina SOME', () => {
  const t = `
POTASIO EN ORINA
B
22
mmol/L	40 - 80
SODIO EN ORINA
B
40
mmol/L	80 - 180
CLORO EN ORINA: 34mmol/L
`.replace(/\s+/g, ' ');
  const u = extractUrineElectrolytes_(t);
  assert.equal(u.na, '40');
  assert.equal(u.k, '22');
  assert.equal(u.cl, '34');
});

test('resolveEffectiveAnionGapValue_ prefiere AGc cuando hay albúmina', () => {
  const eff = resolveEffectiveAnionGapValue_('134.5', '102.3', '17.1', '2.1');
  assert.equal(Math.round(eff * 10) / 10, 19.8);
  const raw = resolveEffectiveAnionGapValue_('134.5', '102.3', '17.1', '---');
  assert.equal(Math.round(raw * 10) / 10, 15.1);
});
