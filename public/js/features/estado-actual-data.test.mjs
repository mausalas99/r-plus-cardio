import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyMonitoreo,
  emptyEstadoClinico,
  ensureMonitoreo,
  migratePatientMonitoreo,
  mergePatientMonitoreoFromImported,
  mergeMonitoreo,
  deriveSnapshot,
  balanceTurno,
  balanceGlobalHistorico,
  medicionHasCoreData,
  appendMedicion,
  resolveDietWeightKg,
  computeDietKcalTotal,
  computeDietKcalKgFromTotal,
  syncDietKcalFromWeight,
  isDietaSuplemento,
  clearDietCaloricFields,
  applyDietaSuplementoPolicy,
  stripDietaMacroSuffixFromLabel,
  parseIoEgresoField,
  isIoNumericValue,
} from './estado-actual-data.mjs';

test('emptyEstadoClinico incluye proteinG', () => {
  const ec = emptyEstadoClinico();
  assert.equal(ec.proteinG, '');
});

test('ensureMonitoreo backfill proteinG en pacientes legacy', () => {
  /** @type {any} */
  const patient = {
    monitoreo: {
      estadoClinico: { dieta: 'BLANDA', kcal: '1500' },
      pendienteReceta: {},
      confirmado: {},
      historial: [],
      textoGuardado: { text: '', savedAt: null },
    },
  };
  ensureMonitoreo(patient);
  assert.equal(patient.monitoreo.estadoClinico.proteinG, '');
  assert.equal(patient.monitoreo.confirmado.dieta, true);
});

test('mergePatientMonitoreoFromImported preserva dieta confirmada local', () => {
  /** @type {any} */
  const local = {
    monitoreo: emptyMonitoreo(),
  };
  local.monitoreo.estadoClinico.dieta = 'BLANDA PICADA';
  local.monitoreo.estadoClinico.kcal = '1500';
  local.monitoreo.confirmado.dieta = true;
  /** @type {any} */
  const incoming = {
    monitoreo: emptyMonitoreo(),
  };
  incoming.monitoreo.pendienteReceta.dieta = 'DESDE LAN';
  mergePatientMonitoreoFromImported(local, incoming);
  assert.equal(local.monitoreo.estadoClinico.dieta, 'BLANDA PICADA');
  assert.equal(local.monitoreo.confirmado.dieta, true);
  assert.equal(local.monitoreo.pendienteReceta.dieta, '');
});

test('mergeMonitoreo toma dieta confirmada remota si local no tiene', () => {
  const local = emptyMonitoreo();
  const remote = emptyMonitoreo();
  remote.estadoClinico.dieta = 'NORMAL';
  remote.confirmado.dieta = true;
  const merged = mergeMonitoreo(local, remote);
  assert.equal(merged.estadoClinico.dieta, 'NORMAL');
  assert.equal(merged.confirmado.dieta, true);
});

test('mergeMonitoreo fusiona escalares de estado clínico (four local + soporte remoto)', () => {
  const local = emptyMonitoreo();
  local.estadoClinico.four = '15';
  const remote = emptyMonitoreo();
  remote.estadoClinico.soporte = 'O₂ 2L';
  const merged = mergeMonitoreo(local, remote);
  assert.equal(merged.estadoClinico.four, '15');
  assert.equal(merged.estadoClinico.soporte, 'O₂ 2L');
});

test('mergeMonitoreo une historial por id aunque remoto tenga más filas', () => {
  const local = emptyMonitoreo();
  local.historial = [
    { id: 'ipad-1', recordedAt: '2026-06-27T18:00:00.000Z', vitals: { tas: 120 } },
  ];
  const remote = emptyMonitoreo();
  remote.historial = [
    { id: 'host-a', recordedAt: '2026-06-27T08:00:00.000Z', vitals: { tas: 110 } },
    { id: 'host-b', recordedAt: '2026-06-27T10:00:00.000Z', vitals: { tas: 115 } },
    { id: 'host-c', recordedAt: '2026-06-27T12:00:00.000Z', vitals: { tas: 118 } },
  ];
  const merged = mergeMonitoreo(local, remote);
  assert.equal(merged.historial.length, 4);
  assert.ok(merged.historial.some((row) => row.id === 'ipad-1'));
});

test('emptyMonitoreo — stable canonical shape', () => {
  const a = emptyMonitoreo();
  const b = emptyMonitoreo();
  assert.deepEqual(a, b);
});

test('migratePatientMonitoreo mueve legacy estadoActual → textoGuardado y elimina legacy', () => {
  /** @type {any} */
  const patient = {
    estadoActual: { text: 'Texto viejo', savedAt: '2026-05-01T12:00:00.000Z' },
  };
  migratePatientMonitoreo(patient);
  assert.equal(patient.estadoActual, undefined);
  assert.ok(patient.monitoreo);
  assert.deepEqual(patient.monitoreo.textoGuardado, {
    text: 'Texto viejo',
    savedAt: '2026-05-01T12:00:00.000Z',
  });
});

test('migratePatientMonitoreo es idempotente', () => {
  /** @type {any} */
  const patient = {
    estadoActual: { text: 'X', savedAt: '2026-05-02T08:00:00.000Z' },
  };
  migratePatientMonitoreo(patient);
  const first = structuredClone(patient.monitoreo.textoGuardado);
  migratePatientMonitoreo(patient);
  assert.deepEqual(patient.monitoreo.textoGuardado, first);
  assert.equal(patient.estadoActual, undefined);
});

test('deriveSnapshot — último no-null por campo en historial', () => {
  /** @type {any} */
  const monitoreo = {
    estadoClinico: {},
    confirmado: {},
    pendienteReceta: {},
    historial: [
      {
        id: '1',
        recordedAt: '2026-05-01T08:00:00.000Z',
        vitals: { tas: 100, tad: null },
        glucometrias: [{ value: 90, time: '08:05' }],
        io: { ing: 500, egr: 300 },
      },
      {
        id: '2',
        recordedAt: '2026-05-01T10:00:00.000Z',
        vitals: { tas: null, tad: 70 },
        glucometrias: [{ value: 142, time: '10:10' }],
        io: {},
      },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  const snap = deriveSnapshot(monitoreo);
  assert.equal(snap.vitals.tas, 100);
  assert.equal(snap.vitals.tad, 70);
  assert.equal(snap.io.ing, 500);
  assert.equal(snap.io.egr, 300);
  assert.deepEqual(snap.glucometrias, [{ value: 142, time: '10:10' }]);
});

test('deriveSnapshot sorts glucometrias chronologically within latest row', () => {
  /** @type {any} */
  var monitoreo = {
    estadoClinico: {},
    confirmado: {},
    pendienteReceta: {},
    historial: [
      {
        id: '1',
        recordedAt: new Date(2026, 5, 20, 0, 0, 0).toISOString(),
        vitals: {},
        glucometrias: [
          { value: 171, time: '08:00' },
          { value: 125, time: '16:00' },
          { value: 243, time: '00:00' },
          { value: 110, time: '04:00' },
        ],
        io: {},
      },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  var snap = deriveSnapshot(monitoreo);
  assert.deepEqual(
    snap.glucometrias.map(function (g) {
      return g.value + '@' + g.time;
    }),
    ['171@08:00', '125@16:00', '243@00:00', '110@04:00']
  );
});

test('balanceTurno y balanceGlobalHistorico (500−300=200, 600−450=150, global 350)', () => {
  /** @type {any} */
  const monitoreo = {
    historial: [
      {
        id: 'a',
        recordedAt: '2026-05-01T07:00:00.000Z',
        vitals: {},
        glucometrias: [],
        io: { ing: 500, egr: 300 },
      },
      {
        id: 'b',
        recordedAt: '2026-05-01T09:00:00.000Z',
        vitals: {},
        glucometrias: [],
        io: { ing: 600, egr: 450 },
      },
    ],
  };
  assert.equal(balanceTurno(monitoreo), 150);
  assert.equal(balanceGlobalHistorico(monitoreo), 350);
});

test('medicionHasCoreData rechaza entrada vacía', () => {
  assert.equal(medicionHasCoreData({}), false);
  assert.equal(medicionHasCoreData(null), false);
  /** @type {any} */
  const onlyMeta = {
    id: 'x',
    recordedAt: '2026-05-01T12:00:00.000Z',
    vitals: {},
    glucometrias: [],
    io: {},
  };
  assert.equal(medicionHasCoreData(onlyMeta), false);
});

test('appendMedicion acepta medición sin datos clínicos (solo cierre de turno)', () => {
  const m = emptyMonitoreo();
  const row = {
    id: 'n',
    recordedAt: '2026-05-01T12:00:00.000Z',
    vitals: {},
    glucometrias: [],
    io: {},
  };
  const out = appendMedicion(m, row);
  assert.deepEqual(out, { ok: true });
  assert.equal(m.historial.length, 1);
  assert.equal(m.historial[0].id, 'n');
});

test('resolveDietWeightKg usa datos del paciente (no signos vitales)', () => {
  assert.equal(resolveDietWeightKg({ patientPeso: 72, pesoRef: 60 }), 72);
  assert.equal(resolveDietWeightKg({ pesoRef: 60 }), 60);
  assert.equal(resolveDietWeightKg({}), null);
});

test('computeDietKcalTotal y syncDietKcalFromWeight', () => {
  assert.equal(computeDietKcalTotal(25, 70), 1750);
  assert.equal(computeDietKcalTotal(25, null), null);
  const ec = { kcalKg: '25', kcal: '' };
  assert.equal(syncDietKcalFromWeight(ec, 70), true);
  assert.equal(ec.kcal, '1750');
});

test('syncDietKcalFromWeight no sobrescribe kcal total sin peso', () => {
  const ec = { kcalKg: '25', kcal: '1800' };
  assert.equal(syncDietKcalFromWeight(ec, null), false);
  assert.equal(ec.kcal, '1800');
});

test('stripDietaMacroSuffixFromLabel quita macros SOME en paréntesis', () => {
  assert.equal(stripDietaMacroSuffixFromLabel('NORMAL (1750 kcal, 70 g prot)'), 'NORMAL');
  assert.equal(stripDietaMacroSuffixFromLabel('*DIETA NORMAL (1750 KCAL)'), 'NORMAL');
  assert.equal(stripDietaMacroSuffixFromLabel('NORMAL PICADA ALTA EN FIBRA'), 'NORMAL PICADA ALTA EN FIBRA');
});

test('isDietaSuplemento reconoce suplemento sin calorías', () => {
  assert.equal(isDietaSuplemento('SUPLEMENTO'), true);
  assert.equal(isDietaSuplemento('Dieta suplemento'), true);
  assert.equal(isDietaSuplemento('*SUPLEMENTO'), true);
  assert.equal(isDietaSuplemento('* SUPLEMENTO'), true);
  assert.equal(isDietaSuplemento('NORMAL PICADA'), false);
  assert.equal(isDietaSuplemento(''), false);
});

test('applyDietaSuplementoPolicy limpia calóricos en ayuno', () => {
  var ec = { dieta: 'AYUNO', kcal: '2000', proteinG: '70', kcalKg: '25' };
  var pend = { kcal: '2000', proteinG: '70', kcalKg: '25' };
  assert.equal(applyDietaSuplementoPolicy(ec, pend), true);
  assert.equal(ec.kcal, '');
  assert.equal(ec.proteinG, '');
  assert.equal(ec.kcalKg, '');
  assert.equal(pend.kcal, '');
  assert.equal(pend.proteinG, '');
  assert.equal(pend.kcalKg, '');
});

test('applyDietaSuplementoPolicy limpia calóricos en estado y propuesta', () => {
  const ec = { dieta: 'SUPLEMENTO', kcalKg: '25', kcal: '1750', proteinG: '70' };
  const pend = { dieta: 'SUPLEMENTO', kcal: '2000', proteinG: '60' };
  assert.equal(applyDietaSuplementoPolicy(ec, pend), true);
  assert.equal(ec.kcalKg, '');
  assert.equal(ec.kcal, '');
  assert.equal(ec.proteinG, '');
  assert.equal(pend.kcal, '');
  assert.equal(pend.proteinG, '');
});

test('applyDietaSuplementoPolicy no-op en dieta normal', () => {
  const ec = { dieta: 'NORMAL PICADA', kcal: '2000' };
  assert.equal(applyDietaSuplementoPolicy(ec), false);
  assert.equal(ec.kcal, '2000');
});

test('syncDietKcalFromWeight no recalcula en suplemento', () => {
  const ec = { dieta: 'SUPLEMENTO', kcalKg: '25', kcal: '' };
  assert.equal(syncDietKcalFromWeight(ec, 70), false);
  assert.equal(ec.kcal, '');
});

test('clearDietCaloricFields vacía kcalKg, kcal y proteinG', () => {
  const rec = { kcalKg: '30', kcal: '2100', proteinG: '80', dieta: 'X' };
  clearDietCaloricFields(rec);
  assert.equal(rec.kcalKg, '');
  assert.equal(rec.kcal, '');
  assert.equal(rec.proteinG, '');
  assert.equal(rec.dieta, 'X');
});

test('computeDietKcalKgFromTotal — inverso de kcal total', () => {
  assert.equal(computeDietKcalKgFromTotal(1750, 70), 25);
  assert.equal(computeDietKcalKgFromTotal('', 70), null);
});

test('parseIoEgresoField acepta NC y cc numéricos', () => {
  assert.equal(parseIoEgresoField(''), null);
  assert.equal(parseIoEgresoField('  nc  '), 'NC');
  assert.equal(parseIoEgresoField('300'), 300);
  assert.equal(isIoNumericValue('NC'), false);
  assert.equal(isIoNumericValue(300), true);
});

test('balanceTurno ignora turno con egresos NC', () => {
  /** @type {any} */
  const monitoreo = {
    historial: [
      {
        id: 'a',
        recordedAt: '2026-05-01T07:00:00.000Z',
        vitals: {},
        glucometrias: [],
        io: { ing: 500, egr: 'NC' },
      },
      {
        id: 'b',
        recordedAt: '2026-05-01T09:00:00.000Z',
        vitals: {},
        glucometrias: [],
        io: { ing: 600, egr: 450 },
      },
    ],
  };
  assert.equal(balanceTurno(monitoreo), 150);
});

test('deriveSnapshot — vitalSeries across rows keeps latest reading for SOAP', () => {
  /** @type {any} */
  var monitoreo = {
    estadoClinico: {},
    confirmado: {},
    pendienteReceta: {},
    historial: [
      {
        id: '1',
        recordedAt: '2026-06-22T06:00:00.000Z',
        vitals: { tas: 100, tad: 60, fc: 80 },
        glucometrias: [],
        io: {},
      },
      {
        id: '2',
        recordedAt: '2026-06-22T14:00:00.000Z',
        vitals: {},
        vitalSeries: {
          tas: [{ value: 130, time: '14:00' }],
          tad: [{ value: 75, time: '14:00' }],
          fc: [{ value: 95, time: '14:00' }],
        },
        glucometrias: [],
        io: {},
      },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  var snap = deriveSnapshot(monitoreo);
  assert.equal(snap.vitals.tas, 130);
  assert.equal(snap.vitals.tad, 75);
  assert.equal(snap.vitals.fc, 95);
  assert.equal(snap.alteredAt.tas, '14:00');
});

test('deriveSnapshot overlay vitals from vitalSeries (SOAP alineado al strip)', () => {
  const recordedAt = new Date(2026, 5, 22, 6, 0, 0).toISOString();
  /** @type {any} */
  var monitoreo = {
    estadoClinico: {},
    confirmado: {},
    pendienteReceta: {},
    historial: [
      {
        id: '1',
        recordedAt,
        vitals: { temp: 36 },
        vitalSeries: {
          temp: [
            { value: 37.2, time: '08:00' },
            { value: 38.5, time: '14:00' },
          ],
        },
        glucometrias: [],
        io: {},
      },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  var snap = deriveSnapshot(monitoreo);
  assert.equal(snap.vitals.temp, 38.5);
  assert.equal(snap.vitals.tempPeak, 37.2);
  assert.equal(snap.alteredAt.temp, '14:00');
  assert.equal(snap.alteredAt.tempPeak, '08:00');
  assert.deepEqual(snap.tempPeakAt, {
    recordedAt,
    time: '08:00',
  });
});
