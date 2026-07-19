import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrotisSangre_, procesarLabs } from './labs.js';

const MUESTRA_FROTIS = `
Expediente:	2180481-3	Solicitud:	2605050388
Nombre:	MARGARITA LIZETH GARZA HERNANDEZ	Fecha Registro:	May 5 2026 5:40AM
Sexo:	FEMENINO	Ubicación:	SERVICIO CLÍNICO 1
Edad:	36	Medico:	A QUIEN CORRESPONDA

HEMATOLOGIA
BIOMETRIA HEMATICA COMPLETA
Estudio		Resultado	Unidades	Valor de Referencia
HGB
B
7.28
g/dL	12.20 - 18.10
WBC
A
27.10
K/uL	4.00 - 11.00
OBSERVACIONES
*
DIFERENCIAL MANUAL
Estudio		Resultado	Unidades	Valor de Referencia
SEGMENTADOS
*
95
%
OBSERVACIONES
*
FROTIS DE SANGRE PERIFERICA
Estudio		Resultado	Unidades	Valor de Referencia
FROTIS DE SANGRE PERIFERICA
*
HIPOCROMIA +., ANISOCITOSIS +, PLAQUETAS NORMALES EN CANTIDAD, SE OBSERVAN MACROPLAQUETAS.
`;

test('parseFrotisSangre_ separa calidad eritrocitaria y plaquetas', () => {
  const out = parseFrotisSangre_(MUESTRA_FROTIS);
  assert.match(out, /FROTIS\tCal\s+.*HIPOCROMIA \+\./);
  assert.match(out, /ANISOCITOSIS \+/);
  assert.match(out, /FROTIS\tPlaq\s+.*MACROPLAQUETAS/);
});

test('procesarLabs incluye bloque FROTIS cuando aparece en hematologia', () => {
  const { resLabs } = procesarLabs(MUESTRA_FROTIS);
  const frotis = resLabs.find((l) => l.startsWith('FROTIS\t'));
  assert.ok(frotis, 'debe incluir bloque FROTIS');
});
