import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInternoMedicionToPatient,
  buildInternoMedicion,
  isGluAltered,
} from './interno-vitals.mjs';
import {
  buildInternoBoardDto,
  compareInternoBoardRowsByVitalsFrequency,
  parsePendientesJson,
  abbreviatePatientName,
} from './interno-board.mjs';
import { serializePendientesJson } from '../entrega/entrega-pendientes.mjs';
import { calcVitalsBanner } from './vitals-banner.mjs';

test('isGluAltered flags hypo and hyper', () => {
  assert.equal(isGluAltered(65), true);
  assert.equal(isGluAltered(200), true);
  assert.equal(isGluAltered(110), false);
});

test('buildInternoMedicion sets alteredAt for high FC', () => {
  const out = buildInternoMedicion({
    vitals: { fc: 130 },
    sala: 'Sala 1',
  });
  assert.equal(out.ok, true);
  assert.ok(out.medicion?.alteredAt?.fc);
  assert.equal(out.hasAlterations, true);
});

test('buildInternoMedicion accepts glucometrias only', () => {
  const out = buildInternoMedicion({
    glucometrias: [{ value: 210, time: '22:00' }],
    reporterName: 'Ana',
    sala: 'Sala 1',
  });
  assert.equal(out.ok, true);
  assert.equal(out.medicion?.recordedBy?.name, 'Ana');
  assert.ok(out.medicion?.alteredAt?.glu);
});

test('parsePendientesJson extracts time from legacy lines', () => {
  const items = parsePendientesJson(JSON.stringify(['Endoscopia HOY 14:00', 'Hb mañana']));
  assert.equal(items.length, 2);
  assert.equal(items[0].label, 'Endoscopia HOY 14:00');
  assert.equal(items[0].time, '14:00');
  assert.deepEqual(items[0].badges, []);
});

test('abbreviatePatientName', () => {
  assert.match(abbreviatePatientName('García López María'), /GARCÍA/);
});

test('calcVitalsBanner breached', () => {
  const past = new Date(Date.now() - 5 * 3600000).toISOString();
  const b = calcVitalsBanner(past, '2h');
  assert.equal(b.cls, 'breached');
});

test('buildInternoBoardDto hides explicit routine vitals plan without pendientes', () => {
  const pendientesJson = serializePendientesJson({
    version: 2,
    vitalsPlan: {
      frequency: { mode: 'routine' },
      metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
    },
    items: [],
  });
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        pendientes_json: pendientesJson,
        vitals_frequency: 'None',
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients.length, 0);
});

test('applyInternoMedicionToPatient appends historial entry', () => {
  const built = buildInternoMedicion({ vitals: { fc: 88 }, sala: 'Sala 1' });
  assert.equal(built.ok, true);
  const patient = { id: 'p1', monitoreo: { historial: [], estadoClinico: {}, confirmado: {} } };
  const applied = applyInternoMedicionToPatient(patient, built.medicion);
  assert.equal(applied.ok, true);
  assert.equal(patient.monitoreo.historial.length, 1);
  assert.equal(patient.monitoreo.historial[0].vitals.fc, 88);
});

test('buildInternoBoardDto marks signos pending without estudios', () => {
  const pendientesJson = serializePendientesJson({
    version: 2,
    vitalsPlan: {
      frequency: { mode: 'interval', hours: 2 },
      metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
    },
    items: [],
  });
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        covering_user_id: 'r1a',
        pendientes_json: pendientesJson,
        vitals_frequency: '2h',
        last_vitals_check: new Date().toISOString(),
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'García López Ana', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients.length, 1);
  assert.equal(board.patients[0].signosPending, true);
  assert.equal(board.patients[0].estudiosPending, 0);
  assert.equal(board.summary.signosMonitored, 1);
  assert.ok(board.patients[0].vitals.metrics.length > 0);
  assert.deepEqual(board.patients[0].vitals.metricKeys, [
    'ta',
    'fc',
    'fr',
    'temp',
    'sat',
    'glu',
  ]);
});

test('buildInternoBoardDto uses legacy vitals_frequency when plan is routine', () => {
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        pendientes_json: '{"version":2,"items":[]}',
        vitals_frequency: '2h',
        last_vitals_check: new Date(Date.now() - 5 * 3600000).toISOString(),
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients[0].vitals.cls, 'breached');
  assert.match(board.patients[0].vitals.frequency, /2 h/);
  assert.ok(board.patients[0].vitals.metrics.length > 0);
  assert.match(board.patients[0].vitals.summary, /TA/);
});

test('buildInternoBoardDto omits routine-only entrega without estudios pendientes', () => {
  const pendientesJson = serializePendientesJson({
    version: 2,
    vitalsPlan: {
      frequency: { mode: 'routine' },
      metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
    },
    items: [],
  });
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        pendientes_json: pendientesJson,
        vitals_frequency: 'None',
        last_vitals_check: null,
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients.length, 0);
  assert.equal(board.summary.total, 0);
});

test('buildInternoBoardDto keeps routine entrega when estudios pendientes exist', () => {
  const pendientesJson = serializePendientesJson({
    version: 2,
    vitalsPlan: {
      frequency: { mode: 'routine' },
      metrics: { ta: true, fc: false, fr: false, temp: false, sat: false, glu: false },
    },
    items: [
      {
        id: 'proc1',
        type: 'procedimiento',
        label: 'TAC',
        completedAt: null,
      },
    ],
  });
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        pendientes_json: pendientesJson,
        vitals_frequency: 'None',
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients.length, 1);
  assert.equal(board.patients[0].signosPending, false);
  assert.equal(board.patients[0].estudiosPending, 1);
});

test('buildInternoBoardDto sorts patients by vitals frequency (highest first)', () => {
  const vitalsPlan = (hours) =>
    serializePendientesJson({
      version: 2,
      vitalsPlan: {
        frequency: { mode: 'interval', hours },
        metrics: { ta: true, fc: true, fr: false, temp: false, sat: false, glu: false },
      },
      items: [],
    });

  const guardias = new Map([
    [
      'p1h',
      {
        patient_id: 'p1h',
        pendientes_json: vitalsPlan(1),
        vitals_frequency: '1h',
        last_vitals_check: new Date().toISOString(),
        status: 'Active',
      },
    ],
    [
      'p4h',
      {
        patient_id: 'p4h',
        pendientes_json: vitalsPlan(4),
        vitals_frequency: '4h',
        last_vitals_check: new Date().toISOString(),
        status: 'Active',
      },
    ],
    [
      'p2h',
      {
        patient_id: 'p2h',
        pendientes_json: vitalsPlan(2),
        vitals_frequency: '2h',
        last_vitals_check: new Date().toISOString(),
        status: 'Active',
      },
    ],
    [
      'proc',
      {
        patient_id: 'proc',
        pendientes_json: serializePendientesJson({
          version: 2,
          vitalsPlan: {
            frequency: { mode: 'routine' },
            metrics: { ta: false, fc: false, fr: false, temp: false, sat: false, glu: false },
          },
          items: [{ id: 'x', type: 'procedimiento', label: 'TAC', completedAt: null }],
        }),
        vitals_frequency: 'None',
        status: 'Active',
      },
    ],
  ]);

  const board = buildInternoBoardDto(
    'Sala 1',
    [
      { id: 'p4h', nombre: 'Cuatro', cuarto: '1', cama: '1' },
      { id: 'proc', nombre: 'Estudio', cuarto: '2', cama: '1' },
      { id: 'p2h', nombre: 'Dos', cuarto: '3', cama: '1' },
      { id: 'p1h', nombre: 'Uno', cuarto: '4', cama: '1' },
    ],
    guardias
  );

  assert.deepEqual(
    board.patients.map((p) => p.id),
    ['p1h', 'p2h', 'p4h', 'proc']
  );
});

test('compareInternoBoardRowsByVitalsFrequency breaks ties by bed', () => {
  const row = (id, cuarto, hours) => ({
    id,
    signosPending: true,
    cuarto: String(cuarto),
    cama: '1',
    bedLabel: `${cuarto}-1`,
    nameShort: id,
    vitals: { cls: 'nominal', frequencyMs: hours * 3600000 },
  });
  const rows = [row('b', 12, 2), row('a', 3, 2), row('c', 3, 2)].sort(
    compareInternoBoardRowsByVitalsFrequency
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'c', 'b']
  );
});

test('buildInternoBoardDto legacy vitals_frequency enables interno metrics', () => {
  const guardias = new Map([
    [
      'p1',
      {
        patient_id: 'p1',
        pendientes_json: '["Control TA"]',
        vitals_frequency: '2h',
        last_vitals_check: null,
        status: 'Active',
      },
    ],
  ]);
  const board = buildInternoBoardDto(
    'Sala 1',
    [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
    guardias
  );
  assert.equal(board.patients[0].signosPending, true);
  assert.ok(board.patients[0].vitals.metricKeys.includes('ta'));
});
