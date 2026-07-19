import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procesarLabs, buildRefsBySectionFromReport } from './labs.js';

const SOME_RAUL = `Expediente:	1929604-8	Solicitud:	2605180169
Nombre:	RAUL CORONADO PALOMO	Fecha Registro:	May 18 2026 3:24AM
Sexo:	MASCULINO	Ubicación:	NEUROMEDICA
Edad:	70	Medico:	A QUIEN CORRESPONDA

HEMATOLOGIA
BIOMETRIA HEMATICA COMPLETA
Estudio		Resultado	Unidades	Valor de Referencia
HGB	
*
12.40
g/dL	12.20 - 18.10
HCT	
*
39.8
%	37.7 - 53.7
WBC	
A
19.60
K/uL	4.00 - 11.00
CREATININA EN SANGRE
Estudio		Resultado	Unidades	Valor de Referencia
CREATININA EN SANGRE	
A
6.0
mg/dL	0.6 - 1.4
SODIO
Estudio		Resultado	Unidades	Valor de Referencia
SODIO	
B
133.6
mmol/L	135.0 - 145.0
`;

test('buildRefsBySectionFromReport extrae rangos SOME por sección', () => {
  const refs = buildRefsBySectionFromReport(SOME_RAUL);
  assert.deepEqual(refs.BH.Hb, [12.2, 18.1]);
  assert.deepEqual(refs.BH.Hto, [37.7, 53.7]);
  assert.deepEqual(refs.BH.Leu, [4, 11]);
  assert.deepEqual(refs.QS.Cr, [0.6, 1.4]);
  assert.deepEqual(refs.ESC.Na, [135, 145]);
});

test('procesarLabs incluye refsBySection', () => {
  const r = procesarLabs(SOME_RAUL);
  assert.ok(r.refsBySection);
  assert.deepEqual(r.refsBySection.BH.Hb, [12.2, 18.1]);
  assert.match(r.resLabs.join('\n'), /BH\tHb 12\.4/);
  assert.match(r.resLabs.join('\n'), /QS\t.*Cr 6/);
  assert.match(r.resLabs.join('\n'), /ESC\tNa 133\.6\*/);
});
