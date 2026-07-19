import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAnionGap_, computeAlbuminCorrectedAnionGap_, procesarLabs } from './labs.js';

const MUESTRA_SOLO_COAG = `
Expediente:	2180481-3	Solicitud:	2605090476
Nombre:	MARGARITA LIZETH GARZA HERNANDEZ	Fecha Registro:	May 9 2026 10:07AM
Sexo:	FEMENINO	Ubicación:	SERVICIO CLÍNICO 1
Edad:	36	Medico:	A QUIEN CORRESPONDA

HEMATOLOGIA
TIEMPO DE PROTROMBINA Y TROMBOPLASTINA
Estudio		Resultado	Unidades	Valor de Referencia
TIEMPO DE PROTROMBINA
A
13.70
SEG.	10.25 - 13.20
TESTIGO
*
11.76
SEG
INR
*
1.17
TIEMPO DE TROMBOPLASTINA
*
33.3
SEG	29.1 - 38.4
TESTIGO
*
31.2
SEG
OBSERVACIONES
*
`;

test('procesarLabs incluye COAG con TP/TTP/INR cuando no hay biometría', () => {
  const { resLabs } = procesarLabs(MUESTRA_SOLO_COAG);
  const coag = resLabs.find((l) => /^COAG\t/.test(l));
  assert.ok(coag, 'debe producir línea COAG');
  assert.match(coag, /TP\s+13\.7/);
  assert.match(coag, /TTP\s+33\.3/);
  assert.match(coag, /INR\s+1\.17/);
  assert.ok(!resLabs.some((l) => /^BH[:\t]/.test(l)), 'sin BH vacía');
});

test('computeAnionGap_ es AG crudo; AGc corrige por hipoalbuminemia', () => {
  const sinCorreccion = computeAnionGap_('134.5', '102.3', '17.1');
  const agc = computeAlbuminCorrectedAnionGap_('134.5', '102.3', '17.1', '2.1');
  assert.equal(sinCorreccion, '15.1*');
  assert.equal(agc, '19.8*');
});
