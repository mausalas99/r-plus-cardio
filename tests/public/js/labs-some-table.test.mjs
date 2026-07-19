import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSomeReportTables,
  buildSomeGroupTsv,
  buildSomeGroupExportModel,
  formatSomeResultado,
  renderSomeReportTablesHtml,
} from '../../../public/js/labs-some-table.mjs';

const MUESTRA_LUNA = `
Expediente:	2140307-1	Solicitud:	2506101040
Nombre:	LUNA RODRIGUEZ ROGELIO OMAR	Fecha Registro:	10/06/2025 03:41:29 p. m.
Sexo:	MASCULINO	Ubicación:	EMERGENCIAS SHOCK TRAUMA CONSULTA
Edad:	43	Medico:	A QUIEN CORRESPONDA

BACTERIOLOGIA
Estudio		Resultado	Unidades	Valor de Referencia
FIBRAS VEGETALES
FIBRAS VEGETALES	
*
NEGATIVO
TIPO DE MUESTRA	
*
CITOQUIMICO DE LIQUIDOS CORPORALES
RECUENTO	
A
112
LEUCOCITOS/MM3	0.00 - 5.00
ASPECTO	
*
XANTOCROMICO
POLIMORFONUCLEARES	
*
60
%	
LINFOCITOS	
*
40
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

QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
CITOQUIMICO DE LIQUIDOS CORPORALES
EXAMEN QUIMICO	
*
:
DENSIDAD	
*
1.010
PH	
*
7.5
GLUCOSA	
*
78.0
mg/dL	
PROTEINAS	
*
5100
mg/dL	
LDH	
*
77
IU/L	
CITOQUIMICO DE	
*
LIQUIDO DE ASCITIS
ALBUMINA
ALBUMINA	
B
2.8
g/dL	3.2 - 5.5
COLESTEROL
COLESTEROL	
B
56
mg/dL	130 - 200
TRIGLICERIDOS
TRIGLICERIDOS	
*
40
mg/dL	35 - 150
`;

const MUESTRA_BH = `
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
MCH	
B
25.9
pg	27.0 - 31.2
RDW	
A
16.9
%	11.6 - 14.8
`;

test('parseSomeReportTables — bacteriología y química (Luna)', () => {
  const parsed = parseSomeReportTables(MUESTRA_LUNA);
  assert.equal(parsed.departments.length, 2);
  assert.equal(parsed.departments[0].key, 'BACTERIOLOGIA');
  assert.equal(parsed.departments[1].key, 'QUIMICA CLINICA');

  const bact = parsed.departments[0];
  const fibras = bact.groups.find((g) => g.title === 'FIBRAS VEGETALES');
  assert.ok(fibras);
  assert.equal(fibras.rows[0].estudio, 'FIBRAS VEGETALES');
  assert.equal(fibras.rows[0].resultado, 'NEGATIVO');

  const citoBact = bact.groups.find((g) => g.title === 'CITOQUIMICO DE LIQUIDOS CORPORALES');
  assert.ok(citoBact);
  assert.equal(citoBact.tableVariant, 'cito');
  assert.equal(citoBact.fluidSource, 'PERITONEAL');
  assert.equal(citoBact.rows.some((r) => r.estudio === 'COMENTARIO'), false);
  const rec = citoBact.rows.find((r) => r.estudio === 'RECUENTO');
  assert.ok(rec);
  assert.equal(rec.flag, 'A');
  assert.equal(rec.resultado, '112');
  assert.equal(rec.unidades, 'LEUCOCITOS/MM3');
  assert.equal(formatSomeResultado(rec), '112 LEUCOCITOS/MM3');
  assert.equal(rec.ref, '0.00 - 5.00');
  assert.equal(rec.abnormal, true);

  const qs = parsed.departments[1];
  const citoQs = qs.groups.find((g) => g.tableVariant === 'cito');
  const flatQs = qs.groups.find((g) => g.title === '');
  assert.ok(citoQs);
  assert.ok(flatQs);
  assert.equal(citoQs.rows.find((r) => r.estudio === 'DENSIDAD').resultado, '1.010');
  assert.equal(citoQs.rows.find((r) => r.estudio === 'GLUCOSA').resultado, '78.0');
  assert.equal(citoQs.rows.some((r) => r.estudio === 'EXAMEN QUIMICO'), false);

  const alb = flatQs.rows.find((r) => r.estudio === 'ALBUMINA');
  assert.ok(alb);
  assert.equal(alb.flag, 'B');
  assert.equal(alb.resultado, '2.8');
  assert.equal(formatSomeResultado(alb), '2.8 g/dL');
});

test('parseSomeReportTables — hematología con flags A/B', () => {
  const parsed = parseSomeReportTables(MUESTRA_BH);
  assert.equal(parsed.departments.length, 1);
  const bh = parsed.departments[0].groups[0];
  assert.equal(bh.title, 'BIOMETRIA HEMATICA COMPLETA');
  const wbc = bh.rows.find((r) => r.estudio === 'WBC');
  assert.equal(wbc.flag, 'A');
  assert.equal(wbc.abnormal, true);
  assert.equal(formatSomeResultado(wbc), '19.60 K/uL');
});

test('buildSomeGroupTsv — resultado con unidades y referencia', () => {
  const parsed = parseSomeReportTables(MUESTRA_BH);
  const group = parsed.departments[0].groups[0];
  const tsv = buildSomeGroupTsv(group, 'BH');
  assert.match(tsv, /^BH\n/);
  assert.match(tsv, /^Estudio\tResultado\tValor de Referencia/m);
  assert.doesNotMatch(tsv, /\tUnidades\t/);
  assert.match(tsv, /HGB\t12\.40 g\/dL\t12\.20 - 18\.10/);
});

test('buildSomeGroupExportModel — citoquímico sin columna de referencia', () => {
  const parsed = parseSomeReportTables(MUESTRA_LUNA);
  const cito = parsed.departments[0].groups.find((g) => g.tableVariant === 'cito');
  const model = buildSomeGroupExportModel(cito);
  assert.equal(model.columns.length, 1);
  assert.equal(model.theme, 'some-cito');
  assert.equal(model.rows[0].cells.length, 1);
});

test('parseSomeReportTables — cultivos: CUENTA con COMENTARIO vacío y polimicrobiano', () => {
  const raw = `Expediente:\t0768636-4\tSolicitud:\t2605291063
BACTERIOLOGIA
Estudio\t\tResultado\tUnidades\tValor de Referencia
ASPIRADO TRAQUEAL
PRODUCTO\t
*
TINCION DE GRAM\t
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
3,200 UFC/mL
*
MICROORGANISMO\t
*
Proteus mirabilis
COMENTARIO:\t
*
CUENTA\t
*
50,000 UFC/mL
*`;
  const parsed = parseSomeReportTables(raw);
  const bact = parsed.departments.find((d) => d.key === 'BACTERIOLOGIA');
  assert.ok(bact);
  const aspirado = bact.groups.find((g) => g.title === 'ASPIRADO TRAQUEAL');
  assert.ok(aspirado);
  const cuentaRows = aspirado.rows.filter((r) => /^CUENTA/i.test(r.estudio));
  assert.equal(cuentaRows.length, 2);
  assert.equal(cuentaRows[0].resultado, '3,200 UFC/mL');
  assert.equal(cuentaRows[1].resultado, '50,000 UFC/mL');
  const micro = aspirado.rows.filter((r) => /^MICROORGANISMO/i.test(r.estudio));
  assert.equal(micro.length, 2);
  assert.equal(micro[0].resultado, 'Acinetobacter baumannii');
  assert.equal(micro[1].resultado, 'Proteus mirabilis');
});

test('renderSomeReportTablesHtml — genera tablas por departamento', () => {
  const parsed = parseSomeReportTables(MUESTRA_LUNA);
  const html = renderSomeReportTablesHtml(parsed);
  assert.match(html, /lab-some-dept-header.*BACTERIOLOGIA/);
  assert.match(html, /lab-some-fluid-source/);
  assert.match(html, /PERITONEAL/);
  assert.match(html, /lab-some-table--cols-2/);
  assert.match(html, /lab-some-table--cols-3/);
  assert.doesNotMatch(html, /<th>Unidades<\/th>/);
});

test('parseSomeReportTables — química clínica, biometría y EGO completos', () => {
  const QS = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
ALBUMINA
ALBUMINA	
*
4.5
g/dL	3.2 - 5.5
BILIRRUBINA
BILIRRUBINA TOTAL	
A
1.6
mg/dL	0.2 - 1.0
BILIRRUBINA DIRECTA	
A
0.7
mg/dL	0.0 - 0.2
SODIO
SODIO	
B
124.3
mmol/L	135.0 - 145.0
`;
  const EGO = `
EXAMEN GENERAL DE ORINA
Estudio		Resultado	Unidades	Valor de Referencia
FISICO
COLOR	
*
AMARILLO OSCURO
QUIMICO
PH	
B
5.0
5.5 - 6.5
PROTEINAS	
*
30
mg/dL	NEGATIVO
SEDIMENTO
LEUCOCITOS	
*
0-2
/CAMPO	0-5/CAMPO
`;
  const BH = `
HEMATOLOGIA
BIOMETRIA HEMATICA COMPLETA
Estudio		Resultado	Unidades	Valor de Referencia
HGB	
*
13.50
g/dL	12.20 - 18.10
TIEMPO DE PROTROMBINA Y TROMBOPLASTINA
TIEMPO DE PROTROMBINA	
A
14.20
SEG.	9.55 - 12.23
`;
  const qs = parseSomeReportTables(QS);
  assert.equal(qs.departments[0].key, 'QUIMICA CLINICA');
  assert.equal(qs.departments[0].groups.length, 1);
  const qcRows = qs.departments[0].groups[0].rows;
  assert.equal(qcRows.filter((r) => r.estudio.indexOf('BILIRRUBINA') === 0).length, 2);

  const bh = parseSomeReportTables(BH);
  assert.equal(bh.departments[0].groups.length, 2);

  const ego = parseSomeReportTables(EGO);
  assert.equal(ego.departments[0].groups.length, 1);
  const rows = ego.departments[0].groups[0].rows;
  assert.equal(rows.some((r) => /^(FISICO|QUIMICO|SEDIMENTO)$/.test(r.estudio)), false);
  const color = rows.find((r) => r.estudio === 'COLOR');
  assert.equal(color.resultado, 'AMARILLO OSCURO');
  const prot = rows.find((r) => r.estudio === 'PROTEINAS');
  assert.equal(formatSomeResultado(prot), '30 mg/dL');
  assert.equal(prot.ref, 'NEGATIVO');
});

test('parseSomeReportTables — flag CB (críticamente bajo) no desplaza valores', () => {
  const raw = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
SODIO
SODIO	
CB
124.3
mmol/L	135.0 - 145.0
POTASIO
POTASIO	
*
4.2
mmol/L	3.5 - 5.1
`;
  const parsed = parseSomeReportTables(raw);
  const sodio = parsed.departments[0].groups[0].rows.find((r) => r.estudio === 'SODIO');
  assert.ok(sodio);
  assert.equal(sodio.flag, 'CB');
  assert.equal(sodio.resultado, '124.3');
  assert.equal(formatSomeResultado(sodio), '124.3 mmol/L');
  assert.equal(sodio.ref, '135.0 - 145.0');
  assert.equal(sodio.abnormal, true);
});

test('parseSomeReportTables — EGO: Negativo/mg/dL no desplaza CETONAS ni sedimento', () => {
  const EGO_RAUL = `
URIANALISIS
EXAMEN GENERAL DE ORINA
Estudio		Resultado	Unidades	Valor de Referencia
FISICO
FISICO
*
:
COLOR
COLOR
*
Amarillo
N/A
ASPECTO
ASPECTO
*
Claro
N/A
QUIMICO
QUIMICO
*
:
DENSIDAD
DENSIDAD
*
1.008
1.005 - 1.025
PH
PH
*
>=9.0
5.5 - 6.5
PROTEINAS
PROTEINAS
A
30
mg/dL	NEGATIVO
GLUCOSA
GLUCOSA
*
Negativo
mg/dL
NEGATIVO
CETONAS
CETONAS
*
Negativo
mg/dL
NEGATIVO
BILIRRUBINAS
BILIRRUBINAS
*
Negativo
NEGATIVO
SANGRE
SANGRE
*
Apr 80
Hem/uL
NEGATIVO
NITRITOS
NITRITOS
*
Negativo
NEGATIVO
UROBILINOGENO
UROBILINOGENO
*
0.2
E.U./dL
0.0 - 1.0
ESTERASA LEUCOCITARIA
ESTERASA LEUCOCITARIA
*
Apr 70
Leucocitos/uL
NEGATIVO
SEDIMENTO
SEDIMENTO
*
:
ERITROCITOS
ERITROCITOS
*
0-5
/CAMPO
0-2/CAMPO
LEUCOCITOS
LEUCOCITOS
*
0-2
/CAMPO
0-5/CAMPO
CELULAS EPITELIALES
CELULAS EPITELIALES
*
AUSENTES
AUSENTES
CRISTALES AMORFOS
CRISTALES AMORFOS
*
AUSENTES
N/A
BACTERIAS
BACTERIAS
*
ESCASAS
AUSENTES
`;
  const parsed = parseSomeReportTables(EGO_RAUL);
  const rows = parsed.departments[0].groups[0].rows;
  const byName = Object.fromEntries(rows.map((r) => [r.estudio, r]));

  assert.ok(byName.GLUCOSA, 'GLUCOSA');
  assert.equal(byName.GLUCOSA.resultado, 'Negativo');
  assert.equal(byName.GLUCOSA.unidades, 'mg/dL');
  assert.equal(byName.GLUCOSA.ref, 'NEGATIVO');

  assert.ok(byName.CETONAS, 'CETONAS');
  assert.equal(byName.CETONAS.estudio, 'CETONAS');
  assert.equal(byName.CETONAS.resultado, 'Negativo');
  assert.equal(byName.CETONAS.unidades, 'mg/dL');

  assert.ok(byName.BILIRRUBINAS);
  assert.equal(byName.BILIRRUBINAS.estudio, 'BILIRRUBINAS');
  assert.equal(byName.BILIRRUBINAS.resultado, 'Negativo');

  assert.ok(byName.SANGRE);
  assert.equal(byName.SANGRE.resultado, 'Apr 80');
  assert.equal(byName.SANGRE.unidades, 'Hem/uL');

  assert.ok(byName.ERITROCITOS);
  assert.equal(byName.ERITROCITOS.resultado, '0-5');
  assert.equal(byName.ERITROCITOS.unidades, '/CAMPO');
  assert.equal(byName.ERITROCITOS.ref, '0-2/CAMPO');

  assert.ok(byName['CELULAS EPITELIALES']);
  assert.equal(byName['CELULAS EPITELIALES'].resultado, 'AUSENTES');
  assert.equal(byName['CELULAS EPITELIALES'].ref, 'AUSENTES');

  assert.ok(byName.BACTERIAS);
  assert.equal(byName.BACTERIAS.resultado, 'ESCASAS');
  assert.equal(byName.BACTERIAS.ref, 'AUSENTES');

  assert.ok(
    !rows.some((r) => /^mg\/dL\b/i.test(r.estudio) || r.estudio === 'NEGATIVO'),
    'sin filas huérfanas por corte temprano'
  );
  const names = rows.map((r) => r.estudio);
  assert.equal(names.filter((n) => n === 'ERITROCITOS').length, 1);
  assert.equal(names.filter((n) => n === 'GLUCOSA').length, 1);
});

test('parseSomeReportTables — no duplica analitos con nombre largo', () => {
  const raw = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
CREATININA EN SANGRE
CREATININA EN SANGRE	
A
1.23
mg/dL	0.70 - 1.20
`;
  const parsed = parseSomeReportTables(raw);
  const rows = parsed.departments[0].groups[0].rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].estudio, 'CREATININA EN SANGRE');
  assert.equal(rows[0].resultado, '1.23');
});

test('parseSomeReportTables — omite comentario de muestra y observaciones', () => {
  const raw = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
GLUCOSA
GLUCOSA	
*
95
mg/dL	70 - 100
COMENTARIO DE MUESTRA
OBSERVACION VALOR	
*
TEXTO LIBRE
OBSERVACIONES
OBS 1	
*
SIN VALOR CLINICO
UREA
UREA	
*
40
mg/dL	15 - 45
`;
  const parsed = parseSomeReportTables(raw);
  const rows = parsed.departments[0].groups[0].rows;
  assert.equal(rows.length, 2);
  assert.ok(rows.find((r) => r.estudio === 'GLUCOSA'));
  assert.ok(rows.find((r) => r.estudio === 'UREA'));
  assert.equal(
    rows.some((r) => /COMENTARIO|OBSERVACION/i.test(r.estudio)),
    false
  );
});

test('parseSomeReportTables — omite COMENTARIO DE LA MUESTRA y pie Expediente/Solicitud', () => {
  const raw = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
COMENTARIO DE LA MUESTRA
GLUCOSA EN SANGRE
GLUCOSA EN SANGRE	
*
95
mg/dL	70 - 100
OSMOLARIDAD
OSMOLARIDAD	
*
277.0
mmol/L	275 - 295
Expediente:	1797286-1	Solicitud:	2605230312
`;
  const parsed = parseSomeReportTables(raw);
  const rows = parsed.departments[0].groups[0].rows;
  assert.equal(rows.length, 2);
  const glu = rows.find((r) => r.estudio === 'GLUCOSA EN SANGRE');
  assert.ok(glu);
  assert.equal(glu.resultado, '95');
  const osm = rows.find((r) => r.estudio === 'OSMOLARIDAD');
  assert.ok(osm);
  assert.equal(osm.resultado, '277.0');
  assert.equal(osm.unidades, 'mmol/L');
  assert.equal(osm.ref, '275 - 295');
  assert.equal(
    rows.some((r) => /COMENTARIO|Expediente|Solicitud/i.test(String(r.resultado || r.ref))),
    false
  );
});

test('parseSomeReportTables — osmolaridad con Expediente en la misma línea del valor', () => {
  const raw = `
QUIMICA CLINICA
Estudio		Resultado	Unidades	Valor de Referencia
OSMOLARIDAD
OSMOLARIDAD	
*
277.0 Expediente:
1797286-1 Solicitud: 2605230312
`;
  const parsed = parseSomeReportTables(raw);
  const osm = parsed.departments[0].groups[0].rows[0];
  assert.equal(osm.estudio, 'OSMOLARIDAD');
  assert.equal(osm.resultado, '277.0');
  assert.equal(/Expediente|Solicitud/i.test(String(osm.resultado || osm.ref)), false);
});
