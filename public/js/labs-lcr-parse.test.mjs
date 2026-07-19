import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  procesarLabs,
  parseLcrParsed,
  buildLcrLabAlerts_,
  isCitoquimInterpretacionResLabChunk,
} from './labs.js';
import { collectLcrBlocks_, mergeLcrFields_ } from './labs-lcr-parse.mjs';

const MUESTRA_JOSE_GARCIA_LCR = `
Expediente:	1936244-5	Solicitud:	2607150803
Nombre:	JOSE GARCIA BERNAL	Fecha Registro:	Jul 15 2026 3:06PM
Sexo:	MASCULINO	Ubicación:	URGENCIAS ADULTOS
Edad:	83	Medico:	A QUIEN CORRESPONDA
 

QUIMICA CLINICA
CITOQUIMICO DE LCR
Estudio		Resultado	Unidades	Valor de Referencia
pH	
*
8.5
ASPECTO	
*
RECUENTO CELULAR	
*
LEUCOCITOS/mm3	0 - 5
POLIMORFONUCLEARES	
*
%PMN	
LINFOCITOS	
*
%LINFOCITOS	
TINTA CHINA	
*
ERITROCITOS	
*
COAGLUTINACION	
*
GRAM	
*
GLUCOSA	
*
51
mg/dL	45 - 80
PROTEINAS	
A
78
mg/dL	15 - 45
CLORURO	
A
135.5
mmol/L	118.1 - 132.0
OTROS	
*

BACTERIOLOGIA
CITOQUIMICO LIQ. LCR
Estudio		Resultado	Unidades	Valor de Referencia
LCR	
*
ASPECTO	
*
CLARO
RECUENTO CELULAR	
*
0
LEUCOCITOS/MM	
LEUCOCITOS POLIMORFONUCLEARES	
*
---
%PMN	
LINFOCITOS	
*
---
%LINFOCITOS	
TINTA CHINA	
*
NEGATIVO
ERITROCITOS	
*
ESCASOS CRENOZADOS
COAGLUTINACION	
*
GRAM	
*
NEGATIVO
COMENTARIOS	
*
`;

test('collectLcrBlocks_ — química + bacteriología', () => {
  const blocks = collectLcrBlocks_(MUESTRA_JOSE_GARCIA_LCR);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0], /CITOQUIMICO DE LCR/i);
  assert.match(blocks[1], /CITOQUIMICO LIQ\. LCR/i);
});

test('parseLcrParsed — dual block merge (José García)', () => {
  const parsed = parseLcrParsed(MUESTRA_JOSE_GARCIA_LCR);
  assert.ok(parsed);
  assert.equal(parsed.leu, 0);
  assert.equal(parsed.aspecto, 'CLARO');
  assert.equal(parsed.glu, 51);
  assert.equal(parsed.protMgdl, 78);
  assert.equal(parsed.cl, 135.5);
  assert.equal(parsed.gram, 'NEGATIVO');
  assert.equal(parsed.tinta, 'NEGATIVO');
  assert.match(parsed.line, /Leu 0/);
  assert.match(parsed.line, /Asp CLARO/);
  assert.ok(!/RECUENTO CELULAR/.test(parsed.line));
  assert.ok(!/GLUCOSA/.test(parsed.gram));
});

test('procesarLabs — LCR dual block no filtra Glu a QS', () => {
  const { resLabs } = procesarLabs(MUESTRA_JOSE_GARCIA_LCR);
  const qs = resLabs.find((l) => l.startsWith('QS\t'));
  const lcr = resLabs.find((l) => l.startsWith('LCR:\t'));
  assert.ok(lcr);
  assert.match(lcr, /Leu 0/);
  assert.match(lcr, /Prot 78/);
  if (qs) assert.ok(!qs.includes('Glu 51'), 'QS no debe tomar glucosa del LCR');
});

test('buildLcrLabAlerts_ — pH fuera de rango sin meningitis', () => {
  const alerts = buildLcrLabAlerts_(MUESTRA_JOSE_GARCIA_LCR);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /pH LCR 8\.5 fuera de rango fisiológico/);
  assert.ok(!/Meningitis/i.test(alerts.join(' ')));
});

test('pH LCR flag — interpretación copiable filtrada', () => {
  const { resLabs } = procesarLabs(MUESTRA_JOSE_GARCIA_LCR);
  const lcr = resLabs.find((l) => l.startsWith('LCR:\t'));
  const interp = resLabs.find((l) => isCitoquimInterpretacionResLabChunk(l));
  assert.match(lcr, /pH 8\.5/);
  assert.ok(interp);
  assert.match(interp, /pH LCR 8\.5 fuera de rango/);
  const copyLines = resLabs.filter((l) => !isCitoquimInterpretacionResLabChunk(l));
  assert.ok(!copyLines.some((l) => /fuera de rango/i.test(l)));
});

test('mergeLcrFields_ — micro reemplaza aspecto inválido de química', () => {
  const blocks = collectLcrBlocks_(MUESTRA_JOSE_GARCIA_LCR);
  const merged = mergeLcrFields_(blocks);
  assert.equal(merged.aspecto, 'CLARO');
  assert.equal(merged.leu, '0');
  assert.equal(merged.glu, '51');
});

test('procesarLabs — LCR bacteriana previa sigue funcionando', () => {
  const MUESTRA = `
QUIMICA CLINICA
GLUCOSA
Estudio		Resultado	Unidades	Valor de Referencia
GLUCOSA
B
110
mg/dL	70 - 110

CITOQUIMICO DE LCR
Estudio		Resultado	Unidades	Valor de Referencia
PH
7.30
ASPECTO
TURBIO
RECUENTO CELULAR
2500
LEUCOCITOS
GLUCOSA
25
mg/dL	40 - 80
PROTEINAS
180
mg/dL	15 - 45
CLORURO
120
mEq/L	118 - 132
GRAM
COCCOS GRAM POSITIVOS EN CADENAS
TINTA CHINA
NEGATIVO

BACTERIOLOGIA
`;
  const { resLabs } = procesarLabs(MUESTRA);
  const lcr = resLabs.find((l) => l.startsWith('LCR:\t'));
  const interp = resLabs.find((l) => isCitoquimInterpretacionResLabChunk(l));
  assert.match(lcr, /Leu 2500/);
  assert.ok(interp);
  assert.match(interp, /Meningitis bacteriana/i);
});
