/**
 * Historial de monitoreo (Estado Actual) para el paciente demo-pitch del tour.
 */
import { medicionHasCoreData } from './features/estado-actual-data.mjs';
import { getGlucometriaRegistroWindow } from './features/estado-actual-registro-defaults.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

/** @type {Array<{ hoursFromStart: number, minute: number, payload: object }>} */
const PITCH_GLU_TURNS = [
  {
    hoursFromStart: 1,
    minute: 5,
    payload: {
      vitals: { tas: 126, tad: 76, fc: 90, fr: 19, temp: 36.9, sat: 95 },
      glucometrias: [
        { value: 138, time: '09:05' },
        { value: 142, time: '09:12' },
      ],
      io: { ing: 200, egr: 140 },
    },
  },
  {
    hoursFromStart: 4,
    minute: 10,
    payload: {
      vitals: { tas: 120, tad: 70, fc: 86, fr: 18, temp: 36.7, sat: 96 },
      glucometrias: [{ value: 152, time: '12:10' }],
      io: { ing: 240, egr: 170 },
    },
  },
  {
    hoursFromStart: 8,
    minute: 15,
    payload: {
      vitals: { tas: 118, tad: 72, fc: 84, fr: 18, temp: 36.6, sat: 96 },
      glucometrias: [
        { value: 176, time: '16:15' },
        { value: 168, time: '16:22' },
      ],
      io: { ing: 300, egr: 220 },
    },
  },
  {
    hoursFromStart: 12,
    minute: 20,
    payload: {
      vitals: { tas: 116, tad: 74, fc: 84, fr: 17, temp: 36.5, sat: 97 },
      glucometrias: [{ value: 188, time: '20:20' }],
      io: { ing: 120, egr: 100 },
    },
  },
  {
    hoursFromStart: 15,
    minute: 45,
    payload: {
      vitals: { tas: 124, tad: 76, fc: 90, fr: 19, temp: 37.0, sat: 95 },
      glucometrias: [
        { value: 198, time: '23:45' },
        { value: 192, time: '23:52' },
      ],
      io: { ing: 150, egr: 130 },
    },
  },
];

/** @type {Array<{ dayOff: number, hour: number, minute: number, payload: object }>} */
const PITCH_VITALS_TREND_SLOTS = [
  {
    dayOff: 0,
    hour: 10,
    minute: 0,
    payload: {
      vitals: { tas: 118, tad: 72, fc: 88, fr: 18, temp: 36.8, sat: 96 },
      io: { ing: 220, egr: 150 },
    },
  },
  {
    dayOff: 0,
    hour: 18,
    minute: 0,
    payload: {
      vitals: { tas: 120, tad: 70, fc: 84, fr: 17, temp: 36.6, sat: 97 },
      io: { ing: 200, egr: 160 },
    },
  },
  {
    dayOff: 1,
    hour: 6,
    minute: 30,
    payload: {
      vitals: { tas: 128, tad: 78, fc: 92, fr: 20, temp: 37.0, sat: 94 },
      io: { ing: 200, egr: 140 },
    },
  },
  {
    dayOff: 1,
    hour: 14,
    minute: 30,
    payload: {
      vitals: { tas: 120, tad: 70, fc: 86, fr: 18, temp: 36.7, sat: 96 },
      io: { ing: 300, egr: 220 },
    },
  },
  {
    dayOff: 2,
    hour: 7,
    minute: 0,
    payload: {
      vitals: { tas: 132, tad: 80, fc: 94, fr: 21, temp: 37.2, sat: 93 },
      io: { ing: 190, egr: 130 },
    },
  },
  {
    dayOff: 2,
    hour: 11,
    minute: 0,
    payload: {
      vitals: { tas: 130, tad: 78, fc: 92, fr: 20, temp: 37.0, sat: 94 },
      io: { ing: 210, egr: 150 },
    },
  },
  {
    dayOff: 2,
    hour: 15,
    minute: 0,
    payload: {
      vitals: { tas: 126, tad: 76, fc: 88, fr: 19, temp: 36.9, sat: 95 },
      io: { ing: 250, egr: 180 },
    },
  },
  {
    dayOff: 2,
    hour: 19,
    minute: 0,
    payload: {
      vitals: { tas: 128, tad: 78, fc: 90, fr: 20, temp: 37.0, sat: 94 },
      io: { ing: 160, egr: 120 },
    },
  },
];

/**
 * @param {Date} now
 * @returns {{ historial: object[], pushEntry: Function, atDayOffset: Function }}
 */
function createMonitoreoHistorialCollector(now) {
  /** @type {Array<object>} */
  const historial = [];

  function pushEntry(d, payload) {
    historial.push({
      id: 'pitch-ea-' + historial.length,
      recordedAt: d.toISOString(),
      vitals: payload.vitals || {},
      glucometrias: payload.glucometrias || [],
      io: payload.io || {},
    });
  }

  function atDayOffset(dayOff, hour, minute, payload) {
    const d = new Date(now.getTime() - dayOff * DAY_MS);
    d.setHours(hour, minute, 0, 0);
    pushEntry(d, payload);
  }

  return { historial, pushEntry, atDayOffset };
}

/** Glucometrías en la ventana de Estado Actual (ayer 08:00 → hoy 00:00). */
function seedPitchGlucometriaHistorial(win, pushEntry) {
  for (let i = 0; i < PITCH_GLU_TURNS.length; i++) {
    const turn = PITCH_GLU_TURNS[i];
    const d = new Date(win.start.getTime() + turn.hoursFromStart * 60 * 60 * 1000);
    d.setMinutes(turn.minute, 0, 0);
    if (d.getTime() > win.end.getTime()) continue;
    pushEntry(d, turn.payload);
  }
  pushEntry(new Date(win.end.getTime()), {
    vitals: { tas: 118, tad: 72, fc: 88, fr: 18, temp: 36.8, sat: 96 },
    glucometrias: [{ value: 155, time: '00:00' }],
    io: { ing: 180, egr: 120 },
  });
}

/** Signos vitales e I/O en los últimos 3 días (gráficas de tendencia). */
function seedPitchVitalsTrendHistorial(atDayOffset) {
  for (let i = 0; i < PITCH_VITALS_TREND_SLOTS.length; i++) {
    const slot = PITCH_VITALS_TREND_SLOTS[i];
    atDayOffset(slot.dayOff, slot.hour, slot.minute, slot.payload);
  }
}

/** @param {Date} now */
function buildPitchMonitoreoClinicalShell(now) {
  return {
    estadoClinico: {
      four: '4',
      esferas: '3',
      analgesia: 'Paracetamol 1 g IV c/8h',
      abx: 'Cefepime 1 g IV c/8h (día 2)',
      antihta: 'Losartán 50 mg VO',
      vasop: 'No',
      soporte: 'O2 nasal 2 L/min',
      tempContext: 'Afebril en turno',
      dieta: 'Dieta renal',
      kcalKg: '25',
      kcal: '1750',
      pesoRef: '70',
    },
    confirmado: { analgesia: true, abx: true, antihta: false, vasop: false },
    pendienteReceta: {
      four: '',
      esferas: '',
      analgesia: '',
      abx: '',
      antihta: '',
      vasop: '',
      soporte: '',
      tempContext: '',
      dieta: '',
      kcalKg: '',
      kcal: '',
      pesoRef: '',
    },
    textoGuardado: {
      text:
        'Glucometrías seriadas c/6h: 128–198 mg/dL en 48 h (ver gráfica y tabla en Estado Actual). ' +
        'Balance hídrico estricto; correlacionar con QS.',
      savedAt: now.toISOString(),
    },
  };
}

/**
 * @param {Date} [ref]
 */
export function buildPitchMonitoreoHistorial(ref) {
  const now = ref instanceof Date ? ref : new Date();
  const { historial, pushEntry, atDayOffset } = createMonitoreoHistorialCollector(now);
  const win = getGlucometriaRegistroWindow(now);
  seedPitchGlucometriaHistorial(win, pushEntry);
  seedPitchVitalsTrendHistorial(atDayOffset);
  return {
    ...buildPitchMonitoreoClinicalShell(now),
    historial,
  };
}

/** @param {unknown[]} historial */
export function countDistinctLocalDaysInHistorial(historial) {
  const keys = new Set();
  for (const m of historial || []) {
    if (!m || !m.recordedAt) continue;
    const d = new Date(m.recordedAt);
    keys.add(d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate());
  }
  return keys.size;
}

/** @param {unknown[]} historial */
export function countHistorialWithCoreData(historial) {
  let n = 0;
  for (const m of historial || []) {
    if (medicionHasCoreData(m)) n += 1;
  }
  return n;
}
