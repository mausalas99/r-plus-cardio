import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCultivo_,
  procesarLabs,
  extractMicSortKey,
  buildAtbRisSummaryHtml,
  formatCultivoCondensedForCopy,
  isParsedCultivoHeaderLine,
  extractSensCrudasForGermFromSource,
  parseCuentaFromCultivoChunkLines,
} from '../../../public/js/labs.js';

const norm = (t) => t.replace(/\s+/g, ' ');

test('parseCuentaFromCultivoChunkLines extrae UFC del bloque condensado', () => {
  const cuenta = parseCuentaFromCultivoChunkLines([
    'ATB R: CAZ',
    'Cuenta: 3,200 UFC/ML',
  ]);
  assert.equal(cuenta, '3,200 UFC/ML');
});

test('urocultivo: tipo y germen (sin muestra útil tras PRODUCTO)', () => {
  const raw = `
BACTERIOLOGIA
Estudio		Resultado
UROCULTIVO POR SONDA
PRODUCTO	
*
TINCION DE GRAM	
*
MICROORGANISMO	
*
Escherichia coli
COMENTARIO:	
*
CUENTA DE KASS	
*
+100,000 UFC/mL
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /UROCULTIVO POR SONDA/i);
  assert.match(out, /ESCHERICHIA COLI/i);
  assert.ok(!out.includes('TINCION'), 'no debe usar TINCION como muestra');
});

test('hemocultivo: tipo y muestra (PRODUCTO)', () => {
  const raw = `
BACTERIOLOGIA
HEMOCULTIVO
PRODUCTO	
*
CATETER NIAGARA
MICROORGANISMO	
*
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /HEMOCULTIVO/);
  assert.match(out, /\(CATETER NIAGARA\)/);
});

test('hemocultivo positivo: periférico y pseudomonas', () => {
  const raw = `
Nombre:	GONZALEZ PEREZ BRANDON
Fecha Registro:	14/02/2026 02:18:16 p. m.
BACTERIOLOGIA
HEMOCULTIVO
PRODUCTO	
*
PERIFERICO IZQUIERDO
MICROORGANISMO	
*
Pseudomonas aeruginosa
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /HEMOCULTIVO \(PERIFERICO IZQUIERDO\)/);
  assert.match(out, /PSEUDOMONAS AERUGINOSA/);
  assert.match(out, /14\/02/);
});

test('cultivo catéter: tipo CATETER y punta CVC', () => {
  const raw = `
BACTERIOLOGIA
CATETER
PRODUCTO	
*
PUNTA CVC
MICROORGANISMO	
*
Pseudomonas aeruginosa
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /CATETER \(PUNTA CVC\)/);
  assert.match(out, /PSEUDOMONAS/);
});

test('secreción de herida con muestra entre paréntesis: parse y cabecera para Cultivos', () => {
  const raw = `
Nombre:	VAZQUEZ MARTINEZ GABINO GABRIEL	Fecha Registro:	24/05/2026 12:47:53 p. m.
BACTERIOLOGIA
Estudio		Resultado
SECRECION DE HERIDA
PRODUCTO	
*
HERIDA DE TRAQUEOSTOMIA
MICROORGANISMO	
*
Pseudomonas aeruginosa
ANTIBIOGRAMA	
*
CEFTAZIDIMA
4	S
CIPROFLOXACINA
<=1	S
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  const header = out.split('\n\n')[0].split('\n')[0];
  assert.match(out, /SECRECION DE HERIDA/i);
  assert.match(out, /HERIDA DE TRAQUEOSTOMIA/i);
  assert.match(out, /PSEUDOMONAS AERUGINOSA/i);
  assert.strictEqual(isParsedCultivoHeaderLine(header), true, 'debe mostrarse en pestaña Cultivos');
});

test('cultivo líquido peritoneal: tipo, pseudomonas y antibiograma', () => {
  const raw = `
Expediente:	1929604-8	Solicitud:	2605071010
Nombre:	CORONADO PALOMO RAUL	Fecha Registro:	07/05/2026 04:32:46 p. m.
Sexo:	MASCULINO	Ubicación:	NEUROMEDICA
Edad:	69	Medico:	A QUIEN CORRESPONDA
BACTERIOLOGIA
Estudio		Resultado	Unidades	Valor de Referencia
LIQUIDO PERITONEAL
PRODUCTO	
*
TINCION DE GRAM	
*
ESCASOS BACILOS GRAM NEGATIVO
CALIDAD DE LA MUESTRA	
*
ESTADO DE CULTIVO	
*
*
MICROORGANISMO	
*
Pseudomonas aeruginosa
COMENTARIO:	
*
CUENTA	
*
X
ANTIBIOGRAMA	
*
CEFTAZIDIMA
>16	R
*
CIPROFLOXACINA
<=1	S
*
CEFEPIMA
16	I
*
IMIPENEM
2	S
*
LEVOFLOXACINA
<=2	S
*
MEROPENEM
<=1	S
*
PIP/TAZO
64	S
*
TOBRAMICINA
<=4	S
*
MICROORGANISMO	
*
COMENTARIO:	
*
CUENTA	
*
*
IDENTIFICACION POR ESPECTROMETRIA DE MASAS (MALDI TOF)
MICROORGANISMO	
*
`;
  const out = parseCultivo_(raw, norm(raw));
  assert.match(out, /LIQUIDO PERITONEAL 07\/05: PSEUDOMONAS AERUGINOSA/);
  assert.doesNotMatch(out, /NEUROMEDICA/i);
  assert.match(out, /\bATB R: CAZ \| I: FEP\b/);
  assert.match(out, /S: CIPRO, IMI, LVX, MERO, PIP\/TAZO, TOBRA/);
});

test('urocultivo: detecta BLEE por comentario y ESBL en antibiograma', () => {
  const raw = `
Expediente:	2211202-9
Fecha Registro:	29/04/2026 03:00:39 p. m.
BACTERIOLOGIA
UROCULTIVO POR SONDA
PRODUCTO	
*
MICROORGANISMO	
*
Klebsiella pneumoniae
COMENTARIO:	
*
AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)
CUENTA DE KASS	
*
+100,000 UFC/mL
ANTIBIOGRAMA	
*
CEFTRIAXONA
>32	ESBL
*
CEFOXITINA
<=8	S
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /KLEBSIELLA PNEUMONIAE/i);
  assert.match(out, /\bBLEE\b/);
  assert.match(out, /\bATB\b/);
  assert.match(out, /ESBL:/i);
  assert.match(out, /CFTX|CTX|CEFTRI/i);
  assert.match(out, /Cuenta:.*100,000.*UFC/i);
});

test('urocultivo polimicrobiano: Klebsiella y Enterococcus con ATB por germen', () => {
  const raw = `
BACTERIOLOGIA
UROCULTIVO POR SONDA
PRODUCTO
*
MICROORGANISMO
*
Klebsiella pneumoniae
COMENTARIO:
AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)
CUENTA DE KASS
*
+100,000 UFC/mL
ANTIBIOGRAMA
*
CEFTRIAXONA
>32	ESBL
*
MICROORGANISMO
*
Enterococcus faecium
COMENTARIO:
*
CUENTA DE KASS
*
+100,000 UFC/mL
ANTIBIOGRAMA
*
AMPICILINA
>8	R
*
VANCOMICINA
<=0.5	S
*
IDENTIFICACION POR ESPECTROMETRIA DE MASAS (MALDI TOF)
MICROORGANISMO
*
`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /KLEBSIELLA PNEUMONIAE/i);
  assert.match(out, /ENTEROCOCCUS FAECIUM/i);
  assert.match(out, /\bBLEE\b/);
  const kIdx = out.indexOf('KLEBSIELLA');
  const eIdx = out.indexOf('ENTEROCOCCUS');
  assert.ok(kIdx !== -1 && eIdx !== -1 && kIdx < eIdx, 'orden: Klebsiella antes que Enterococcus');
  assert.match(out, /\bAMP\b|\bAMPICILINA/i);
});

test('comentario: carbapenemasa NDM y fenotipo Carb-R', () => {
  const raw = `
BACTERIOLOGIA
UROCULTIVO POR SONDA
MICROORGANISMO
Klebsiella pneumoniae
COMENTARIO:
PRODUCTOR DE NDM-1
CUENTA DE KASS
+10,000 UFC/mL
`;
  const out = parseCultivo_(raw, norm(raw));
  assert.match(out, /\bNDM\b|\bNDM-1\b/i);
});

test('comentario: resistencia carbapenemicos sin enzima nombrada → Carb-R', () => {
  const raw = `
BACTERIOLOGIA
MICROORGANISMO
Acinetobacter baumannii
COMENTARIO:
RESISTENTE A CARBAPENEMICOS
`;
  const out = parseCultivo_(raw, norm(raw));
  assert.match(out, /Acinetobacter baumannii/i);
  assert.match(out, /Carb-R|CRE/i);
});

test('procesarLabs: Ubicación del encabezado es del paciente (no se antepone al cultivo)', () => {
  const raw = [
    'Expediente:\t1\tSolicitud:\t2',
    'Nombre:\tPACIENTE\tFecha Registro:\t07/05/2026',
    'Sexo:\tMASCULINO\tUbicación:\tNEUROMEDICA',
    'Edad:\t69',
    'BACTERIOLOGIA',
    'UROCULTIVO POR SONDA',
    'PRODUCTO',
    '*',
    'MICROORGANISMO',
    '*',
    'Escherichia coli',
  ].join('\n');
  const r = procesarLabs(raw);
  assert.equal(r.patient.ubicacion, 'NEUROMEDICA');
  const joined = (r.resLabs || []).join('\n');
  assert.doesNotMatch(joined, /NEUROMEDICA/i);
  assert.match(joined, /UROCULTIVO|POR SONDA|Escherichia coli/i);
});

test('extractMicSortKey: primer valor numérico del CMI', () => {
  assert.equal(extractMicSortKey('<=8'), 8);
  assert.equal(extractMicSortKey('>=256'), 256);
  assert.equal(extractMicSortKey('\u226564'), 64);
  assert.ok(Number.isNaN(extractMicSortKey('')));
});

test('formatCultivoCondensedForCopy: cabecera con dd/mm, ATB y cuenta', () => {
  const chunk = [
    'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
    'ATB R: CAZ | I: FEP | S: CIPRO, IMI, LVX, MERO, PIP/TAZO, TOBRA',
    'Cuenta: +100 UFC',
  ].join('\n');
  const out = formatCultivoCondensedForCopy(chunk, '07/05/2026');
  assert.equal(
    out,
    'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA\nATB R: CAZ | I: FEP | S: CIPRO, IMI, LVX, MERO, PIP/TAZO, TOBRA\nCuenta: +100 UFC'
  );
});

test('formatCultivoCondensedForCopy: sin Preliminar ni fecha/hora del envío', () => {
  const chunk = 'ASPIRADO TRAQUEAL 29/05: PROTEUS MIRABILIS · Preliminar\nCuenta: +100,000 UFC/ML';
  const out = formatCultivoCondensedForCopy(chunk, '29/05/2026 17:11');
  assert.equal(
    out,
    'ASPIRADO TRAQUEAL 29/05: PROTEUS MIRABILIS\nCuenta: +100,000 UFC/ML'
  );
});

test('micobacterias: baciloscopia y cultivo con muestra en OBSERVACIONES', () => {
  const raw = `Expediente:\t2007285-3\tSolicitud:\t2605250577
Nombre:\tVELAZQUEZ GARCIA MIGUEL ANGEL\tFecha Registro:\t25/05/2026 09:37:01 a. m.
Sexo:\tMASCULINO\tUbicación:\tSERVICIO CLÍNICO 2
Edad:\t53\tMedico:\tA QUIEN CORRESPONDA

MYCOBACTERIAS
Estudio\t\tResultado\tUnidades\tValor de Referencia
BACILOSCOPIA DE PRODUCTOS DIVERSOS (1 MUESTRA)
1 MUESTRA\t
*
NEGATIVO
OBSERVACIONES\t
*
TEJIDO DE LENGUA
CULTIVO DE MICOBACTERIAS (POR MUESTRA)
SECCION DE MICOBACTERIAS\t
*
REPORTE PRELIMINAR MOP-647-07-RC-052
CULTIVO\t
*
NEGATIVO A LA FECHA.`;
  const tNorm = norm(raw);
  const out = parseCultivo_(raw, tNorm);
  assert.match(out, /BACILOSCOPIA DE PRODUCTOS DIVERSOS.*25\/05:\s*NEGATIVO/i);
  assert.match(out, /CULTIVO DE MICOBACTERIAS.*25\/05:\s*NEGATIVO A LA FECHA/i);
  assert.match(out, /TEJIDO DE LENGUA/i);
  assert.ok(!/CULTIVO \(1 MUESTRA\)/i.test(out), 'no debe confundir 1 MUESTRA con sitio');
  const lines = out.split('\n\n');
  assert.equal(lines.length, 2);
  assert.ok(isParsedCultivoHeaderLine(lines[0]));
  assert.ok(isParsedCultivoHeaderLine(lines[1]));
});

test('buildAtbRisSummaryHtml: títulos por categoría y orden S por CMI ascendente', () => {
  const sens = [
    { med: 'AAA', mic: '16', interp: 'S' },
    { med: 'BBB', mic: '4', interp: 'S' },
    { med: 'CCC', mic: '≥64', interp: 'R' },
    { med: 'DDD', mic: '8', interp: 'I' },
  ];
  const h = buildAtbRisSummaryHtml(sens);
  assert.match(h, /Resistencias/);
  assert.match(h, /Indeterminado/);
  assert.match(h, /Sensible/);
  const idxBbb = h.indexOf('atb-ris-drug">BBB<');
  const idxAaa = h.indexOf('atb-ris-drug">AAA<');
  assert.ok(idxBbb > 0 && idxAaa > idxBbb, 'en S, menor CMI primero');
});

function countCultivoChunks(resLabs) {
  let n = 0;
  const joined = (resLabs || []).join('\n\n');
  joined.split(/\n\n+/).forEach(function (sec) {
    const lines = sec
      .split(/\r?\n/)
      .map(function (l) {
        return l.replace(/\*+$/g, '').trim();
      })
      .filter(Boolean);
    if (lines.length && isParsedCultivoHeaderLine(lines[0])) n += 1;
  });
  return n;
}

function cultivoTextFromResLabs(resLabs) {
  return (resLabs || []).find(function (r) {
    return /BACTERIOLOGIA|UROCULTIVO|HEMOCULTIVO|ASPIRADO|LIQUIDO|MICROORGANISMO/i.test(String(r));
  }) || (resLabs || [])[0] || '';
}

/** G5 — Zúñiga: preliminar, 3 gérmenes, sin antibiograma */
const G5_ZUNIGA_PRELIM = `Expediente:\t2212537-0\tSolicitud:\t2605261033
Nombre:\tZUNIGA TAVARES EFRAIN\tFecha Registro:\t26/5/2026 15:59:36
Sexo:\tMASCULINO\tUbicación:\tCIRUGIA A.C.
Edad:\t63\tMedico:\tA QUIEN CORRESPONDA
BACTERIOLOGIA
Estudio\t\tResultado\tUnidades\tValor de Referencia
ASPIRADO TRAQUEAL
PRODUCTO\t
*
ESTADO DE CULTIVO\t
*
REPORTE PRELIMINAR
*
MICROORGANISMO\t
*
Acinetobacter baumannii
COMENTARIO:\t
*
CUENTA\t
*
+100,000 UFC/mL
*
MICROORGANISMO\t
*
Proteus mirabilis
COMENTARIO:\t
*
CUENTA\t
*
+100,000 UFC/mL
*
MICROORGANISMO\t
*
COMENTARIO:\t
*
CUENTA\t
*
*
MICROORGANISMO\t
*
Stenotrophomonas maltophilia
COMENTARIO:\t
*
CUENTA\t
*
50,000 UFC/mL
*
MICROORGANISMO\t
*
COMENTARIO:\t
*
CUENTA\t
*
*`;

/** G2 — urocultivo con carbapenemasa en comentario */
const G2_URO_CARBAPENEMASA = `Expediente:\t0768636-4\tSolicitud:\t2605050805
Nombre:\tCASTILLO\tFecha Registro:\t05/05/2026 06:16:18 p. m.
BACTERIOLOGIA
UROCULTIVO POR SONDA
PRODUCTO\t
*
MICROORGANISMO\t
*
Pseudomonas aeruginosa
COMENTARIO:\t
*
SE DETECTO CARBAPENEMASA. (METODO DE INACTIVACION DE DISCO)
CUENTA DE KASS\t
*
50,000 UFC/mL
ANTIBIOGRAMA\t
*
IMIPENEM
>4\tR
*
PIP/TAZO
<=16\tS
*`;

/** G1 — aspirado 2 gérmenes + ATB */
const G1_ASPIRADO_2G = `Expediente:\t0768636-4\tSolicitud:\t2605181061
Nombre:\tCASTILLO\tFecha Registro:\t18/05/2026 04:58:48 p. m.
BACTERIOLOGIA
ASPIRADO TRAQUEAL
PRODUCTO\t
*
MICROORGANISMO\t
*
Escherichia coli
COMENTARIO:\t
*
AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)
CUENTA\t
*
50,000 UFC/mL
ANTIBIOGRAMA\t
*
CEFTRIAXONA
>32\tESBL
*
AMIKACINA
<=16\tS
*
MICROORGANISMO\t
*
Acinetobacter baumannii complex
CUENTA\t
*
80,000 UFC/mL
ANTIBIOGRAMA\t
*
IMIPENEM
>4\tR
*
COLISTINA
<=2\tI
*`;

/** G3 — aspirado 3 gérmenes; S. aureus con BLAC */
const G3_ASPIRADO_3G = `Expediente:\t0768636-4\tSolicitud:\t2604280886
Nombre:\tCASTILLO\tFecha Registro:\t28/04/2026 01:45:42 p. m.
BACTERIOLOGIA
ASPIRADO TRAQUEAL
MICROORGANISMO\t
*
Escherichia coli
COMENTARIO:\t
*
AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)
CUENTA\t
*
100,000 UFC/mL
ANTIBIOGRAMA\t
*
CEFTRIAXONA
>32\tESBL
*
MICROORGANISMO\t
*
Staphylococcus aureus
CUENTA\t
*
20,000 UFC/mL
ANTIBIOGRAMA\t
*
PENICILINA
>8\tBLAC
*
VANCOMICINA
1\tS
*
MICROORGANISMO\t
*
Proteus mirabilis
COMENTARIO:\t
*
AISLAMIENTO PRODUCTOR DE BETALACTAMASAS (BLEE)
CUENTA\t
*
100 UFC/mL
ANTIBIOGRAMA\t
*
PIP/TAZO
<=16\tS
*`;

/** G4 — líquido peritoneal, slot MICROORGANISMO vacío */
const G4_PERITONEAL = `Expediente:\t1929604-8\tSolicitud:\t2605200870
Nombre:\tCORONADO\tFecha Registro:\t20/05/2026 02:04:18 p. m.
BACTERIOLOGIA
LIQUIDO PERITONEAL
PRODUCTO\t
*
MICROORGANISMO\t
*
Pseudomonas aeruginosa
ANTIBIOGRAMA\t
*
CIPROFLOXACINA
<=1\tS
*
IMIPENEM
2\tS
*
MICROORGANISMO\t
*
COMENTARIO:\t
*
CUENTA\t
*`;

test('G5 preliminar Zúñiga: 3 filas Cultivos, Preliminar y UFC formateada', () => {
  const { resLabs } = procesarLabs(G5_ZUNIGA_PRELIM);
  assert.equal(countCultivoChunks(resLabs), 3);
  const cult = cultivoTextFromResLabs(resLabs);
  assert.match(cult, /ASPIRADO TRAQUEAL 26\/05: ACINETOBACTER BAUMANNII · Preliminar/i);
  assert.match(cult, /ASPIRADO TRAQUEAL 26\/05: PROTEUS MIRABILIS · Preliminar/i);
  assert.match(cult, /ASPIRADO TRAQUEAL 26\/05: STENOTROPHOMONAS MALTOPHILIA · Preliminar/i);
  assert.match(cult, /Cuenta: \+100,000 UFC\/ML/i);
  assert.match(cult, /Cuenta: 50,000 UFC\/ML/i);
  assert.doesNotMatch(cult, /ATB\b/i);
});

test('G2 urocultivo: Carb-R por comentario carbapenemasa', () => {
  const { resLabs } = procesarLabs(G2_URO_CARBAPENEMASA);
  assert.equal(countCultivoChunks(resLabs), 1);
  const cult = cultivoTextFromResLabs(resLabs);
  assert.match(cult, /UROCULTIVO POR SONDA 05\/05: PSEUDOMONAS AERUGINOSA/i);
  assert.match(cult, /Carb-R/i);
  const sens = extractSensCrudasForGermFromSource(G2_URO_CARBAPENEMASA, 'Pseudomonas');
  assert.ok(sens && sens.length >= 2);
});

test('G1 aspirado: 2 filas, BLEE solo en E. coli', () => {
  const { resLabs } = procesarLabs(G1_ASPIRADO_2G);
  assert.equal(countCultivoChunks(resLabs), 2);
  const cult = cultivoTextFromResLabs(resLabs);
  assert.match(cult, /ESCHERICHIA COLI.*BLEE/i);
  const abHead = cult.split(/\n\n+/)[1].split('\n')[0];
  assert.match(abHead, /ASPIRADO TRAQUEAL 18\/05: ACINETOBACTER BAUMANNII/i);
  assert.doesNotMatch(abHead, /BLEE/i);
  const ecoli = extractSensCrudasForGermFromSource(G1_ASPIRADO_2G, 'Escherichia coli');
  const abau = extractSensCrudasForGermFromSource(G1_ASPIRADO_2G, 'Acinetobacter');
  assert.ok(ecoli && ecoli.length >= 2);
  assert.ok(abau && abau.length >= 2);
});

test('G3 aspirado: 3 filas y BLAC en S. aureus', () => {
  const { resLabs } = procesarLabs(G3_ASPIRADO_3G);
  assert.equal(countCultivoChunks(resLabs), 3);
  const sa = extractSensCrudasForGermFromSource(G3_ASPIRADO_3G, 'Staphylococcus aureus');
  const pen = sa && sa.find((s) => /PENICILINA/i.test(s.med));
  assert.ok(pen && pen.interp === 'BLAC');
});

test('G4 líquido peritoneal: un germen, slot vacío ignorado', () => {
  const { resLabs } = procesarLabs(G4_PERITONEAL);
  assert.equal(countCultivoChunks(resLabs), 1);
  assert.match(cultivoTextFromResLabs(resLabs), /LIQUIDO PERITONEAL 20\/05: PSEUDOMONAS AERUGINOSA/i);
});
