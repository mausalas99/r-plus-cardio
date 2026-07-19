import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEstadoActualText } from './estado-actual-text.mjs';
import { buildHiTempClause } from './estado-actual-text-build.mjs';
import { emptyMonitoreo, deriveSnapshot } from './estado-actual-data.mjs';

test('buildEstadoActualText usa placeholders y omite línea S', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.four = '15';
  m.historial.push({
    id: '1',
    recordedAt: '2026-05-26T08:00:00.000Z',
    vitals: { tas: 120, tad: 80, fc: 82 },
    glucometrias: [{ value: 140, time: '08:00' }],
    io: { ing: 500, egr: 300 },
  });
  const textNc = buildEstadoActualText(
    m.estadoClinico,
    { vitals: {}, glucometrias: [], io: { ing: 500, egr: 'NC' } },
    { balanceTurno: NaN },
    {}
  );
  assert.match(textNc, /DIURESIS NC/);
  assert.match(textNc, /BALANCE NC\b/);

  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {
    balanceTurno: 200,
    balanceGlobal: 200,
  });
  assert.doesNotMatch(text, /^S:/m);
  assert.match(text, /FOUR 15\/16/);
  assert.match(text, /TA 120\/80/);
  assert.match(text, /GLUCOMETRÍAS CAPILARES \(140 MG\/DL\)/);
  assert.doesNotMatch(text, /GLUCOMETRÍAS CAPILARES \(140, ___/);
  assert.match(text, /BALANCE \+200 CC/);
  assert.match(text, /INGRESOS 500 CC, DIURESIS 300 CC/);
  // Formato seccional N / HD
  assert.match(text, /ANALGESIA:.*\| ANTIEMETICOS:.*\| SEDACION:.*\| ANTIEPILEPTICOS:.*\| ANTIPARKINSONIANOS:.*\| ANTIDOTOS:/);
  assert.match(text, /TROMBOPROFILAXIS:.*\| ANTICOAGULACION:/);
  assert.match(text, /VASOPRESORES:.*\| ANTIHIPERTENSIVOS:/);
  assert.doesNotMatch(text, /RESCATES DE INSULINA/);
});

test('buildEstadoActualText documenta rescates disponibles solo con escala SOME', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '1',
    recordedAt: '2026-05-26T08:00:00.000Z',
    vitals: {},
    glucometrias: [{ value: 140, time: '08:00' }],
    io: {},
  });
  const text = buildEstadoActualText(
    m.estadoClinico,
    deriveSnapshot(m),
    { balanceTurno: NaN },
    {
      recetaBlock: {
        items: [],
        pasteRaw:
          '26/06/2026 07:17:48 a.m.\tCUIDADOS\tRESCATE DE INSULINA\t180-220 4 UI, 221-250 6 UI\tPOR TURNO\tNW',
      },
    }
  );
  assert.match(text, /RESCATES DE INSULINA DISPONIBLES/);
  assert.doesNotMatch(text, /INSULINA: RESCATES DE INSULINA/);
});

test('buildEstadoActualText — rescates en NM aunque no haya glucometrías', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.nm = 'RESCATES DE INSULINA';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {});
  assert.match(text, /RESCATES DE INSULINA DISPONIBLES/);
  assert.doesNotMatch(text, /INSULINA: RESCATES DE INSULINA/);
});

test('buildEstadoActualText — vía aérea en V y sedación en N', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.viaAerea = 'SALBUTAMOL 5 MG NEB C/6H';
  m.estadoClinico.sedacion = 'MIDAZOLAM 2 MG IV C/8H';
  m.estadoClinico.antiepilepticos = 'LEVETIRACETAM 500 MG VO C/12H';
  m.historial.push({
    id: 'meds',
    recordedAt: '2026-05-26T08:00:00.000Z',
    vitals: { fr: 18, sat: 94 },
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  assert.match(text, /V:.*VIA AEREA: SALBUTAMOL 5 MG NEB C\/6H/);
  assert.match(text, /N:.*SEDACION: MIDAZOLAM 2 MG IV C\/8H/);
  assert.match(text, /N:.*ANTIEPILEPTICOS: LEVETIRACETAM 500 MG VO C\/12H/);
});

test('buildEstadoActualText incluye traqueostomía en línea V', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.soporte = 'Traqueostomía';
  m.historial.push({
    id: 'tqt',
    recordedAt: '2026-05-26T08:00:00.000Z',
    vitals: { fr: 16, sat: 96 },
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  assert.match(text, /SATO2 96% CON TRAQUEOSTOMÍA/);
});

test('buildEstadoActualText documenta rescates aplicados', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '2',
    recordedAt: '2026-05-26T14:00:00.000Z',
    vitals: {},
    glucometrias: [{ value: 248, time: '14:00', altered: true, rescueUnits: 6, postRescueValue: 182 }],
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  assert.match(text, /GLUCOMETRÍAS CAPILARES \(248, 6UI\)/);
  assert.doesNotMatch(text, /RESCATES DE INSULINA APLICADOS/);
  assert.doesNotMatch(text, /RESCATES DE INSULINA DISPONIBLES/);
  assert.doesNotMatch(text, /INSULINA: RESCATES/);
});

test('buildEstadoActualText omits glucometrías clause when none registered', () => {
  const m = emptyMonitoreo();
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {});
  assert.doesNotMatch(text, /GLUCOMETRÍAS CAPILARES/);
  assert.doesNotMatch(text, /RESCATES DE INSULINA/);
});

test('buildEstadoActualText une antihipertensivos, diuréticos y NM en formato corto', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.antihta = 'NIFEDIPINO 60MG VO C/12H | SACUBITRILO/VALSARTÁN 200MG VO C/12H';
  m.estadoClinico.diureticos = 'FUROSEMIDA 80MG IV C/8H';
  m.estadoClinico.antitromboticos = 'ENOXAPARINA 40MG SC C/24H | ACIDO ACETILSALICILICO 100MG VO C/24H';
  m.estadoClinico.nm = 'INSULINA GLARGINA 10UI SC C/24H | LEVOTIROXINA 50MCG VO C/24H';
  m.estadoClinico.abx = 'MEROPENEM 1G IV C/8H DIA 13';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {});
  assert.match(text, /ANTIHIPERTENSIVOS: NIFEDIPINO 60MG VO C\/12H, SACUBITRILO\/VALSARTÁN 200MG VO C\/12H/);
  assert.match(text, /DIURÉTICOS: FUROSEMIDA 80MG IV C\/8H/);
  assert.match(text, /TROMBOPROFILAXIS: ENOXAPARINA 40MG SC C\/24H, ACIDO ACETILSALICILICO 100MG VO C\/24H/);
  assert.match(text, /ANTIBIOTICOTERAPIA: MEROPENEM 1G IV C\/8H DIA 13/);
  assert.match(text, /LEVOTIROXINA 50MCG VO C\/24H/);
  assert.match(text, /INSULINA: INSULINA GLARGINA 10UI SC C\/24H/);
});

test('buildEstadoActualText incluye GR PROTEINA cuando proteinG está definido', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.dieta = 'NORMAL PICADA';
  m.estadoClinico.kcal = '2000';
  m.estadoClinico.proteinG = '70';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {
    patientPeso: 60,
  });
  assert.match(text, /\+ 70 GR PROTEINA/);
});

test('buildEstadoActualText calcula kcal total con peso del paciente', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.kcalKg = '25';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {
    patientPeso: 70,
  });
  assert.match(text, /25 KCAL\/KG \(1750 KCAL\)/);
  assert.doesNotMatch(text, /PARA PESO DE/i);
});

test('buildEstadoActualText dieta suplemento sin requerimiento calórico', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.dieta = 'SUPLEMENTO';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {});
  const nmLine = text.split('\n').find((line) => line.startsWith('NM:'));
  assert.match(nmLine, /^NM: DIETA SUPLEMENTO \|\|/);
  assert.doesNotMatch(nmLine, /CALCULADA A/);
  assert.doesNotMatch(nmLine, /KCAL\/KG/);
});

test('buildEstadoActualText SOME *SUPLEMENTO sin cláusula calórica', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.dieta = '*SUPLEMENTO';
  m.estadoClinico.kcalKg = '25';
  const text = buildEstadoActualText(m.estadoClinico, { vitals: {}, glucometrias: [], io: {} }, {}, {});
  const nmLine = text.split('\n').find((line) => line.startsWith('NM:'));
  assert.match(nmLine, /^NM: DIETA SUPLEMENTO \|\|/);
  assert.doesNotMatch(nmLine, /CALCULADA A/);
});

test('buildHiTempClause documenta pico febril (≥38 °C) con fecha corta', () => {
  const recordedAt = new Date(2026, 5, 22, 6, 0, 0).toISOString();
  const now = new Date(2026, 5, 24, 12, 0, 0);
  const clause = buildHiTempClause(
    { temp: 36, tempPeak: 38.2 },
    { tempPeak: '08:00' },
    { recordedAt, time: '08:00' },
    now
  );
  assert.equal(clause, 'TEMPERATURA 36 °C (PICO 38.2 °C @ 22/06 08:00)');
});

test('buildHiTempClause omite pico < 38 °C aunque difiera de la actual', () => {
  const recordedAt = new Date(2026, 5, 22, 6, 0, 0).toISOString();
  const now = new Date(2026, 5, 24, 12, 0, 0);
  const clause = buildHiTempClause(
    { temp: 36, tempPeak: 37.2 },
    { tempPeak: '08:00' },
    { recordedAt, time: '08:00' },
    now
  );
  assert.equal(clause, 'TEMPERATURA 36 °C');
});

test('buildHiTempClause pico en cierre de turno usa fecha corta 00:00', () => {
  const recordedAt = new Date(2026, 5, 26, 0, 0, 0).toISOString();
  const now = new Date(2026, 5, 26, 18, 0, 0);
  const clause = buildHiTempClause(
    { temp: 36, tempPeak: 38.4 },
    { tempPeak: '00:00' },
    { recordedAt, time: '00:00' },
    now
  );
  assert.equal(clause, 'TEMPERATURA 36 °C (PICO 38.4 °C @ 26/06 00:00)');
});

test('buildHiTempClause omite pico febril mayor a 5 días', () => {
  const peakAt = new Date(2026, 5, 20, 8, 0, 0);
  const now = new Date(2026, 5, 26, 12, 0, 0);
  const clause = buildHiTempClause(
    { temp: 36, tempPeak: 38.5 },
    { tempPeak: '08:00' },
    { recordedAt: peakAt.toISOString(), time: '08:00' },
    now
  );
  assert.equal(clause, 'TEMPERATURA 36 °C');
});

test('buildEstadoActualText bomba de insulina muestra glucosa sin sufijo mg/dL', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '1',
    recordedAt: '2026-06-22T14:00:00.000Z',
    vitals: {},
    bombaInsulina: [
      { value: 320, units: 7 },
      { value: 209, units: 3 },
      { value: 257, units: 0.5 },
    ],
    glucometrias: [],
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  assert.match(text, /BOMBA DE INSULINA \(320 \(7 U\), 209 \(3 U\), 257 \(0\.5 U\)\)/);
  assert.doesNotMatch(text, /mg\/dL/i);
});

test('buildEstadoActualText marca INESTABLE con hipotensión', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '1',
    recordedAt: '2026-06-22T14:00:00.000Z',
    vitals: { tas: 85, tad: 55, fc: 80 },
    glucometrias: [],
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  const hdLine = text.split('\n').find((line) => line.startsWith('HD:'));
  assert.match(hdLine, /^HD: INESTABLE,/);
});

test('buildEstadoActualText marca INESTABLE con vasopresores aunque TA normal', () => {
  const m = emptyMonitoreo();
  m.estadoClinico.vasop = 'NOREPINEFRINA 0.1 MCG/KG/MIN';
  const text = buildEstadoActualText(
    m.estadoClinico,
    { vitals: { tas: 120, tad: 70, fc: 80 }, glucometrias: [], io: {} },
    {},
    {}
  );
  const hdLine = text.split('\n').find((line) => line.startsWith('HD:'));
  assert.match(hdLine, /^HD: INESTABLE,/);
});

test('buildEstadoActualText mantiene ESTABLE con hipertensión aislada', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '1',
    recordedAt: '2026-06-22T14:00:00.000Z',
    vitals: { tas: 155, tad: 95, fc: 80 },
    glucometrias: [],
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  const hdLine = text.split('\n').find((line) => line.startsWith('HD:'));
  assert.match(hdLine, /^HD: ESTABLE,/);
});

test('buildEstadoActualText marca FEBRIL cuando temperatura actual supera umbral', () => {
  const m = emptyMonitoreo();
  m.historial.push({
    id: '1',
    recordedAt: '2026-06-22T14:00:00.000Z',
    vitals: { temp: 38.4 },
    glucometrias: [],
    io: {},
  });
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  const hiLine = text.split('\n').find((line) => line.startsWith('HI:'));
  assert.match(hiLine, /^HI: FEBRIL,/);
});

test('buildEstadoActualText marca AFEBRIL con pico febril documentado en paréntesis', () => {
  const m = emptyMonitoreo();
  m.historial = [
    {
      id: '1',
      recordedAt: '2026-06-22T06:00:00.000Z',
      vitals: { temp: 36 },
      vitalSeries: {
        temp: [
          { value: 38.2, time: '08:00' },
          { value: 36, time: '16:00' },
        ],
      },
      glucometrias: [],
      io: {},
    },
  ];
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {
    now: new Date(2026, 5, 22, 18, 0, 0),
  });
  const hiLine = text.split('\n').find((line) => line.startsWith('HI:'));
  assert.match(hiLine, /^HI: AFEBRIL,/);
  assert.match(hiLine, /PICO 38\.2 °C/);
});

test('buildEstadoActualText temperatura con pico febril reciente en turno', () => {
  const m = emptyMonitoreo();
  const recordedAt = new Date(2026, 5, 22, 6, 0, 0).toISOString();
  m.historial = [
    {
      id: '1',
      recordedAt,
      vitals: { temp: 36, fr: 15, sat: 97, tas: 120, tad: 60, fc: 98 },
      vitalSeries: {
        temp: [
          { value: 38.2, time: '08:00' },
          { value: 36, time: '16:00' },
        ],
      },
      glucometrias: [],
      io: {},
    },
  ];
  const snap = deriveSnapshot(m);
  const text = buildEstadoActualText(m.estadoClinico, snap, {}, { now: new Date(2026, 5, 22, 18, 0, 0) });
  const hiLine = text.split('\n').find((line) => line.startsWith('HI:'));
  assert.match(hiLine, /TEMPERATURA 36 °C \(PICO 38\.2 °C @ 22\/06 08:00\)/);
  assert.doesNotMatch(hiLine, /TEMPERATURA.*TEMPERATURA/);
});

test('buildEstadoActualText omite pico subfebril en turno', () => {
  const m = emptyMonitoreo();
  const recordedAt = new Date(2026, 5, 22, 6, 0, 0).toISOString();
  m.historial = [
    {
      id: '1',
      recordedAt,
      vitals: { temp: 36 },
      vitalSeries: {
        temp: [
          { value: 37.2, time: '08:00' },
          { value: 36, time: '16:00' },
        ],
      },
      glucometrias: [],
      io: {},
    },
  ];
  const text = buildEstadoActualText(m.estadoClinico, deriveSnapshot(m), {}, {});
  const hiLine = text.split('\n').find((line) => line.startsWith('HI:'));
  assert.match(hiLine, /TEMPERATURA 36 °C/);
  assert.doesNotMatch(hiLine, /PICO/);
});
