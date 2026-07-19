import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGaso_, procesarLabs, buildGasoInterpretacion_, reprocessLabResultLines_, parseESC_, parseQS_, renderEntry } from './labs.js';

const MUESTRA_GASO_VENOSA = `
Expediente:	2213511-4	Solicitud:	2605070398
Nombre:	BENITO CASTILLO JUAREZ	Fecha Registro:	May 7 2026 6:43AM
Sexo:	MASCULINO	Ubicación:	SERVICIO CLÍNICO 1
Edad:	58	Medico:	A QUIEN CORRESPONDA


GASOMETRIAS
GASOMETRIA VENOSA PARCIAL
Estudio		Resultado	Unidades	Valor de Referencia
PH	*	7.39		7.32 - 7.43
pCO2	B	35	mmHg	40 - 45
pO2	A	60	mmHg	N/A
Lactato	B	0.7	mmol/L	0.9 - 1.9
HCO3	B	21.2	mmol/L	24.0 - 30.0
EX. BASE	B	-3.4	mmol/L	-2.0 - 2.0
SAT 02	A	90	%	0 - 0
OBSERVACIONES	*	Ca++ IONIZADO: 0.92 mmol/L	&
`;

test('parseGaso_ extrae Ca++ ionizado del bloque OBSERVACIONES y lo marca como bajo', () => {
  const tNorm = MUESTRA_GASO_VENOSA.replace(/\s+/g, ' ');
  const out = parseGaso_(tNorm);
  assert.ok(out.startsWith('GASES\t'), 'el output debe empezar con GASES');
  assert.match(out, /\biCa 0\.92\*/, 'debe incluir iCa con valor 0.92 marcado como anormal');
});

test('parseGaso_ omite iCa cuando no aparece en el reporte', () => {
  const tSinIca = MUESTRA_GASO_VENOSA
    .replace(/OBSERVACIONES.*$/im, '')
    .replace(/\s+/g, ' ');
  const out = parseGaso_(tSinIca);
  assert.ok(out.startsWith('GASES\t'));
  assert.doesNotMatch(out, /\biCa\b/, 'no debe incluir iCa cuando no hay dato');
});

test('parseGaso_ no marca iCa dentro del rango normal (1.20 mmol/L)', () => {
  const tNorm = MUESTRA_GASO_VENOSA
    .replace('Ca++ IONIZADO: 0.92 mmol/L', 'Ca++ IONIZADO: 1.20 mmol/L')
    .replace(/\s+/g, ' ');
  const out = parseGaso_(tNorm);
  assert.match(out, /\biCa 1\.2(?!\*)/, 'iCa 1.20 debe ir sin asterisco');
});

test('procesarLabs incluye iCa en la línea GASES cuando hay Ca++ ionizado', () => {
  const res = procesarLabs(MUESTRA_GASO_VENOSA);
  const lineaGases = (res.resLabs || []).find((l) => /^GASES\b/.test(l));
  assert.ok(lineaGases, 'procesarLabs debe producir una línea GASES');
  assert.match(lineaGases, /\biCa 0\.92\*/);
});

const QS_TEXT = `QUIMICA SANGUINEA
SODIO	N	140	mmol/L	136 - 146
CLORO	N	104	mmol/L	98 - 107
`.replace(/\s+/g, ' ');

const ESC_TEXT = `ELECTROLITOS SERICOS
SODIO	N	140	mmol/L	136 - 146
CLORO	N	100	mmol/L	98 - 107
`.replace(/\s+/g, ' ');

const GAS_VEN_HCO3 = `GASOMETRIA VENOSA PARCIAL
PH	N	7.39
HCO3	N	21.2	mmol/L	24.0 - 30.0
`.replace(/\s+/g, ' ');

test('parseGaso_ calcula anion gap usando Na/Cl de la química sanguínea', () => {
  const out = parseGaso_(GAS_VEN_HCO3, QS_TEXT);
  assert.match(out, /\bAG 14\.8\*/);
  assert.match(out, /\bDelta-Delta 1\b/);
});

test('parseGaso_ añade AGc cuando hay albúmina en la química', () => {
  const conAlb =
    QS_TEXT +
    ` QUIMICA CLINICA ALBUMINA N 2.1 g/dL 3.2 - 5.5`.replace(/\s+/g, ' ');
  const out = parseGaso_(GAS_VEN_HCO3, conAlb);
  // AG = 140 − (104 + 21.2) = 14.8; AGc = 14.8 + 2.5×(4−2.1) ≈ 19.55 → 19.5*
  assert.match(out, /\bAG 14\.8\*/);
  assert.match(out, /\bAGc 19\.5\*/);
});

test('parseGaso_ calcula UAG con electrolitos urinarios', () => {
  const conOrina =
    QS_TEXT +
    `
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
  const out = parseGaso_(GAS_VEN_HCO3, conOrina);
  assert.match(out, /\bAG 14\.8\*/);
  assert.match(out, /\bUAG 28\b/);
});

test('parseGaso_ marca anion gap elevado con asterisco', () => {
  const externo = QS_TEXT.replace('104', '95');
  const out = parseGaso_(GAS_VEN_HCO3, externo);
  assert.match(out, /\bAG 23\.8\*/);
});

test('parseGaso_ usa Na/Cl de electrolitos séricos como fuente de química', () => {
  const out = parseGaso_(GAS_VEN_HCO3, ESC_TEXT);
  assert.match(out, /\bAG 18\.8\*/);
});

test('parseGaso_ NO calcula anion gap cuando no hay química disponible', () => {
  const out = parseGaso_(GAS_VEN_HCO3);
  assert.doesNotMatch(out, /\bAG\b/, 'sin texto de química, no debe haber AG');
});

test('parseGaso_ NO usa Na/Cl del bloque de gases (debe ser de química)', () => {
  // Gasometría arterial completa con Na/Cl/HCO3 propios pero SIN química
  // sanguínea adjunta — no se calcula AG.
  const gasArterialCompleta = `GASOMETRIA ARTERIAL COMPLETA
PH	N	7.40
SODIO	N	140	mmol/L	136 - 146
CLORO	N	104	mmol/L	98 - 107
HCO3	N	24.0	mmol/L	22.0 - 26.0
`.replace(/\s+/g, ' ');
  const out = parseGaso_(gasArterialCompleta, '');
  assert.doesNotMatch(out, /\bAG\b/, 'no debe usar Na/Cl del propio bloque de gases');
});

test('parseGaso_ omite anion gap cuando la química no trae cloro', () => {
  const externoSinCl = `QUIMICA SANGUINEA
SODIO	N	140	mmol/L	136 - 146
`.replace(/\s+/g, ' ');
  const out = parseGaso_(GAS_VEN_HCO3, externoSinCl);
  assert.doesNotMatch(out, /\bAG\b/);
});

test('procesarLabs calcula AG combinando gases y electrolitos séricos', () => {
  const reporte = `Expediente:	1	Solicitud:	1
Nombre:	X	Fecha Registro:	May 7 2026 6:43AM
Sexo:	M	Ubicación:	SERVICIO CLÍNICO
Edad:	30	Medico:	X

GASOMETRIAS
GASOMETRIA VENOSA PARCIAL
Estudio		Resultado	Unidades	Valor de Referencia
PH	N	7.40		7.35 - 7.45
HCO3	N	22.0	mmol/L	22.0 - 26.0

ELECTROLITOS SERICOS
SODIO	N	140	mmol/L	136 - 146
CLORO	N	100	mmol/L	98 - 107
`;
  const res = procesarLabs(reporte);
  const lineaGases = (res.resLabs || []).find((l) => /^GASES\b/.test(l));
  assert.ok(lineaGases);
  assert.match(lineaGases, /\bAG 18\*/);
  assert.match(lineaGases, /\bDelta-Delta 3\b/);
});

test('buildGasoInterpretacion_ deshabilitada por política de producto', () => {
  const out = buildGasoInterpretacion_(GAS_VEN_HCO3, QS_TEXT);
  assert.equal(out, '');
});

test('procesarLabs no agrega interpretación de gasometría', () => {
  const reporte = `Expediente:	1	Solicitud:	1
Nombre:	X	Fecha Registro:	May 7 2026 6:43AM
Sexo:	M	Ubicación:	SERVICIO CLÍNICO
Edad:	30	Medico:	X

GASOMETRIAS
GASOMETRIA VENOSA PARCIAL
Estudio		Resultado	Unidades	Valor de Referencia
PH	N	7.31		7.35 - 7.45
pCO2	N	40	mmHg	35 - 45
HCO3	N	18.0	mmol/L	22.0 - 26.0

ELECTROLITOS SERICOS
SODIO	N	140	mmol/L	136 - 146
CLORO	N	100	mmol/L	98 - 107
`;
  const res = procesarLabs(reporte);
  const lineaInterp = (res.resLabs || []).find((l) => /^INTERPRETACIÓN GASOMETRÍA:\t/.test(l));
  assert.equal(lineaInterp, undefined);
});

test('renderEntry normaliza interpretación gasométrica legacy a mayúsculas', () => {
  const html = renderEntry('Interpretación gasometría:\tAcidosis metabólica con compensación respiratoria').join('\n');
  assert.match(html, /INTERPRETACIÓN GASOMETRÍA:/);
  assert.match(html, /ACIDOSIS METABÓLICA CON COMPENSACIÓN RESPIRATORIA/);
  assert.doesNotMatch(html, /Interpretación gasometría/);
  assert.doesNotMatch(html, /Acidosis metabólica/);
});

test('parseGaso_ e interpretación con flags A/B en líneas separadas (SOME)', () => {
  const raw = `GASOMETRIAS
GASOMETRIA VENOSA
PH
A
7.48
PCO2
B
24
HCO3
B
17.9`;
  const out = parseGaso_(raw, '');
  assert.match(out, /pH 7\.48/);
  const interp = buildGasoInterpretacion_(raw, '');
  assert.equal(interp, '');
});

test('buildGasoInterpretacion_ deshabilitada para gasometría venosa', () => {
  const raw = `
GASOMETRIAS
GASOMETRIA VENOSA
PH	A	7.48
PCO2	B	24
HCO3	B	17.9
`.replace(/\s+/g, ' ');
  const interp = buildGasoInterpretacion_(raw, '');
  assert.equal(interp, '');
});

test('buildGasoInterpretacion_ no muestra línea si faltan datos mínimos', () => {
  const soloPH = `GASOMETRIA VENOSA PARCIAL
PH	N	7.40
`.replace(/\s+/g, ' ');
  const out = buildGasoInterpretacion_(soloPH, '');
  assert.equal(out, '');
});

test('reprocessLabResultLines_ depura GASES duplicados y recalcula AG sin interpretación', () => {
  const inRows = [
    'QS\tGlu 142 Cr 7.9 BUN 42',
    'ESC\tNa 133.4 Cl 98.7 K 3.9',
    'GASES\tpH 7.39 pCO2 35 pO2 60 Lactato 0.7 Bica 21.2',
    'GASES\tpH 7.39 pCO2 35 pO2 60 Lactato 0.7 Bica 21.2 iCa 0.92',
    'INTERPRETACIÓN GASOMETRÍA:\tpH casi normal; posible acidosis metabólica compensada',
  ];
  const out = reprocessLabResultLines_(inRows);
  const gases = out.filter((l) => /^GASES\t/.test(l));
  const interp = out.filter((l) => /^INTERPRETACIÓN GASOMETRÍA:\t/.test(l));
  assert.equal(gases.length, 1, 'debe quedar una sola línea GASES');
  assert.equal(interp.length, 0, 'sin interpretación ABG');
  assert.match(gases[0], /\bAG 13\.5\*/);
  assert.match(gases[0], /\bDelta-Delta 0\.5\b/);
});

test('reprocessLabResultLines_ preserva asteriscos de gasometría al reconstruir GASES', () => {
  const inRows = [
    'ESC\tNa 133.4 Cl 98.7 K 3.9',
    'GASES\tpH 7.4 pCO2 23* pO2 59* Lactato 11.2* Bica 14.2* AG 23.8*',
  ];
  const out = reprocessLabResultLines_(inRows);
  const gases = out.find((l) => /^GASES\t/.test(l));
  assert.ok(gases);
  assert.match(gases, /\bpCO2 23\*/);
  assert.match(gases, /\bpO2 59\*/);
  assert.match(gases, /\bLactato 11\.2\*/);
  assert.match(gases, /\bBica 14\.2\*/);
});

test('reprocessLabResultLines_ remarca gasometría con refs del reporte', () => {
  const inRows = [
    'ESC\tNa 133.4 Cl 98.7 K 3.9',
    'GASES\tpH 7.4 pCO2 23 pO2 59 Lactato 11.2 Bica 14.2',
  ];
  const gasRefs = {
    pCO2: [35, 45],
    pO2: [83, 100],
    Lactato: [0.5, 2.2],
    Bica: [22, 28],
  };
  const out = reprocessLabResultLines_(inRows, { gasRefs });
  const gases = out.find((l) => /^GASES\t/.test(l));
  assert.ok(gases);
  assert.match(gases, /\bpCO2 23\*/);
  assert.match(gases, /\bpO2 59\*/);
  assert.match(gases, /\bLactato 11\.2\*/);
  assert.match(gases, /\bBica 14\.2\*/);
  assert.doesNotMatch(gases, /\bpH 7\.4\*/);
});

test('procesarLabs NO calcula AG en reporte solo de gasometría', () => {
  const res = procesarLabs(MUESTRA_GASO_VENOSA);
  const lineaGases = (res.resLabs || []).find((l) => /^GASES\b/.test(l));
  assert.ok(lineaGases);
  assert.doesNotMatch(lineaGases, /\bAG\b/);
});

/** Química de orina bajo encabezado QUIMICA CLINICA (no debe llenar QS/ESC séricos). */
const MUESTRA_QUIMICA_ORINA = `
QUIMICA CLINICA
POTASIO EN ORINA
Estudio		Resultado	Unidades	Valor de Referencia
POTASIO EN ORINA
B
22
mmol/L	40 - 80
SODIO URINARIO
Estudio		Resultado	Unidades	Valor de Referencia
SODIO EN ORINA
B
40
mmol/L	80 - 180
CREATININA EN ORINA
Estudio		Resultado	Unidades	Valor de Referencia
CREATININA EN ORINA
A
53.99
mg/dL	0.00 - 0.00
COMENTARIO DE MUESTRA
*
CLORO EN ORINA: 34mmol/L
`.replace(/\s+/g, ' ');

test('parseESC_ y parseQS_ ignoran electrolitos y creatinina de orina', () => {
  assert.equal(parseESC_(MUESTRA_QUIMICA_ORINA), '');
  assert.equal(parseQS_(MUESTRA_QUIMICA_ORINA), '');
});

test('parseESC_ sigue tomando sodio sérico si también hay química de orina', () => {
  const t = (MUESTRA_QUIMICA_ORINA + ' ' + ESC_TEXT).replace(/\s+/g, ' ');
  assert.match(parseESC_(t), /\bNa 140\b/);
});

test('procesarLabs no emite ESC ni QS con valores urinarios en reporte solo orina', () => {
  const raw = `Expediente:\t2128960-1
Nombre:\tTEST PACIENTE
QUIMICA CLINICA
POTASIO EN ORINA
B
22
mmol/L	40 - 80
SODIO EN ORINA
B
40
mmol/L	80 - 180
CREATININA EN ORINA
A
53.99
mg/dL	0.00 - 0.00
COMENTARIO DE MUESTRA
*
CLORO EN ORINA: 34mmol/L
URIANALISIS
EXAMEN GENERAL DE ORINA
FISICO
COLOR
Amarillo
PH
B
5.0
5.5 - 6.5
DENSIDAD
1.014
`;
  const res = procesarLabs(raw);
  assert.ok(!res.resLabs.some((l) => l.startsWith('ESC\t')), 'no debe haber línea ESC');
  assert.ok(!res.resLabs.some((l) => l.startsWith('QS\t')), 'no debe haber línea QS');
  const ego = res.resLabs.find((l) => l.startsWith('EGO:'));
  assert.ok(ego, 'debe conservar EGO');
  assert.match(ego, /\bNaU 40\b/);
  assert.match(ego, /\bKU 22\b/);
  assert.match(ego, /\bClU 34\b/);
  assert.match(ego, /\bCrU 53\.99\b/);
});

test('buildGasoInterpretacion_ deshabilitada con química y gases', () => {
  const gas = `GASOMETRIA VENOSA PARCIAL
PH	N	7.31
pCO2	N	30
HCO3	N	18.0
`.replace(/\s+/g, ' ');
  const quimica = `QUIMICA SANGUINEA
SODIO	N	140
CLORO	N	107
`.replace(/\s+/g, ' ');
  const out = buildGasoInterpretacion_(gas, quimica);
  assert.equal(out, '');
});
