import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePipeHeader, parseFichaIdentificacion, mergeHeader } from './parse-header.mjs';

test('parsePipeHeader', () => {
  const h = parsePipeHeader([
    '214-4 | VÍCTOR IRACHETA TORRES | 64 AÑOS | 1123383-2 | CHOQUE SÉPTICO',
  ]);
  assert.equal(h?.registro, '1123383-2');
  assert.equal(h?.edad, '64');
  assert.equal(h?.cama, '214-4');
});

test('parsePipeHeader accepts double pipe separators', () => {
  const h = parsePipeHeader([
    '204-3 || WENDY BERENICE ORTIZ RODRIGUEZ || 32 AÑOS || 1128709-8 || ERC KDIGO5',
  ]);
  assert.equal(h?.registro, '1128709-8');
  assert.equal(h?.nombre, 'WENDY BERENICE ORTIZ RODRIGUEZ');
  assert.equal(h?.cama, '204-3');
});

test('parsePipeHeader accepts name-first line without cama', () => {
  const h = parsePipeHeader([
    'BEATRIZ SANCHEZ HERNANDEZ | 27 | 2024720-7 | ERC KDIGO 5 AGUDIZADA',
  ]);
  assert.equal(h?.nombre, 'BEATRIZ SANCHEZ HERNANDEZ');
  assert.equal(h?.edad, '27');
  assert.equal(h?.registro, '2024720-7');
  assert.equal(h?.cama, '');
});

test('parsePipeHeader accepts numeric cama without hyphen', () => {
  const h = parsePipeHeader(['213 || ÁNGEL SEGURA TREJO || 20 AÑOS || 2109916-7 || LLA']);
  assert.equal(h?.cama, '213');
  assert.equal(h?.nombre, 'ÁNGEL SEGURA TREJO');
  assert.equal(h?.edad, '20');
});

test('parsePipeHeader accepts age without AÑOS suffix', () => {
  const h = parsePipeHeader([
    '433-5 || NORMA PATRICIA SALAZAR ABARTE || 48 || 2216164-3 || ISQUEMIA MIOCARDICA',
  ]);
  assert.equal(h?.cama, '433-5');
  assert.equal(h?.edad, '48');
  assert.equal(h?.registro, '2216164-3');
});

test('parseFichaIdentificacion maps fields and sexo', () => {
  const f = parseFichaIdentificacion(
    ['NOMBRE: VÍCTOR IRACHETA', 'SEXO: MASCULINO', 'ORIGEN: DOCTOR ARROYO'].join('\n'),
  );
  assert.equal(f.identificacion.nombre, 'VÍCTOR IRACHETA');
  assert.equal(f.sexo, 'M');
  assert.equal(f.identificacion.lugarNacimiento, 'DOCTOR ARROYO');
});

test('mergeHeader prefers ficha nombre over pipe', () => {
  const pipe = parsePipeHeader(['214-4 | SHORT | 64 AÑOS | 1-2 | DX']);
  const ficha = parseFichaIdentificacion('NOMBRE: FULL NAME');
  const m = mergeHeader(pipe, ficha);
  assert.equal(m.nombre, 'FULL NAME');
});
