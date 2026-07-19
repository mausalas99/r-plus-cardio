/**
 * Historial entries for tour monitoreo demo (DEMO PÉREZ).
 */
import { getGlucometriaRegistroWindow } from './features/estado-actual-registro-defaults.mjs';

/** @param {Date} now */
export function buildTourMonitoreoHistorialEntries(now) {
  const dayMs = 24 * 60 * 60 * 1000;
  /** @type {Array<object>} */
  const historial = [];

  function pushEntry(d, payload) {
    historial.push({
      id: 'tour-ea-' + historial.length,
      recordedAt: d.toISOString(),
      vitals: payload.vitals || {},
      glucometrias: payload.glucometrias || [],
      io: payload.io || {},
    });
  }

  function atDayOffset(dayOff, hour, minute, payload) {
    const d = new Date(now.getTime() - dayOff * dayMs);
    d.setHours(hour, minute, 0, 0);
    pushEntry(d, payload);
  }

  function atToday(hour, minute, payload) {
    atDayOffset(0, hour, minute, payload);
  }

  atToday(8, 0, {
    vitals: { tas: 130, tad: 80, fc: 94, fr: 22, temp: 37.0, sat: 96 },
    glucometrias: [{ value: 144, time: '08:00' }],
    io: { ing: 1010, egr: 100, evac: 'NO' },
  });
  atToday(16, 0, {
    vitals: { tas: 130, tad: 70, fc: 126, fr: 19, temp: 37.8, sat: 95 },
    glucometrias: [{ value: 176, time: '16:00' }],
    io: { ing: 410, egr: 2000, evac: 'NO' },
  });
  atToday(23, 45, {
    vitals: { tas: 130, tad: 80, fc: 125, fr: 17, temp: 38.4, sat: 94 },
    glucometrias: [{ value: 159, time: '23:45' }],
    io: { ing: 769, egr: 1600, evac: 'NO' },
  });

  const win = getGlucometriaRegistroWindow(now);
  atDayOffset(1, 9, 5, {
    vitals: { tas: 126, tad: 76, fc: 90, fr: 19, temp: 36.9, sat: 95 },
    glucometrias: [
      { value: 138, time: '09:05' },
      { value: 142, time: '09:12' },
    ],
    io: { ing: 200, egr: 140 },
  });
  atDayOffset(1, 14, 30, {
    vitals: { tas: 120, tad: 70, fc: 86, fr: 18, temp: 36.7, sat: 96 },
    glucometrias: [{ value: 152, time: '14:30' }],
    io: { ing: 300, egr: 220 },
  });
  atDayOffset(2, 7, 0, {
    vitals: { tas: 132, tad: 80, fc: 94, fr: 21, temp: 37.2, sat: 93 },
    io: { ing: 190, egr: 130 },
  });
  atDayOffset(2, 15, 0, {
    vitals: { tas: 126, tad: 76, fc: 88, fr: 19, temp: 36.9, sat: 95 },
    io: { ing: 250, egr: 180 },
  });

  if (win && win.end) {
    const anchor = new Date(win.end.getTime());
    if (anchor.getTime() <= now.getTime()) {
      pushEntry(anchor, {
        vitals: { tas: 118, tad: 72, fc: 88, fr: 18, temp: 36.8, sat: 96 },
        glucometrias: [{ value: 155, time: '00:00' }],
        io: { ing: 180, egr: 120 },
      });
    }
  }

  return historial;
}

/** @param {Date} now */
export function buildTourMonitoreoEstadoClinico(now) {
  const fechaLabel =
    String(now.getDate()).padStart(2, '0') +
    '/' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '/' +
    now.getFullYear();

  return {
    estadoClinico: {
      four: '4',
      esferas: '3',
      analgesia: 'Paracetamol 1 g IV c/8h',
      abx: 'Cefepime 1 g IV c/8h (día 2)',
      antihta: 'Losartán 50 mg VO',
      vasop: 'No',
      soporte: 'O2 nasal 2 L/min',
      tempContext: 'Febrícula en turno de noche',
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
        'Monitoreo del ' +
        fechaLabel +
        ': glucometrías 144→176→159 mg/dL; pico febril 38.4 °C con taquicardia; ' +
        'balance hídrico con diuresis aumentada en TV/TN (ver gráficas).',
      savedAt: now.toISOString(),
    },
  };
}
