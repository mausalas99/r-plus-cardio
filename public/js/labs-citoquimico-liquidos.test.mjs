import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearCitoquimicoLiquidos,
  procesarLabs,
  evaluarCriteriosLight_,
  evaluarGasa_,
  evaluarAscitisNoPortal_,
  buildAscitisLabAlerts_,
  buildPleuralLabAlerts_,
  buildCitoquimicoInterpretAlerts_,
  formatCitoquimicoInterpretacionLine_,
  isCitoquimInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  computeGasaValue_,
  esLiquidoAscitico_,
  normalizarProteinasFluidoGdl_,
  esLiquidoPleural_,
  resolveSerumAlbuminForGasa_,
  extractSerumAlbuminGdlFromResLabs_,
  refreshCitoquimicoInterpretacionInResLabs_,
} from './labs.js';

const MUESTRA_PERITONEAL = `
Expediente:	2211202-9	Solicitud:	2605020732
Nombre:	LUIS FERNANDO PEREZ TAPIA	Fecha Registro:	May 2 2026 5:11PM
Sexo:	MASCULINO	Ubicación:	SERVICIO CLÍNICO 2
Edad:	59	Medico:	A QUIEN CORRESPONDA
 

QUIMICA CLINICA
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
EXAMEN QUIMICO	
*
:
DENSIDAD	
*
1.010
PH	
*
8.5
GLUCOSA	
*
949.0
mg/dL	
PROTEINAS	
*
300
mg/dL	
LDH	
*
6
IU/L	
CITOQUIMICO DE	
*
LIQUIDO PERITONEAL

BACTERIOLOGIA
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
ASPECTO	
*
CLARO
RECUENTO	
A
48
LEUCOCITOS/MM3	0.00 - 5.00
POLIMORFONUCLEARES	
*
PREDOMINIO
%	
LINFOCITOS	
*
%	
ERITROCITOS	
*
ESCASOS
/mm3	
GRAM	
*
NEGATIVO
COMENTARIO	
*
PERITONEAL
`;

test('parsearCitoquimicoLiquidos — líquido peritoneal (química + citología)', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_PERITONEAL);
  assert.match(out, /Liq:/);
  assert.match(out, /LIQUIDO PERITONEAL/);
  assert.match(out, /Dens.*1\.010/);
  assert.match(out, /pH.*8\.5/);
  assert.match(out, /Glu.*949/);
  assert.match(out, /Prot.*\b3\b/);
  assert.match(out, /LDH.*6/);
  assert.match(out, /Asp.*CLARO/);
  assert.match(out, /Leu.*48/);
  assert.match(out, /PMN.*PREDOMINIO/);
  assert.match(out, /Eri.*ESCASOS/);
  assert.match(out, /Gram.*NEGATIVO/);
  assert.match(out, /Obs.*PERITONEAL/);
  assert.ok(!/Light/.test(out), 'peritoneal no usa criterios de Light');
  assert.ok(!/portal HTN|quilosa|citología/i.test(out), 'sin interpretación en línea Liq');
});

const MUESTRA_PLEURAL = `
QUIMICA CLINICA
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
EXAMEN QUIMICO	
*
:
DENSIDAD	
*
1.010
PH	
*
8.0
GLUCOSA	
*
78.0
mg/dL	
PROTEINAS	
*
6000
mg/dL	
LDH	
*
549
IU/L	
CITOQUIMICO DE	
*
LÍQUIDO PLEURAL
ALBUMINA
Estudio		Resultado	Unidades	Valor de Referencia
ALBUMINA	
*
3.4
g/dL	3.2 - 5.5
LDH DESHIDROGENASA LACTICA
Estudio		Resultado	Unidades	Valor de Referencia
LDH DESHIDROGENASA LACTICA	
A
549
UI/L	91 - 180
COLESTEROL
Estudio		Resultado	Unidades	Valor de Referencia
COLESTEROL	
B
88
mg/dL	130 - 200
BACTERIOLOGIA
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
ASPECTO	
*
XANTOCROMICO SANGUINOLENTO
RECUENTO	
A
3,000
LEUCOCITOS/MM3	0.00 - 5.00
POLIMORFONUCLEARES	
*
---
%	
LINFOCITOS	
*
100
%	
ERITROCITOS	
*
5,000
/mm3	
GRAM	
*
ABUNDANTES LEUCOCITOS
COMENTARIO	
*
LIQUIDO PLEURAL
`;

test('normalizarProteinasFluidoGdl — mg/dL del laboratorio', () => {
  assert.equal(normalizarProteinasFluidoGdl_('6000'), 6);
  assert.equal(normalizarProteinasFluidoGdl_('300'), 3);
});

test('parsearCitoquimicoLiquidos — líquido pleural sin Light en línea Liq', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_PLEURAL);
  assert.match(out, /Liq:/);
  assert.match(out, /PLEURAL/i);
  assert.match(out, /Prot.*\b6\b/);
  assert.match(out, /Alb.*3\.4/);
  assert.match(out, /LDH.*549/);
  assert.match(out, /Asp.*XANTOCROMICO/);
  assert.match(out, /Leu.*3000/);
  assert.match(out, /Linf.*100/);
  assert.ok(!/Light EXUDADO/i.test(out));
});

test('buildPleuralLabAlerts — Light exudado en interpretación', () => {
  const alerts = buildPleuralLabAlerts_(MUESTRA_PLEURAL);
  assert.match(alerts.join(' '), /Light EXUDADO/i);
  assert.match(alerts.join(' '), /LDH>2\/3/);
  const interp = formatCitoquimicoInterpretacionLine_(alerts);
  assert.ok(isCitoquimInterpretacionResLabChunk(interp));
});

test('procesarLabs — pleural Light en bloque interpretación citoquímico', () => {
  const { resLabs } = procesarLabs(MUESTRA_PLEURAL);
  const liq = resLabs.find((l) => l.startsWith('Liq:\t'));
  const interp = resLabs.find((l) => isCitoquimInterpretacionResLabChunk(l));
  assert.ok(liq);
  assert.ok(!/Light EXUDADO/i.test(liq));
  assert.ok(interp);
  assert.match(interp, /Light EXUDADO/i);
});

test('evaluarCriteriosLight — exudado por LDH > 2/3 ULN', () => {
  const t = evaluarCriteriosLight_(6, 549, null, null, 180);
  assert.match(t, /EXUDADO/);
  assert.match(t, /LDH>2\/3/);
});

test('evaluarCriteriosLight — trasudado si los 3 criterios son negativos', () => {
  const t = evaluarCriteriosLight_(2, 100, 8, 250, 180);
  assert.match(t, /TRASUDADO/);
  assert.ok(!/EXUDADO/.test(t));
});

test('esLiquidoPleural detecta comentario y tipo', () => {
  assert.equal(esLiquidoPleural_('LIQUIDO PLEURAL', '', ''), true);
  assert.equal(esLiquidoPleural_('LIQUIDO PERITONEAL', '', ''), false);
});

test('procesarLabs no mezcla glucosa del líquido con QS', () => {
  const { resLabs } = procesarLabs(MUESTRA_PERITONEAL);
  const qs = resLabs.find((l) => l.startsWith('QS\t'));
  const liq = resLabs.find((l) => l.startsWith('Liq:\t'));
  assert.ok(liq, 'debe incluir bloque Liq');
  if (qs) assert.ok(!qs.includes('949'), 'QS no debe tomar Glu 949 del ascitis');
});

const MUESTRA_WENDY_ASCITIS = `
Expediente:	1128709-8	Solicitud:	2605111079
Nombre:	WENDY BERENICE ORTIZ RODRIGUEZ	Fecha Registro:	May 11 2026 6:24PM
Sexo:	FEMENINO	Ubicación:	MEDICINA INTERNA 1
Edad:	73	Medico:	A QUIEN CORRESPONDA

QUIMICA CLINICA
ALBUMINA
Estudio		Resultado	Unidades	Valor de Referencia
ALBUMINA
B
3.4
g/dL	3.2 - 5.5

QUIMICA CLINICA
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
EXAMEN QUIMICO
*
:
DENSIDAD
*
1.015
PH
*
7.5
GLUCOSA
*
1.0
mg/dL
PROTEINAS
*
4100
mg/dL
LDH
*
9475
IU/L
CITOQUIMICO DE
*
LIQUIDO PERITONEAL
ALBUMINA
Estudio		Resultado	Unidades	Valor de Referencia
ALBUMINA
B
2.1
g/dL	3.2 - 5.5
COLESTEROL
Estudio		Resultado	Unidades	Valor de Referencia
COLESTEROL
B
29
mg/dL	130 - 200
TRIGLICERIDOS
Estudio		Resultado	Unidades	Valor de Referencia
TRIGLICERIDOS
B
20
mg/dL	35 - 150

BACTERIOLOGIA
FIBRAS VEGETALES
Estudio		Resultado	Unidades	Valor de Referencia
FIBRAS VEGETALES
*
NEGATIVO
TIPO DE MUESTRA
*
LIQUIDO PERITONEAL
CITOQUIMICO DE LIQUIDOS CORPORALES
Estudio		Resultado	Unidades	Valor de Referencia
ASPECTO
*
QUILOSO TURBIO
RECUENTO
A
9,200
LEUCOCITOS/MM3	0.00 - 5.00
POLIMORFONUCLEARES
*
96
%
LINFOCITOS
*
4
%
ERITROCITOS
*
ESCASOS
/mm3
GRAM
*
ABUNDANTES POLIMORFONUCLEARES
COMENTARIO
*
LIQUIDO PERITONEAL
`;

test('computeGasaValue_ — Alb sérica − Alb ascítica', () => {
  assert.equal(computeGasaValue_(3.4, 2.1), 1.3);
  assert.equal(computeGasaValue_(2.1, 1.5), 0.6);
});

test('evaluarGasa_ — portal HTN vs no portal', () => {
  assert.match(evaluarGasa_(3.4, 2.1), /GASA 1\.3 \(≥1\.1 portal HTN\)/);
  assert.match(evaluarGasa_(2.1, 1.5), /GASA 0\.6 \(<1\.1 no portal HTN\)/);
  assert.equal(evaluarGasa_(null, 2.1), '');
});

test('esLiquidoAscitico detecta peritoneal y ascitis', () => {
  assert.equal(esLiquidoAscitico_('LIQUIDO PERITONEAL', '', ''), true);
  assert.equal(esLiquidoAscitico_('LIQUIDO DE ASCITIS', '', ''), true);
  assert.equal(esLiquidoAscitico_('LIQUIDO PLEURAL', '', ''), false);
});

test('parsearCitoquimicoLiquidos — GASA numérico sin interpretación en Liq', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_WENDY_ASCITIS);
  assert.match(out, /Alb.*2\.1/);
  assert.match(out, /TGL.*20/);
  assert.match(out, /\bGASA 1\.3\b/);
  assert.ok(!/portal HTN|quilosa/i.test(out));
});

test('buildAscitisLabAlerts — interpretación aparte de resultados', () => {
  const alerts = buildAscitisLabAlerts_(MUESTRA_WENDY_ASCITIS);
  assert.match(alerts.join(' '), /GASA 1\.3 ≥1\.1 — probable hipertensión portal/);
  const interp = formatCitoquimicoInterpretacionLine_(alerts);
  assert.ok(isCitoquimInterpretacionResLabChunk(interp));
});

const MUESTRA_WENDY_NO_PORTAL = MUESTRA_WENDY_ASCITIS.replace('3.4', '2.5');

test('GASA<1.1 — alerta amilasa y citología, no en línea Liq', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_WENDY_NO_PORTAL);
  assert.match(out, /\bGASA 0\.4\b/);
  assert.ok(!/amilasa|citología|portal/i.test(out));
  const alerts = buildAscitisLabAlerts_(MUESTRA_WENDY_NO_PORTAL);
  assert.match(alerts.join(' '), /GASA 0\.4 <1\.1 — ascitis no portal/);
  assert.match(alerts.join(' '), /amilasa y citología/i);
});

const MUESTRA_WENDY_SIN_TGL_AMIL = MUESTRA_WENDY_ASCITIS
  .replace('3.4', '2.5')
  .replace(/TRIGLICERIDOS[\s\S]*?35 - 150\n\n/, '');

test('GASA<1.1 sin TGL ni amilasa — sugerir ambos', () => {
  const alerts = buildAscitisLabAlerts_(MUESTRA_WENDY_SIN_TGL_AMIL);
  assert.match(alerts.join(' '), /triglicéridos y amilasa/i);
});

test('procesarLabs — interpretación citoquímica en resLabs pero filtrable al copiar', () => {
  const { resLabs } = procesarLabs(MUESTRA_WENDY_ASCITIS);
  const liq = resLabs.find((l) => l.startsWith('Liq:\t'));
  const interp = resLabs.find((l) => isCitoquimInterpretacionResLabChunk(l));
  assert.match(liq, /\bGASA 1\.3\b/);
  assert.ok(!/portal HTN/.test(liq));
  assert.ok(interp);
  assert.match(interp, /peritonitis bacteriana espontánea/i);
  assert.match(interp, /hipertensión portal/);
  assert.match(interp, /^INTERPRETACIÓN CITOQUÍMICO:/);
});

test('evaluarAscitisNoPortal — ramas del algoritmo', () => {
  assert.match(evaluarAscitisNoPortal_(0.8, null, null, null, null), /triglicéridos y amilasa/i);
  assert.match(evaluarAscitisNoPortal_(0.8, 4, 250, null, null), /quilosa/i);
  assert.match(evaluarAscitisNoPortal_(0.8, 2, 100, null, null), /nefrótico/i);
  assert.match(evaluarAscitisNoPortal_(0.8, 4, 100, 1500, null), /pancreática/i);
  assert.match(evaluarAscitisNoPortal_(0.8, 4, 100, 80, 'positive'), /Carcinomatosis/i);
  assert.match(evaluarAscitisNoPortal_(0.8, 4, 100, 80, 'negative'), /tuberculosa/i);
  assert.equal(evaluarAscitisNoPortal_(1.3, 4, 100, 80, 'positive'), '');
});

test('parsearCitoquimicoLiquidos — sin albúmina sérica no muestra GASA', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_PERITONEAL);
  assert.ok(!/GASA/.test(out));
});

const MUESTRA_ALB_SERUM_DESPUES_CITO =
  MUESTRA_WENDY_ASCITIS.replace(
    /QUIMICA CLINICA\nALBUMINA[\s\S]*?3\.2 - 5\.5\n\n/,
    ''
  ) +
  `
QUIMICA CLINICA
ALBUMINA
Estudio		Resultado	Unidades	Valor de Referencia
ALBUMINA
B
3.4
g/dL	3.2 - 5.5
`;

test('GASA — albúmina sérica después del bloque citoquímico en el mismo informe', () => {
  const out = parsearCitoquimicoLiquidos(MUESTRA_ALB_SERUM_DESPUES_CITO);
  assert.match(out, /\bGASA 1\.3\b/);
  const alerts = buildAscitisLabAlerts_(MUESTRA_ALB_SERUM_DESPUES_CITO);
  assert.match(alerts.join(' '), /hipertensión portal/);
});

test('GASA — albúmina sérica en otro envío del mismo día (PFHs parseado)', () => {
  const soloAscitis = parsearCitoquimicoLiquidos(MUESTRA_WENDY_ASCITIS.replace(
    /QUIMICA CLINICA\nALBUMINA[\s\S]*?3\.2 - 5\.5\n\n/,
    ''
  ));
  assert.ok(!/\bGASA\b/.test(soloAscitis));
  const serumLabs = ['PFHs\tAlb 3.4 GOT 20 ALT 18'];
  const opts = { extraResLabs: [serumLabs] };
  const out = parsearCitoquimicoLiquidos(
    MUESTRA_WENDY_ASCITIS.replace(/QUIMICA CLINICA\nALBUMINA[\s\S]*?3\.2 - 5\.5\n\n/, ''),
    opts
  );
  assert.match(out, /\bGASA 1\.3\b/);
  assert.equal(extractSerumAlbuminGdlFromResLabs_(serumLabs), 3.4);
  assert.equal(
    resolveSerumAlbuminForGasa_(MUESTRA_PERITONEAL, '', { extraResLabs: [serumLabs] }),
    3.4
  );
});

test('buildCitoquimicoInterpretAlerts — combina ascitis y pleural', () => {
  const alerts = buildCitoquimicoInterpretAlerts_(MUESTRA_WENDY_ASCITIS);
  assert.match(alerts.join(' '), /hipertensión portal/);
  const pleuralAlerts = buildCitoquimicoInterpretAlerts_(MUESTRA_PLEURAL);
  assert.match(pleuralAlerts.join(' '), /Light EXUDADO/i);
});

test('refreshCitoquimicoInterpretacionInResLabs_ — une PFHs de otro bloque guardado', () => {
  const ascitisOnly = MUESTRA_WENDY_ASCITIS.replace(
    /QUIMICA CLINICA\nALBUMINA[\s\S]*?3\.2 - 5\.5\n\n/,
    ''
  );
  const liqOnly = parsearCitoquimicoLiquidos(ascitisOnly);
  const resLabs = [liqOnly, 'INTERPRETACIÓN CITOQUÍMICO:\tIncluir albúmina sérica del mismo día para calcular GASA'];
  const next = refreshCitoquimicoInterpretacionInResLabs_(resLabs, ascitisOnly, {
    extraResLabs: [['PFHs\tAlb 3.4']],
  });
  const liq = next.find((l) => l.startsWith('Liq:\t'));
  const interp = next.find((l) => isCitoquimInterpretacionResLabChunk(l));
  assert.match(liq, /\bGASA 1\.3\b/);
  assert.match(interp, /hipertensión portal/);
});
