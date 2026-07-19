import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseMedicationPaste,
  parseIndicacionesPaste,
  looksLikeSomeIndicacionesPaste,
  shouldAutoSelectSoap,
  extractDietNutrients,
  mergeDietaItems,
  buildDietProposalText,
  resolveFechaActualizacion,
  formatMedicationEgresoLine,
  formatMedicationSoapShort,
  buildMedRecetaCopyText,
  buildMedRecetaNameOnlyText,
  extractDiaTratamiento,
  parseFechaDMYToLocalDate,
  calendarDaysSinceFechaDMY,
  advanceDiaInMedSoapText,
  advanceAbxMedTextForManejoDate,
  effectiveDiaTratamiento,
  setDiaTratamientoInDosis,
  incrementMedItemsDiaTratamiento,
  classifyMedicationSoapCategory,
  effectiveSoapCategory,
  unassignedOtrosSoapItems,
  applyMedCatalogOverlay,
  dosisBeforeSlash,
  extractRecetaNameOnlyDose,
} from '../../../public/js/med-receta-core.mjs';

var SAMPLE_MIXED =
  '10/06/2026 06:25:37 a.m.\tCUIDADOS\tCUANTIFICAR BALANCE\t\tPOR TURNO\t\tNW\n' +
  '10/06/2026 06:27:36 a.m.\tDIETAS\tNORMAL PICADA ALTA EN FIBRA\t\t2000 KCAL + 70 GR PROTEINA\t\tNW\n' +
  '10/06/2026 06:27:48 a.m.\tESTUDIOS\tBIOMETRÍA HEMÁTICA\t\tEN AM\tUNICA VEZ\tNW\n' +
  '10/06/2026 06:26:12 a.m.\tMEDICAMENTOS\tACICLOVIR 200 MG TABLETA (*)\tVIA ORAL\t400 MG //\tCADA 12 HORAS\tNW\n' +
  '10/06/2026 06:26:39 a.m.\tMEDICAMENTOS P2\tDEXTROSA 50 % SOL INY 50 ML\tVIA INTRAVENOSA\t50 ML / VEL.INF: GLUCOSA <70\tPRN\tNW';

beforeEach(() => {
  applyMedCatalogOverlay({ accents: {}, soapTokens: { vasop: [], abx: [], analgesia: [], antihta: [] } });
});

test('dosisBeforeSlash descarta todo tras // para dosis aplicada', () => {
  assert.equal(
    dosisBeforeSlash('2400000 UI // 1ERA DOSIS 12 DE MAYO, 2DA 19 DE MAYO *DIA# 4*'),
    '2400000 UI'
  );
  assert.equal(dosisBeforeSlash('160 MG // SOLUCION STANFORD *DIA# 4*'), '160 MG');
  assert.equal(dosisBeforeSlash('8 MG'), '8 MG');
});

test('parseMedicationPaste extrae nombre, via, dosis, frecuencia y diaTratamiento null sin DIA#', () => {
  var line =
    '02/05/2026 08:31:32 a.m.\tMEDICAMENTOS\tENOXAPARINA 40 MG SOL INY 0.4 ML (+*)\tVIA SUBCUTANEA\t40 MG //\tCADA 24 HORAS\tNW';
  var r = parseMedicationPaste(line);
  assert.equal(r.skipped, 0);
  assert.equal(r.items.length, 1);
  var it = r.items[0];
  assert.equal(it.nombreRaw, 'ENOXAPARINA 40 MG SOL INY 0.4 ML (+*)');
  assert.equal(it.viaRaw, 'VIA SUBCUTANEA');
  assert.equal(it.dosisRaw, '40 MG //');
  assert.equal(it.frecuenciaRaw, 'CADA 24 HORAS');
  assert.equal(it.diaTratamiento, null);
});

test('parseMedicationPaste lee DIA# en dosis', () => {
  var line =
    '02/05/2026 08:31:38 a.m.\tMEDICAMENTOS\tMETRONIDAZOL 500 MG SOL INY 100 ML (*)\tVIA INTRAVENOSA\t500 MG // *DIA# 3*\tCADA 8 HORAS\tNW';
  var r = parseMedicationPaste(line);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].diaTratamiento, 3);
});

test('parseMedicationPaste lee DIA# en ertapenem (1 G // *DIA# 3*)', () => {
  var line =
    '02/05/2026 08:15:29 a.m.\tMEDICAMENTOS\tERTAPENEM 1 G SOL INY (*)\tVIA INTRAVENOSA\t1 G // *DIA# 3*\tCADA 24 HORAS\tNW';
  var r = parseMedicationPaste(line);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].diaTratamiento, 3);
  assert.equal(r.items[0].dosisRaw, '1 G // *DIA# 3*');
});

test('calendarDaysSinceFechaDMY cuenta días calendario hasta refDate', () => {
  var ref = new Date(2026, 5, 12);
  assert.equal(calendarDaysSinceFechaDMY('10/06/2026', ref), 2);
  assert.equal(calendarDaysSinceFechaDMY('12/06/2026', ref), 0);
  assert.equal(calendarDaysSinceFechaDMY('13/06/2026', ref), 0);
});

test('advanceAbxMedTextForManejoDate avanza DIA según fecha de Manejo', () => {
  var ref = new Date(2026, 5, 12);
  assert.equal(
    advanceAbxMedTextForManejoDate('MEROPENEM 1G IV C/8H DIA 10', '10/06/2026', ref),
    'MEROPENEM 1G IV C/8H DIA 12'
  );
  assert.equal(
    advanceAbxMedTextForManejoDate(
      'MEROPENEM 1G IV C/8H DIA 10 | VANCOMICINA 1.5G IV C/12H DIA 4',
      '10/06/2026',
      ref
    ),
    'MEROPENEM 1G IV C/8H DIA 12 | VANCOMICINA 1.5G IV C/12H DIA 6'
  );
});

test('parseFechaDMYToLocalDate rechaza fechas inválidas', () => {
  assert.equal(parseFechaDMYToLocalDate('31/02/2026'), null);
  assert.deepEqual(parseFechaDMYToLocalDate('10/06/2026'), new Date(2026, 5, 10));
});

test('advanceDiaInMedSoapText sin offset devuelve texto igual', () => {
  assert.equal(advanceDiaInMedSoapText('CEFTRIAXONA DIA 3', 0), 'CEFTRIAXONA DIA 3');
});

test('effectiveDiaTratamiento avanza desde fecha de Manejo', () => {
  var ref = new Date(2026, 5, 12);
  assert.equal(effectiveDiaTratamiento(10, '10/06/2026', ref), 12);
  assert.equal(effectiveDiaTratamiento(10, '', ref), 10);
});

test('formatMedicationSoapShort con fechaActualizacion muestra DIA efectivo', () => {
  var ref = new Date(2026, 5, 12);
  assert.equal(
    formatMedicationSoapShort(
      {
        nombreRaw: 'MEROPENEM 1 G',
        viaRaw: 'VIA INTRAVENOSA',
        dosisRaw: '1 G',
        frecuenciaRaw: 'CADA 8 HORAS',
        diaTratamiento: 10,
        suspendido: false,
      },
      { fechaActualizacion: '10/06/2026', refDate: ref }
    ),
    'MEROPENEM 1 G IV C/8H DIA 12'
  );
});

test('formatMedicationEgresoLine con fechaActualizacion muestra DÍA efectivo', () => {
  var ref = new Date(2026, 5, 12);
  var line = formatMedicationEgresoLine(
    {
      nombreRaw: 'METRONIDAZOL 500 MG',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '500 MG',
      frecuenciaRaw: 'CADA 8 HORAS',
      diaTratamiento: 3,
      suspendido: false,
    },
    { fechaActualizacion: '10/06/2026', refDate: ref }
  );
  assert.match(line, /DÍA 5 DE TRATAMIENTO/);
});

test('extractDiaTratamiento acepta DIA # con espacio y sin asteriscos', () => {
  assert.equal(extractDiaTratamiento('1 G // DIA # 5'), 5);
});

test('setDiaTratamientoInDosis actualiza marcador DIA#', () => {
  assert.equal(setDiaTratamientoInDosis('500 MG // *DIA# 3*', 4), '500 MG // *DIA# 4*');
});

test('incrementMedItemsDiaTratamiento incrementa solo con DIA# y no suspendidos', () => {
  var items = [
    { id: 'a', suspendido: false, diaTratamiento: 3, dosisRaw: '500 MG // *DIA# 3*' },
    { id: 'b', suspendido: true, diaTratamiento: 2, dosisRaw: '*DIA# 2*' },
    { id: 'c', suspendido: false, diaTratamiento: null, dosisRaw: '40 MG' },
  ];
  var r = incrementMedItemsDiaTratamiento(items);
  assert.equal(r.count, 1);
  assert.equal(r.items[0].diaTratamiento, 4);
  assert.equal(r.items[0].dosisRaw, '500 MG // *DIA# 4*');
  assert.equal(r.items[1].diaTratamiento, 2);
});

test('resolveFechaActualizacion usa moda de fechas dd/mm/yyyy', () => {
  assert.equal(resolveFechaActualizacion(['02/05/2026', '02/05/2026', '03/05/2026'], '09/05/2026'), '02/05/2026');
});

test('resolveFechaActualizacion cae en fallback si vacío', () => {
  assert.equal(resolveFechaActualizacion([], '09/05/2026'), '09/05/2026');
});

test('formatMedicationEgresoLine — ENOXAPARINA programada SC', () => {
  var line = formatMedicationEgresoLine({
    nombreRaw: 'ENOXAPARINA 40 MG SOL INY 0.4 ML (+*)',
    viaRaw: 'VIA SUBCUTANEA',
    dosisRaw: '40 MG //',
    frecuenciaRaw: 'CADA 24 HORAS',
    diaTratamiento: null,
  });
  assert.equal(
    line,
    'ENOXAPARINA 40 MG SOLUCIÓN INYECTABLE || APLICAR 40 MG VÍA SUBCUTÁNEA CADA 24 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.'
  );
});

test('formatMedicationEgresoLine — METRONIDAZOL con día 3', () => {
  var line = formatMedicationEgresoLine({
    nombreRaw: 'METRONIDAZOL 500 MG SOL INY 100 ML (*)',
    viaRaw: 'VIA INTRAVENOSA',
    dosisRaw: '500 MG // *DIA# 3*',
    frecuenciaRaw: 'CADA 8 HORAS',
    diaTratamiento: 3,
  });
  assert.equal(
    line,
    'METRONIDAZOL 500 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 500 MG VÍA INTRAVENOSA CADA 8 HORAS (DÍA 3 DE TRATAMIENTO).'
  );
});

test('formatMedicationEgresoLine — ONDANSETRON PRN', () => {
  var line = formatMedicationEgresoLine({
    nombreRaw: 'ONDANSETRON 8 MG SOL INY 4 ML',
    viaRaw: 'VIA INTRAVENOSA',
    dosisRaw: '8 MG // CRITERIO PRN: EN CASO DE NAUSEAS O VÓMITO, CADA 8 HRS',
    frecuenciaRaw: 'PRN',
    diaTratamiento: null,
  });
  assert.equal(
    line,
    'ONDANSETRÓN 8 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 8 MG VÍA INTRAVENOSA CADA 8 HORAS EN CASO DE NÁUSEA O VÓMITO.'
  );
});

test('formatMedicationEgresoLine — ONDANSETRON PRN con NAUSEA y VOMITO', () => {
  var line = formatMedicationEgresoLine({
    nombreRaw: 'ONDANSETRON 8 MG SOL INY 4 ML',
    viaRaw: 'VIA INTRAVENOSA',
    dosisRaw: '8 MG // CRITERIO PRN: EN CASO DE NAUSEA Y VOMITO, CADA 8 HRS',
    frecuenciaRaw: 'PRN',
    diaTratamiento: null,
  });
  assert.equal(
    line,
    'ONDANSETRÓN 8 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 8 MG VÍA INTRAVENOSA CADA 8 HORAS EN CASO DE NÁUSEA O VÓMITO.'
  );
});

test('buildMedRecetaCopyText une con línea en blanco entre activos y omite suspendidos', () => {
  var items = [
    {
      nombreRaw: 'ENOXAPARINA 40 MG SOL INY 0.4 ML (+*)',
      viaRaw: 'VIA SUBCUTANEA',
      dosisRaw: '40 MG //',
      frecuenciaRaw: 'CADA 24 HORAS',
      diaTratamiento: null,
      suspendido: false,
    },
    {
      nombreRaw: 'LOSARTAN 50 MG COMPRIMIDO (*)',
      viaRaw: 'VIA ORAL',
      dosisRaw: '50 MG //',
      frecuenciaRaw: 'CADA 24 HORAS',
      diaTratamiento: null,
      suspendido: true,
    },
    {
      nombreRaw: 'OMEPRAZOL 40 MG SOL INY 10 ML (*)',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '40 MG //',
      frecuenciaRaw: 'CADA 24 HORAS',
      diaTratamiento: null,
      suspendido: false,
    },
  ];
  var t = buildMedRecetaCopyText(items);
  assert.ok(t.indexOf('ENOXAPARINA') !== -1);
  assert.ok(t.indexOf('LOSARTAN') === -1);
  assert.ok(t.indexOf('OMEPRAZOL') !== -1);
  assert.ok(t.indexOf('\n\n') !== -1);
});

test('buildMedRecetaNameOnlyText incluye nombre, via+dosis, frecuencia y día', () => {
  var items = [
    {
      nombreRaw: 'METRONIDAZOL 500 MG SOL INY 100 ML (*)',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '500 MG // *DIA# 3*',
      frecuenciaRaw: 'CADA 8 HORAS',
      diaTratamiento: 3,
      suspendido: false,
    },
    {
      nombreRaw: 'OMEPRAZOL 40 MG SOL INY 10 ML (*)',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '40 MG //',
      frecuenciaRaw: 'CADA 12 HORAS',
      diaTratamiento: null,
      suspendido: false,
    },
  ];
  var t = buildMedRecetaNameOnlyText(items);
  var lines = t.split('\n');
  assert.equal(lines[0], 'METRONIDAZOL 500MG IV C/8H DIA 3');
  assert.equal(lines[1], 'OMEPRAZOL 40MG IV C/12H');
});

test('buildMedRecetaNameOnlyText agrega día de uso cuando existe', () => {
  var items = [
    {
      nombreRaw: 'OMEPRAZOL 40 MG SOL INY 10 ML (*)',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '40 MG // *DIA# 4*',
      frecuenciaRaw: 'CADA 12 HORAS',
      diaTratamiento: 4,
      suspendido: false,
    },
  ];
  var t = buildMedRecetaNameOnlyText(items);
  assert.equal(t, 'OMEPRAZOL 40MG IV C/12H DIA 4');
});

test('extractRecetaNameOnlyDose — infusión con VEL.INF MCG/MIN (norepinefrina)', () => {
  var d =
    '16 MG // DILUIREN: DILUIREN 125 CC DE GLUCOSADO AL 5% VEL.INF: 5 MCG/MIN';
  assert.equal(extractRecetaNameOnlyDose(d), '5 MCG/MIN');
});

test('extractRecetaNameOnlyDose — vancomicina con infusión 3 h conserva bolus', () => {
  var d =
    '1.5 G // DILUIREN: 200 CC DE SOL. FISIO AL 0.9% VEL.INF: 3 HORAS *DIA# 4*';
  assert.equal(extractRecetaNameOnlyDose(d), '1.5 G');
});

test('extractRecetaNameOnlyDose — buprenorfina CC/HORA → MCG/HORA titulación', () => {
  var d =
    '450 MCG DILUIREN: 100 CC DE SOL FISIO AL 0.9% VEL.INF: 4 CC/HORA';
  assert.equal(extractRecetaNameOnlyDose(d), '4 MCG/HORA');
});

test('buildMedRecetaNameOnlyText — infusión sin dilución en salida simple', () => {
  var items = [
    {
      nombreRaw: 'BUPRENORFINA 900 MCG SOL INY',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '450 MCG DILUIREN: 100 CC DE SOL FISIO AL 0.9% VEL.INF: 4 CC/HORA',
      frecuenciaRaw: 'CADA 24 HORAS',
      diaTratamiento: null,
      suspendido: false,
    },
    {
      nombreRaw: 'VANCOMICINA 1 G SOL INY',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '1.5 G // DILUIREN: 200 CC DE SOL. FISIO AL 0.9% VEL.INF: 3 HORAS *DIA# 4*',
      frecuenciaRaw: 'CADA 12 HORAS',
      diaTratamiento: 4,
      suspendido: false,
    },
    {
      nombreRaw: 'NOREPINEFRINA 4 MG SOL INY',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw:
        '16 MG // DILUIREN: DILUIREN 125 CC DE GLUCOSADO AL 5% VEL.INF: 5 MCG/MIN',
      frecuenciaRaw: 'CADA 24 HORAS',
      diaTratamiento: null,
      suspendido: false,
    },
  ];
  var lines = buildMedRecetaNameOnlyText(items).split('\n');
  assert.equal(lines[0], 'BUPRENORFINA 4 MCG/HORA IV C/24H');
  assert.equal(lines[1], 'VANCOMICINA 1.5 G IV C/12H DIA 4');
  assert.equal(lines[2], 'NOREPINEFRINA 5 MCG/MIN IV C/24H');
});

test('buildMedRecetaNameOnlyText usa formato compacto solicitado en meropenem', () => {
  var items = [
    {
      nombreRaw: 'MEROPENEM 1 G SOL INY 20 ML',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '2 G // *DIA# 2*',
      frecuenciaRaw: 'CADA 8 HORAS',
      diaTratamiento: 2,
      suspendido: false,
    },
  ];
  var t = buildMedRecetaNameOnlyText(items);
  assert.equal(t, 'MEROPENEM 2 G IV C/8H DIA 2');
});

test('bloque dorado — 12 medicamentos del spec', () => {
  var lines = [
    '2/05/2026 08:31:31 a.m.\tMEDICAMENTOS\tDEXTROSA 50 % SOL INY 50 ML\tVIA INTRAVENOSA\t50 ML // CRITERIO PRN: EN CASO DE HIPOGLUCEMIA <70, CADA 6 HRS\tPRN\tNW',
    '02/05/2026 08:31:32 a.m.\tMEDICAMENTOS\tENOXAPARINA 40 MG SOL INY 0.4 ML (+*)\tVIA SUBCUTANEA\t40 MG //\tCADA 24 HORAS\tNW',
    '02/05/2026 08:31:33 a.m.\tMEDICAMENTOS\tLACTULOSA 10 G JARABE 125 ML\tVIA ORAL\t15 ML //\tCADA 8 HORAS\tNW',
    '02/05/2026 08:31:36 a.m.\tMEDICAMENTOS\tLOSARTAN 50 MG COMPRIMIDO (*)\tVIA ORAL\t50 MG //\tCADA 24 HORAS\tNW',
    '02/05/2026 08:31:37 a.m.\tMEDICAMENTOS\tMAGALDRATO/DIMETICONA 800/100 MG GEL 250 ML\tVIA ORAL\t15 ML //\tCADA 8 HORAS\tNW',
    '02/05/2026 08:31:38 a.m.\tMEDICAMENTOS\tMETRONIDAZOL 500 MG SOL INY 100 ML (*)\tVIA INTRAVENOSA\t500 MG // *DIA# 3*\tCADA 8 HORAS\tNW',
    '02/05/2026 08:31:39 a.m.\tMEDICAMENTOS\tOMEPRAZOL 40 MG SOL INY 10 ML (*)\tVIA INTRAVENOSA\t40 MG //\tCADA 24 HORAS\tNW',
    '02/05/2026 08:31:39 a.m.\tMEDICAMENTOS\tONDANSETRON 8 MG SOL INY 4 ML\tVIA INTRAVENOSA\t8 MG // CRITERIO PRN: EN CASO DE NAUSEAS O VÓMITO, CADA 8 HRS\tPRN\tNW',
    '02/05/2026 08:31:41 a.m.\tMEDICAMENTOS\tPARACETAMOL 1 G SOL INY 100 ML (*)\tVIA INTRAVENOSA\t1 G //\tCADA 8 HORAS\tNW',
    '02/05/2026 08:31:43 a.m.\tMEDICAMENTOS\tPOLIETILENGLICOL 3350 POLVO 17 G\tVIA ORAL\t17 G //\tCADA 12 HORAS\tNW',
    '02/05/2026 08:31:44 a.m.\tMEDICAMENTOS\tPREGABALINA 75 MG CAPSULA\tVIA ORAL\t75 MG //\tCADA 12 HORAS\tNW',
    '02/05/2026 08:31:45 a.m.\tMEDICAMENTOS\tSENOSIDOS A-B 8.6 MG TABLETA\tVIA ORAL\t8.6 MG //\tCADA 12 HORAS\tNW',
  ];
  var raw = lines.join('\n');

  var expected = [
    'DEXTROSA 50% SOLUCIÓN INYECTABLE 50 ML || ADMINISTRAR 50 ML VÍA INTRAVENOSA EN CASO DE HIPOGLUCEMIA <70 MG/DL, CADA 6 HORAS SEGÚN REQUERIMIENTO.',
    'ENOXAPARINA 40 MG SOLUCIÓN INYECTABLE || APLICAR 40 MG VÍA SUBCUTÁNEA CADA 24 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'LACTULOSA 10 G JARABE || TOMAR 15 ML VÍA ORAL CADA 8 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'LOSARTÁN 50 MG TABLETA || TOMAR 1 TABLETA (50 MG) VÍA ORAL CADA 24 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'MAGALDRATO/DIMETICONA 800/100 MG GEL || TOMAR 15 ML VÍA ORAL CADA 8 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'METRONIDAZOL 500 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 500 MG VÍA INTRAVENOSA CADA 8 HORAS (DÍA 3 DE TRATAMIENTO).',
    'OMEPRAZOL 40 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 40 MG VÍA INTRAVENOSA CADA 24 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'ONDANSETRÓN 8 MG SOLUCIÓN INYECTABLE || ADMINISTRAR 8 MG VÍA INTRAVENOSA CADA 8 HORAS EN CASO DE NÁUSEA O VÓMITO.',
    'PARACETAMOL 1 G SOLUCIÓN INYECTABLE || ADMINISTRAR 1 G VÍA INTRAVENOSA CADA 8 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'POLIETILENGLICOL 3350 17 G POLVO || TOMAR 17 G VÍA ORAL CADA 12 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'PREGABALINA 75 MG CÁPSULA || TOMAR 1 CÁPSULA (75 MG) VÍA ORAL CADA 12 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
    'SENÓSIDOS A-B 8.6 MG TABLETA || TOMAR 1 TABLETA (8.6 MG) VÍA ORAL CADA 12 HORAS, SIN SUSPENDER HASTA NUEVO AVISO.',
  ];

  var parsed = parseMedicationPaste(raw);
  assert.equal(parsed.items.length, 12);
  for (var i = 0; i < 12; i += 1) {
    var got = formatMedicationEgresoLine(parsed.items[i]);
    assert.equal(got, expected[i], 'fila ' + i);
  }
});

test('effectiveSoapCategory — otros requiere override manual', () => {
  const item = { nombreRaw: 'FARMACO SIN LISTA XYZ 500 MG' };
  assert.equal(classifyMedicationSoapCategory(item.nombreRaw), 'otros');
  assert.equal(effectiveSoapCategory(item, classifyMedicationSoapCategory), 'otros');
  assert.equal(
    effectiveSoapCategory({ nombreRaw: 'HALOPERIDOL 5 MG' }, classifyMedicationSoapCategory),
    'sedacion'
  );
  assert.equal(
    effectiveSoapCategory({ ...item, soapCatOverride: 'nm' }, classifyMedicationSoapCategory),
    'nm'
  );
  assert.equal(
    effectiveSoapCategory({ ...item, soapCatOverride: 'invalid' }, classifyMedicationSoapCategory),
    'otros'
  );
  assert.equal(
    effectiveSoapCategory({ nombreRaw: 'PARACETAMOL 1 G' }, classifyMedicationSoapCategory),
    'analgesia'
  );
});

test('unassignedOtrosSoapItems — solo SOAP sin destino', () => {
  const items = [
    { id: 'a', nombreRaw: 'FARMACO SIN LISTA XYZ', suspendido: false },
    { id: 'b', nombreRaw: 'FARMACO SIN LISTA XYZ', soapCatOverride: 'nm', suspendido: false },
    { id: 'c', nombreRaw: 'PARACETAMOL 1 G', suspendido: false },
  ];
  const sel = { a: true, b: true, c: true };
  const pending = unassignedOtrosSoapItems(items, sel, classifyMedicationSoapCategory);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'a');
});

test('classifyMedicationSoapCategory — ejemplos hospitalarios', () => {
  assert.equal(classifyMedicationSoapCategory('ERTAPENEM 1 G'), 'abx');
  assert.equal(classifyMedicationSoapCategory('PARACETAMOL 1 G'), 'analgesia');
  assert.equal(classifyMedicationSoapCategory('LOSARTAN 50 MG'), 'antihta');
  assert.equal(classifyMedicationSoapCategory('NORADRENALINA 4 MG'), 'vasop');
  assert.equal(classifyMedicationSoapCategory('FUROSEMIDA 40 MG'), 'diuretico');
  assert.equal(classifyMedicationSoapCategory('INSULINA GLARGINA'), 'nm');
  assert.equal(classifyMedicationSoapCategory('DINITRATO DE ISOSORBIDE 40 MG'), 'antihta');
  assert.equal(classifyMedicationSoapCategory('ENOXAPARINA 40 MG'), 'antitromboticos');
  assert.equal(classifyMedicationSoapCategory('WARFARINA 5 MG'), 'anticoagulacion');
  assert.equal(classifyMedicationSoapCategory('APIXABAN 5 MG'), 'anticoagulacion');
  assert.equal(classifyMedicationSoapCategory('ALTEPLASA 100 MG'), 'anticoagulacion');
  assert.equal(classifyMedicationSoapCategory('AMIODARONA 200 MG'), 'antiarritmicos');
  assert.equal(classifyMedicationSoapCategory('NALOXONA 0.4 MG'), 'antidotos');
  assert.equal(classifyMedicationSoapCategory('LEVODOPA/CARBIDOPA'), 'antiparkinsonianos');
  assert.equal(classifyMedicationSoapCategory('AMBROXOL JARABE'), 'viaAerea');
  assert.equal(classifyMedicationSoapCategory('CONCENTRADO ERITROCITARIO'), 'transfusiones');
  assert.equal(classifyMedicationSoapCategory('TIAMINA 100 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('CELECOXIB 200 MG'), 'analgesia');
  assert.equal(classifyMedicationSoapCategory('SERTRALINA 50 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('OMEPRAZOL 40 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('METFORMINA 850 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('DAPAGLIFLOZINA 10 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('ATORVASTATINA 40 MG'), 'estatinas');
  assert.equal(classifyMedicationSoapCategory('DEXAMETASONA 8 MG'), 'nm');
  assert.equal(classifyMedicationSoapCategory('SALBUTAMOL 5 MG'), 'viaAerea');
  assert.equal(classifyMedicationSoapCategory('HALOPERIDOL 5 MG'), 'sedacion');
  assert.equal(classifyMedicationSoapCategory('LEVETIRACETAM 500 MG'), 'antiepilepticos');
  assert.equal(classifyMedicationSoapCategory('LACTULOSA JARABE'), 'nm');
  assert.equal(classifyMedicationSoapCategory('CLORURO DE POTASIO'), 'nm');
  assert.equal(classifyMedicationSoapCategory('FÁRMACO SIN LISTA XYZ'), 'otros');
  assert.equal(classifyMedicationSoapCategory('ONDANSETRÓN 8 MG'), 'antiemeticos');
  assert.equal(classifyMedicationSoapCategory('ONDASETRON 8 MG'), 'antiemeticos');
  assert.equal(
    classifyMedicationSoapCategory('ACIDO ACETIL SALICILICO 100 MG TABLETA', '100 MG'),
    'antitromboticos'
  );
  assert.equal(
    classifyMedicationSoapCategory('ACETILSALICILICO 100 MG TABLETA', '100 MG'),
    'antitromboticos'
  );
  assert.equal(classifyMedicationSoapCategory('ASPIRINA 500 MG TABLETA', '500 MG'), 'analgesia');
});

test('formatMedicationSoapShort — indicación compacta', () => {
  assert.equal(
    formatMedicationSoapShort({
      nombreRaw: 'NIFEDIPINO 60 MG TABLETA',
      viaRaw: 'VIA ORAL',
      dosisRaw: '60 MG',
      frecuenciaRaw: 'CADA 12 HORAS',
      suspendido: false,
    }),
    'NIFEDIPINO 60MG VO C/12H'
  );
  assert.equal(
    formatMedicationSoapShort({
      nombreRaw: 'MEROPENEM 1 G',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '1 G',
      frecuenciaRaw: 'CADA 8 HORAS',
      diaTratamiento: 13,
      suspendido: false,
    }),
    'MEROPENEM 1 G IV C/8H DIA 13'
  );
  assert.equal(
    formatMedicationSoapShort({
      nombreRaw: 'PIPERACILINA/TAZOBACTAM 4/500 G/MG SOLUCIÓN INYECTABLE',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '4.5 G // *DIA# 4*',
      frecuenciaRaw: 'CADA 6 HORAS',
      diaTratamiento: 4,
      suspendido: false,
    }),
    'PIPERACILINA/TAZOBACTAM 4.5 G IV C/6H DIA 4'
  );
});

test('parseMedicationPaste incluye medicamento fuera de catálogo', () => {
  var line =
    '04/05/2026 07:04:24 a.m.\tMEDICAMENTOS\tFARMACO NUEVO XYZ 100 MG SOL INY\tVIA INTRAVENOSA\t100 MG //\tCADA 24 HORAS\tNW';
  var r = parseMedicationPaste(line);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].nombreRaw, 'FARMACO NUEVO XYZ 100 MG SOL INY');
});

test('extractDietNutrients lee 2000 KCAL + 70 GR PROTEINA', () => {
  var n = extractDietNutrients('2000 KCAL + 70 GR PROTEINA');
  assert.equal(n.kcal, 2000);
  assert.equal(n.proteinG, 70);
});

test('extractDietNutrients acepta 70 G DE PROTEINA', () => {
  var n = extractDietNutrients('1500 KCAL + 70 G DE PROTEINA');
  assert.equal(n.kcal, 1500);
  assert.equal(n.proteinG, 70);
});

test('extractDietNutrients — variaciones de proteína SOME', () => {
  assert.equal(extractDietNutrients('2000 KCAL+ 80 GR DE PROTEINA').proteinG, 80);
  assert.equal(extractDietNutrients('2000 KCAL + 80 GR DE PROTEINAS').proteinG, 80);
  assert.equal(extractDietNutrients('2000 KCAL + 80 GRAMOS DE PROTEINA').proteinG, 80);
  assert.equal(extractDietNutrients('2000 KCAL + 80 GRS DE PROTEINA').proteinG, 80);
  assert.equal(extractDietNutrients('PROTEINA 80 GR').proteinG, 80);
  assert.equal(extractDietNutrients('80 GR DE PROT').proteinG, 80);
});

test('parseIndicacionesPaste — dieta con macros en descripción o frecuencia', () => {
  var enDesc =
    '10/06/2026 06:39:48 a.m.\tDIETAS\tNORMAL ALTA EN FIBRA 2000 KCAL+ 80 GR DE PROTEINA\t\t\tNW';
  var rDesc = parseIndicacionesPaste(enDesc);
  assert.equal(rDesc.dietas.length, 1);
  assert.equal(rDesc.dietas[0].proteinG, 80);
  assert.equal(rDesc.dietas[0].kcal, 2000);

  var enFreq =
    '10/06/2026 06:39:48 a.m.\tDIETAS\tNORMAL ALTA EN FIBRA\t\t\t2000 KCAL+ 80 GR DE PROTEINAS\tNW';
  var rFreq = parseIndicacionesPaste(enFreq);
  assert.equal(rFreq.dietas[0].proteinG, 80);
});

test('parseIndicacionesPaste — DIETAS AYUNO con 4 columnas (sin VIA)', () => {
  var line = '26/06/2026 08:59:39 a.m.\tDIETAS\tAYUNO\t\t\tNW';
  var r = parseIndicacionesPaste(line);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'AYUNO');
  assert.equal(looksLikeSomeIndicacionesPaste(line), true);
});

test('parseIndicacionesPaste — DIETAS AYUNO colapsada (4 cols sin tabs intermedios)', () => {
  var line = '26/06/2026 08:59:39 a.m.\tDIETAS\tAYUNO\tNW';
  var r = parseIndicacionesPaste(line);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'AYUNO');
});

test('parseIndicacionesPaste — SOME hospital espacios simples (MEDICAMENTOS P1)', () => {
  var paste =
    '19/07/2026 06:42:01 a.m. MEDICAMENTOS OMEPRAZOL 40 MG SOL INY 10 ML (*) VIA INTRAVENOSA 40 MG // CADA 12 HORAS NW\n' +
    '19/07/2026 06:42:03 a.m. MEDICAMENTOS PARACETAMOL 1 G SOL INY 100 ML (*) VIA INTRAVENOSA 1 G // CADA 8 HORAS NW\n' +
    '19/07/2026 06:42:07 a.m. MEDICAMENTOS P1 CLORURO DE SODIO 0.9 % SOL INY 100 ML VIA INTRAVENOSA 100 ML / VEL.INF: BOMBA ALGORITMO 1 CADA 24 HORAS NW\n' +
    '19/07/2026 06:42:08 a.m. MEDICAMENTO P1 INSULINA HUMANA RAPIDA VIA INTRAVENOSA 100 UI - NW\n' +
    '19/07/2026 10:41:32 a.m. PROCEDIMIENTO COLOCACION DE CATETER VENOSO CENTRAL MEDIANTE GUIADO KIT PARA CVC NW';
  var r = parseIndicacionesPaste(paste);
  assert.equal(r.items.length, 4);
  assert.equal(r.skipped, 1);
  assert.equal(r.items[0].nombreRaw, 'OMEPRAZOL 40 MG SOL INY 10 ML (*)');
  assert.equal(r.items[0].viaRaw, 'VIA INTRAVENOSA');
  assert.equal(r.items[0].frecuenciaRaw, 'CADA 12 HORAS');
  assert.equal(r.items[2].nombreRaw, 'CLORURO DE SODIO 0.9 % SOL INY 100 ML');
  assert.match(r.items[2].dosisRaw, /BOMBA ALGORITMO 1/);
  assert.equal(r.items[3].nombreRaw, 'INSULINA HUMANA RAPIDA');
  assert.equal(looksLikeSomeIndicacionesPaste(paste), true);
});

test('parseIndicacionesPaste — DIETAS AYUNO espacios (sin tabs)', () => {
  var line = '26/06/2026 08:59:39 a.m.  DIETAS  AYUNO  NW';
  var r = parseIndicacionesPaste(line);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'AYUNO');
  assert.equal(looksLikeSomeIndicacionesPaste(line), true);
});

test('parseIndicacionesPaste — bloque usuario con AYUNO entre meds y cuidados', () => {
  var paste =
    '26/06/2026 07:17:48 a.m.\tCUIDADOS\tGLUCOMETRIA CAPILAR\t\tPOR TURNO\t\tNW\n' +
    '26/06/2026 08:59:39 a.m.\tDIETAS\tAYUNO\t\t\tNW\n' +
    '26/06/2026 07:17:55 a.m.\tMEDICAMENTOS\tBUPRENORFINA 0.3 MG SOL INY 1 ML\tVIA INTRAVENOSA\t75 MCG //\tPRN\tNW';
  var r = parseIndicacionesPaste(paste);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'AYUNO');
  assert.equal(r.items.length, 1);
});

test('parseIndicacionesPaste — dieta con columna VIA vacía colapsada (5 cols)', () => {
  var line =
    '20/06/2026 07:50:06 a.m.\tDIETAS\tBLANDA PICADA ALTA EN FIBRA\t1500 KCAL + 60 GR DE PROTEINA\tNW';
  var r = parseIndicacionesPaste(line);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'BLANDA PICADA ALTA EN FIBRA');
  assert.equal(r.dietas[0].kcal, 1500);
  assert.equal(r.dietas[0].proteinG, 60);
  assert.equal(looksLikeSomeIndicacionesPaste(line), true);
});

test('parseIndicacionesPaste — dieta con descripción desplazada a columna VIA', () => {
  var line =
    '22/06/2026 07:01:02 a.m.\tDIETAS\t\tNORMAL DIABETICA ALTA EN FIBRA\t1500 KCAL + 60 GR DE PROTEINA\tNW';
  var r = parseIndicacionesPaste(line);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'NORMAL DIABETICA ALTA EN FIBRA');
  assert.equal(r.dietas[0].kcal, 1500);
  assert.equal(r.dietas[0].proteinG, 60);
});

test('parseIndicacionesPaste — bloque mixto con dieta colapsada', () => {
  var paste =
    '20/06/2026 07:49:38 a.m.\tCUIDADOS\tCOLOCAR SELLO VENOSO\t\t\t\tNW\n' +
    '20/06/2026 07:50:06 a.m.\tDIETAS\tBLANDA PICADA ALTA EN FIBRA\t1500 KCAL + 60 GR DE PROTEINA\tNW\n' +
    '20/06/2026 07:49:28 a.m.\tMEDICAMENTOS\tPARACETAMOL 1 G SOL INY 100 ML (*)\tVIA INTRAVENOSA\t1 G //\tCADA 8 HORAS\tNW';
  var r = parseIndicacionesPaste(paste);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].kcal, 1500);
  assert.equal(r.items.length, 1);
});

test('mergeDietaItems concatena descripciones y toma kcal/prot de última fila con patrón', () => {
  var merged = mergeDietaItems([
    { descripcionRaw: 'BLANDA', detalleRaw: '1200 KCAL', kcal: 1200, proteinG: null },
    { descripcionRaw: 'NORMAL PICADA', detalleRaw: '2000 KCAL + 70 GR PROTEINA', kcal: 2000, proteinG: 70 },
  ]);
  assert.equal(merged.descripcion, 'BLANDA · NORMAL PICADA');
  assert.equal(merged.kcal, 2000);
  assert.equal(merged.proteinG, 70);
});

test('buildDietProposalText resume dieta con macros', () => {
  var t = buildDietProposalText({
    descripcion: 'NORMAL PICADA ALTA EN FIBRA',
    kcal: 2000,
    proteinG: 70,
  });
  assert.match(t, /NORMAL PICADA/i);
  assert.match(t, /2000/i);
  assert.match(t, /70/i);
});

test('parseIndicacionesPaste separa meds, dieta y skipped', () => {
  var r = parseIndicacionesPaste(SAMPLE_MIXED);
  assert.equal(r.items.length, 2);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].proteinG, 70);
  assert.equal(r.skippedSummary.cuidados, 1);
  assert.equal(r.skippedSummary.estudios, 1);
});

test('looksLikeSomeIndicacionesPaste true con solo DIETAS', () => {
  var line = '10/06/2026 06:27:36 a.m.\tDIETAS\tNORMAL\t\t2000 KCAL\t\tNW';
  assert.equal(looksLikeSomeIndicacionesPaste(line), true);
});

test('shouldAutoSelectSoap pre-marca MEROPENEM; excluye D50 y PRN no analgésico', () => {
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'MEROPENEM 1 G SOL INY',
      viaRaw: 'VIA INTRAVENOSA',
      dosisRaw: '1 G //',
      frecuenciaRaw: 'CADA 8 HORAS',
    }),
    true
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'DEXTROSA 50 % SOL INY 50 ML',
      dosisRaw: '50 ML / VEL.INF: EN CASO DE GLUCOSA <70 MG/DL',
      frecuenciaRaw: 'PRN',
    }),
    false
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'ONDANSETRON 8 MG SOL INY 4 ML',
      dosisRaw: '8 MG // CRITERIO PRN: EN CASO DE NAUSEAS O VÓMITO',
      frecuenciaRaw: 'PRN',
    }),
    false
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'PARACETAMOL 1 G SOL INY 100 ML',
      dosisRaw: '1 G // CRITERIO PRN: EN CASO DE DOLOR',
      frecuenciaRaw: 'PRN',
    }),
    true
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'SULFATO DE MAGNESIO 1 G SOL INY 10 ML',
      dosisRaw: '4 G DILUIR',
      frecuenciaRaw: 'UNICA VEZ',
    }),
    true
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'INSULINA HUMANA RAPIDA',
      viaRaw: 'VIA SUBCUTANEA',
      dosisRaw: '4 UI // CRITERIO PRN: EN CASO DE DESTROXTIS ENTRE 180 - 220',
      frecuenciaRaw: 'PRN',
    }),
    true
  );
  assert.equal(
    shouldAutoSelectSoap({
      nombreRaw: 'DEXAMETASONA 8 MG SOL INY',
      dosisRaw: '8 MG //',
      frecuenciaRaw: 'CADA 24 HORAS',
    }),
    true
  );
});

test('parseMedicationPaste sigue devolviendo solo meds', () => {
  var r = parseMedicationPaste(SAMPLE_MIXED);
  assert.equal(r.items.length, 2);
  assert.equal(r.dietas, undefined);
});

test('applyMedCatalogOverlay clasifica tokens personalizados antes que listas internas', () => {
  applyMedCatalogOverlay({
    accents: {},
    soapTokens: { vasop: [], abx: [], analgesia: ['FARMACOX'], antihta: [] },
  });
  assert.equal(classifyMedicationSoapCategory('FARMACOX 500 MG'), 'analgesia');
});

test('parseIndicacionesPaste — bloque real usuario 2026-07-19 (14 meds, P1, dieta)', () => {
  var paste = readFileSync(
    new URL('../../fixtures/some-paste-user-2026-07-19.tsv', import.meta.url),
    'utf8'
  );
  var r = parseIndicacionesPaste(paste);
  assert.equal(looksLikeSomeIndicacionesPaste(paste), true);
  assert.equal(r.items.length, 14);
  assert.equal(r.dietas.length, 1);
  assert.equal(r.dietas[0].descripcionRaw, 'AYUNO');
  assert.ok(
    r.items.some(function (it) {
      return /CLORURO DE SODIO/i.test(it.nombreRaw || '');
    }),
    'incluye MEDICAMENTOS P1 (bomba)'
  );
});
