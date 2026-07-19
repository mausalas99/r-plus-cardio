import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQS_, extraerProcalcitonina_ } from './labs.js';

const PCT_BLOQUE_REAL = `ESTUDIOS ESPECIALES
PROCALCITONINA
Estudio		Resultado	Unidades	Valor de Referencia
PROCALCITONINA	
*
0.09
ng/mL	ADULTO <0.05 ng/mL NEONATOS: 0 - 5 HORAS: <=0.5 ng/mL 6 - 11 HORAS: <=2 ng/mL 12 - 17 HORAS: <=5 ng/mL 18 - 35 HORAS: <=10 ng/mL 36 - 47 HORAS: <=5 ng/mL 48 - 59 HORAS: <=2 ng/mL 60 - 72 HORAS: <=1 ng/mL >72 HORAS: <=0.5 ng/mL`;

test('extraerProcalcitonina_ extrae el valor numérico desde el bloque real', () => {
  const tNorm = PCT_BLOQUE_REAL.replace(/\s+/g, ' ');
  const r = extraerProcalcitonina_(tNorm);
  assert.equal(r.valor, '0.09');
});

test('extraerProcalcitonina_ infiere rango adulto 0-0.05 desde "ADULTO <0.05"', () => {
  const tNorm = PCT_BLOQUE_REAL.replace(/\s+/g, ' ');
  const r = extraerProcalcitonina_(tNorm);
  assert.equal(r.min, 0);
  assert.equal(r.max, 0.05);
});

test('extraerProcalcitonina_ ignora "0 - 5 HORAS" como rango', () => {
  const tNorm = PCT_BLOQUE_REAL.replace(/\s+/g, ' ');
  const r = extraerProcalcitonina_(tNorm);
  assert.notEqual(r.max, 5, 'no debe tomar 5 (horas neonatales) como max del rango');
});

test('extraerProcalcitonina_ devuelve --- cuando no hay PCT', () => {
  const r = extraerProcalcitonina_('GLUCOSA EN SANGRE 95 mg/dL 70 - 110');
  assert.equal(r.valor, '---');
});

test('extraerProcalcitonina_ tolera texto vacío', () => {
  assert.equal(extraerProcalcitonina_('').valor, '---');
  assert.equal(extraerProcalcitonina_(null).valor, '---');
  assert.equal(extraerProcalcitonina_(undefined).valor, '---');
});

test('parseQS_ incluye PCT marcado con * cuando excede 0.05', () => {
  const tNorm = PCT_BLOQUE_REAL.replace(/\s+/g, ' ');
  const out = parseQS_(tNorm);
  assert.match(out, /PCT 0\.09\*/);
});

test('parseQS_ incluye PCT sin asterisco cuando es ≤ 0.05', () => {
  const t = 'ESTUDIOS ESPECIALES PROCALCITONINA Estudio Resultado Unidades Valor de Referencia PROCALCITONINA 0.03 ng/mL ADULTO <0.05 ng/mL';
  const out = parseQS_(t);
  assert.match(out, /PCT 0\.03(?!\*)/);
});

test('parseQS_ no incluye PCT cuando no aparece en el texto', () => {
  const t = 'QUIMICA SANGUINEA GLUCOSA EN SANGRE 95 mg/dL 70 - 110 CREATININA 0.9 mg/dL 0.7 - 1.2';
  const out = parseQS_(t);
  assert.doesNotMatch(out, /PCT/);
});

test('parseQS_ devuelve QS cuando solo PCT está presente (sin otros analitos)', () => {
  const tNorm = PCT_BLOQUE_REAL.replace(/\s+/g, ' ');
  const out = parseQS_(tNorm);
  assert.match(out, /^QS\t/, 'debe arrancar con la etiqueta QS');
});

test('parseQS_ mantiene PCR existente y agrega PCT junto a él', () => {
  const t = 'QUIMICA SANGUINEA PROTEINA C REACTIVA 4.2 mg/L 0 - 5 ESTUDIOS ESPECIALES PROCALCITONINA PROCALCITONINA 0.09 ng/mL ADULTO <0.05 ng/mL';
  const out = parseQS_(t);
  assert.match(out, /PCR 4\.2/);
  assert.match(out, /PCT 0\.09\*/);
});
