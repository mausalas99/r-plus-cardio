import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergePatientEntry,
  mergeLanPatientEntrySources,
  mergeLabHistorySets,
  entryMatchKey,
  filterEntriesByPatientDeletes,
  entryUpdatedAt,
  monitoreoUpdatedAt,
  mergeEventualidades,
  mergeHistoriaClinica,
  cloneEntry,
} from './lan-patient-merge.mjs';
import { emptyMonitoreo } from './features/estado-actual-data.mjs';

test('entryUpdatedAt incluye textoGuardado.savedAt de monitoreo', () => {
  const e = {
    patient: {
      id: 'p1',
      monitoreo: {
        historial: [],
        textoGuardado: { text: 'x', savedAt: '2026-05-20T12:00:00.000Z' },
      },
    },
    note: { fecha: '01/01/2026' },
    labHistory: [],
  };
  assert.equal(entryUpdatedAt(e), '2026-05-20T12:00:00.000Z');
});

test('entryUpdatedAt incluye el recordedAt m?s reciente del historial', () => {
  const e = {
    patient: {
      id: 'p1',
      monitoreo: {
        historial: [
          { id: '1', recordedAt: '2026-04-01T08:00:00.000Z' },
          { id: '2', recordedAt: '2026-05-21T10:00:00.000Z' },
        ],
        textoGuardado: { text: '', savedAt: '2026-05-01T00:00:00.000Z' },
      },
    },
    note: {},
    labHistory: [],
  };
  assert.equal(entryUpdatedAt(e), '2026-05-21T10:00:00.000Z');
});

test('monitoreoUpdatedAt combina historial y texto guardado', () => {
  assert.equal(
    monitoreoUpdatedAt({
      historial: [{ id: '1', recordedAt: '2026-01-01T00:00:00.000Z' }],
      textoGuardado: { text: 'x', savedAt: '2026-06-01T00:00:00.000Z' },
    }),
    '2026-06-01T00:00:00.000Z'
  );
});

test('mergePatientEntry conserva medPharmProfile m?s reciente', () => {
  const older = {
    patient: { id: 'p', registro: 'R' },
    note: { fecha: '01/01/2026' },
    labHistory: [],
    medPharmProfile: {
      months: {
        '2026-05': { lastSomePasteAt: '2026-05-01T00:00:00.000Z', rows: [{ rowKey: 'a' }] },
      },
    },
  };
  const newer = {
    patient: { id: 'p', registro: 'R' },
    note: { fecha: '10/01/2026' },
    labHistory: [],
    medPharmProfile: {
      months: {
        '2026-05': { lastSomePasteAt: '2026-06-01T00:00:00.000Z', rows: [{ rowKey: 'b' }] },
      },
    },
  };
  const merged = mergePatientEntry(older, newer);
  assert.equal(merged.medPharmProfile.months['2026-05'].rows[0].rowKey, 'b');
});

test('mergePatientEntry fusiona monitoreo con mergeMonitoreo si ambos tienen carga', () => {
  const longHist = {
    historial: [
      { id: 'x', recordedAt: '2026-01-02T00:00:00.000Z', vitals: { fc: '90' } },
      { id: 'y', recordedAt: '2026-01-03T00:00:00.000Z', vitals: { fc: '100' } },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  const shortHist = {
    historial: [{ id: 'z', recordedAt: '2026-01-04T00:00:00.000Z', vitals: { fc: '110' } }],
    textoGuardado: { text: '', savedAt: null },
  };
  const newerNote = {
    patient: { id: 'p', registro: 'R', nombre: 'X', monitoreo: shortHist },
    note: { fecha: '10/01/2026' },
    labHistory: [],
  };
  const olderNote = {
    patient: { id: 'p', registro: 'R', nombre: 'X', monitoreo: longHist },
    note: { fecha: '01/01/2026' },
    labHistory: [],
  };
  const m = mergePatientEntry(olderNote, newerNote);
  assert.equal(m.patient.monitoreo.historial.length, 3);
  assert.equal(m.patient.monitoreo.historial[0].id, 'x');
  assert.equal(m.patient.monitoreo.historial[2].id, 'z');
});

test('mergePatientEntry conserva solo el monitoreo del lado que tiene datos', () => {
  const withText = {
    patient: {
      id: 'p',
      registro: 'R',
      monitoreo: {
        historial: [],
        textoGuardado: { text: 'solo ac?', savedAt: '2026-02-01T00:00:00.000Z' },
      },
    },
    note: { fecha: '05/01/2026' },
    labHistory: [],
  };
  const emptyMon = {
    patient: {
      id: 'p',
      registro: 'R',
      monitoreo: { historial: [], textoGuardado: { text: '', savedAt: null } },
    },
    note: { fecha: '01/01/2026' },
    labHistory: [],
  };
  const m = mergePatientEntry(emptyMon, withText);
  assert.equal(m.patient.monitoreo.textoGuardado.text, 'solo ac?');
});

test('mergePatientEntry conserva monitoreo local solo con estado cl?nico general', () => {
  const localMon = emptyMonitoreo();
  localMon.estadoClinico.four = '15';
  const withEc = {
    patient: { id: 'p', registro: 'R', monitoreo: localMon },
    note: { fecha: '05/01/2026' },
    labHistory: [],
  };
  const withoutMon = {
    patient: { id: 'p', registro: 'R' },
    note: { fecha: '01/01/2026' },
    labHistory: [],
  };
  const m = mergePatientEntry(withoutMon, withEc);
  assert.equal(m.patient.monitoreo.estadoClinico.four, '15');
});

test('cloneEntry copia monitoreo en profundidad', () => {
  const inner = {
    historial: [{ id: 'h1', recordedAt: '2026-01-01T00:00:00.000Z' }],
    textoGuardado: { text: 't', savedAt: null },
  };
  const e = {
    patient: { id: 'p1', registro: 'x', monitoreo: inner },
    note: {},
    labHistory: [],
  };
  const c = cloneEntry(e);
  c.patient.monitoreo.historial.push({ id: 'h2', recordedAt: '2026-01-02T00:00:00.000Z' });
  assert.equal(e.patient.monitoreo.historial.length, 1);
});

test('entryMatchKey usa registro cuando existe', () => {
  assert.equal(entryMatchKey({ patient: { id: 'a', registro: '123' } }), 'reg:123');
  assert.equal(entryMatchKey({ patient: { id: 'a', registro: '' } }), 'id:a');
});

test('mergeLanPatientEntrySources une pacientes distintos sin borrar', () => {
  const merged = mergeLanPatientEntrySources([
    { entries: [{ patient: { id: 'p1', registro: 'A', nombre: 'UNO' }, note: { fecha: '01/01/2026' }, labHistory: [] }] },
    { entries: [{ patient: { id: 'p2', registro: 'B', nombre: 'DOS' }, note: { fecha: '02/01/2026' }, labHistory: [] }] },
  ]);
  assert.equal(merged.length, 2);
});

test('mergePatientEntry combina labHistory por id', () => {
  const a = {
    patient: { id: 'p1', registro: 'X', nombre: 'A' },
    note: {},
    labHistory: [{ id: '1', fecha: '01/01/2026', resLabs: ['Hb 10'] }],
  };
  const b = {
    patient: { id: 'p1', registro: 'X', nombre: 'A' },
    note: {},
    labHistory: [{ id: '2', fecha: '02/01/2026', resLabs: ['Hb 12'] }],
  };
  const m = mergePatientEntry(a, b);
  assert.equal(m.labHistory.length, 2);
});

test('mergeLabHistorySets gana el set m?s reciente con mismo id', () => {
  const out = mergeLabHistorySets(
    [{ id: '100', fecha: '01/01/2026', resLabs: ['viejo'] }],
    [{ id: '100', fecha: '10/01/2026', resLabs: ['nuevo'] }]
  );
  assert.equal(out.length, 1);
  assert.match(String(out[0].resLabs), /nuevo/);
});

test('mergePatientEntry fusiona pendientes por id', () => {
  const a = {
    patient: { id: 'p1', registro: 'R1' },
    todos: [{ id: 't1', text: 'viejo', updatedAt: '2026-01-01T00:00:00Z' }],
  };
  const b = {
    patient: { id: 'p1', registro: 'R1' },
    todos: [{ id: 't1', text: 'nuevo', updatedAt: '2026-01-15T00:00:00Z' }],
  };
  const m = mergePatientEntry(a, b);
  assert.equal(m.todos.length, 1);
  assert.equal(m.todos[0].text, 'nuevo');
});

test('mismo registro fusiona nota m?s reciente', () => {
  const merged = mergeLanPatientEntrySources([
    {
      entries: [
        {
          patient: { id: 'local', registro: 'R1', nombre: 'PAC' },
          note: { fecha: '01/01/2026', evolucion: 'vieja' },
          labHistory: [],
        },
      ],
    },
    {
      entries: [
        {
          patient: { id: 'remote', registro: 'R1', nombre: 'PAC' },
          note: { fecha: '15/01/2026', evolucion: 'nueva' },
          labHistory: [],
        },
      ],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].note.evolucion, 'nueva');
});

test('filterEntriesByPatientDeletes quita entrada aunque el host sea m?s reciente', () => {
  const entries = [
    {
      patient: { id: 'p1', registro: 'R1', nombre: 'PAC', lanUpdatedAt: '2026-06-06T20:00:00.000Z' },
      note: { fecha: '01/01/2026' },
      labHistory: [],
    },
  ];
  const filtered = filterEntriesByPatientDeletes(entries, [
    {
      id: 'p1',
      registro: 'R1',
      updatedAt: '2026-06-06T12:00:00.000Z',
      deleted: true,
    },
  ]);
  assert.equal(filtered.length, 0);
});

test('filterEntriesByPatientDeletes quita entrada si delete es m?s reciente', () => {
  const entries = [
    {
      patient: { id: 'p1', registro: 'R1', nombre: 'PAC', lanUpdatedAt: '2026-05-16T08:00:00.000Z' },
      note: { fecha: '01/01/2026' },
      labHistory: [],
    },
  ];
  const filtered = filterEntriesByPatientDeletes(entries, [
    {
      id: 'p1',
      registro: 'R1',
      updatedAt: '2026-05-16T12:00:00.000Z',
      deleted: true,
    },
  ]);
  assert.equal(filtered.length, 0);
});

test('filterEntriesByPatientDeletes conserva readmisi?n con mismo registro e id distinto', () => {
  const entries = [
    {
      patient: { id: 'p-new', registro: 'R1', nombre: 'READMIT', lanUpdatedAt: '2026-06-10T08:00:00.000Z' },
      note: { fecha: '10/06/2026' },
      labHistory: [],
    },
  ];
  const filtered = filterEntriesByPatientDeletes(entries, [
    {
      id: 'p-old',
      registro: 'R1',
      updatedAt: '2026-06-01T12:00:00.000Z',
      deleted: true,
    },
  ]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].patient.id, 'p-new');
});

test('mergeEventualidades une entradas de ambos lados por id', () => {
  const merged = mergeEventualidades(
    { entries: [{ id: 'ev_a', at: '2026-06-01T10:00:00.000Z', text: 'A' }] },
    { entries: [{ id: 'ev_b', at: '2026-06-02T10:00:00.000Z', text: 'B' }] }
  );
  assert.equal(merged.entries.length, 2);
});

test('mergePatientEntry conserva eventualidades de ambos peers', () => {
  const a = {
    patient: {
      id: 'p1',
      registro: 'R1',
      eventualidades: { entries: [{ id: 'ev_a', at: '2026-06-01T10:00:00.000Z', text: 'A' }] },
    },
    note: { fecha: '01/06/2026' },
    labHistory: [],
  };
  const b = {
    patient: {
      id: 'p1',
      registro: 'R1',
      eventualidades: { entries: [{ id: 'ev_b', at: '2026-06-02T10:00:00.000Z', text: 'B' }] },
    },
    note: { fecha: '02/06/2026' },
    labHistory: [],
  };
  const m = mergePatientEntry(a, b);
  assert.equal(m.patient.eventualidades.entries.length, 2);
});

test('mergeHistoriaClinica gana la versi?n m?s alta', () => {
  const merged = mergeHistoriaClinica(
    { version: 2, data: { meta: { updatedAt: '2026-06-01T10:00:00.000Z' }, dx: 'old' } },
    { version: 3, data: { meta: { updatedAt: '2026-06-02T10:00:00.000Z' }, dx: 'new' } }
  );
  assert.equal(merged.version, 3);
  assert.equal(merged.data.dx, 'new');
});

test('mergePatientEntry fusiona historia cl?nica por versi?n', () => {
  const a = {
    patient: {
      id: 'p1',
      registro: 'R1',
      historiaClinica: { version: 1, data: { meta: { updatedAt: '2026-06-01T10:00:00.000Z' } } },
    },
    note: { fecha: '01/06/2026' },
    labHistory: [],
  };
  const b = {
    patient: {
      id: 'p1',
      registro: 'R1',
      historiaClinica: { version: 2, data: { meta: { updatedAt: '2026-06-02T10:00:00.000Z' }, dx: 'peer' } },
    },
    note: { fecha: '02/06/2026' },
    labHistory: [],
  };
  const m = mergePatientEntry(a, b);
  assert.equal(m.patient.historiaClinica.version, 2);
  assert.equal(m.patient.historiaClinica.data.dx, 'peer');
});
