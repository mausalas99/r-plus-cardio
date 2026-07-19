import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFisicoquimicoHeces_, procesarLabs } from './labs.js';

const MUESTRA_HECES = `
Expediente:	2213511-4	Solicitud:	2605040998
Nombre:	CASTILLO JUAREZ BENITO	Fecha Registro:	04/05/2026 03:06:21 p. m.
Sexo:	MASCULINO	Ubicación:	SERVICIO CLÍNICO 1
Edad:	58	Medico:	A QUIEN CORRESPONDA

PARASITOLOGIA
Estudio		Resultado	Unidades	Valor de Referencia
FISICOQUIMICO DE HECES
ASPECTO
*
6
TIPO 3 Y 4 G.BRISTOL
PH
*
6.0
7.0
PROTEINAS
*
NEGATIVO
NEGATIVO
GLUCOSA
*
NEGATIVO
NEGATIVO
LEUCOCITOS
*
MODERADAS
NEGATIVO
ERITROCITOS
*
ESCASAS
NEGATIVO
GRASA
*
NEGATIVO
NEGATIVO
FIBRAS MUSCULARES
*
ESCASAS
NEGATIVO
COPROPARASITOSCOPICO INMEDIATO
*
NEGATIVO
NEGATIVO
OBSERVACIONES
*
`;

test('parseFisicoquimicoHeces_ detecta bloque y resultados clave', () => {
  const out = parseFisicoquimicoHeces_(MUESTRA_HECES);
  assert.match(out, /^HECES\t/);
  assert.match(out, /Asp\s+6 TIPO 3 Y 4 G\.BRISTOL/);
  assert.match(out, /pH\s+6\.0/);
  assert.match(out, /Prot\s+NEGATIVO/);
  assert.match(out, /Leu\s+MODERADAS/);
  assert.match(out, /Eri\s+ESCASAS/);
  assert.match(out, /Copro\s+NEGATIVO/);
});

test('procesarLabs incluye bloque HECES cuando viene parasitologia', () => {
  const { resLabs } = procesarLabs(MUESTRA_HECES);
  const heces = resLabs.find((l) => l.startsWith('HECES\t'));
  assert.ok(heces, 'debe incluir bloque HECES');
});
