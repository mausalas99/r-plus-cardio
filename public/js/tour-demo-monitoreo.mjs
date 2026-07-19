/**
 * Monitoreo demo para el tour guiado (DEMO PÉREZ).
 * Fechas relativas a «hoy»; patrón inspirado en hoja de enfermería por turno (TM/TV/TN).
 */
import { medicionHasCoreData } from './features/estado-actual-data.mjs';
import {
  buildTourMonitoreoEstadoClinico,
  buildTourMonitoreoHistorialEntries,
} from './tour-demo-monitoreo-historial.mjs';

/**
 * @param {Date} [ref]
 */
export function buildTourMonitoreoHistorial(ref) {
  const now = ref instanceof Date ? ref : new Date();
  const shell = buildTourMonitoreoEstadoClinico(now);
  return {
    ...shell,
    historial: buildTourMonitoreoHistorialEntries(now),
  };
}

/** Muestra de turno TM para el tour (registro manual prellenado). */
export function getTourRegistroFormSample() {
  return {
    ok: true,
    vitals: { tas: 130, tad: 80, fc: 94, fr: 22, temp: 37, sat: 96 },
    alteredAt: {},
    glucometrias: [{ value: 144, time: '08:00' }],
    io: { ing: 200, egr: 100, evac: 'NO' },
  };
}

/** @param {unknown[]} historial */
export function countTourHistorialWithCoreData(historial) {
  let n = 0;
  for (const m of historial || []) {
    if (medicionHasCoreData(m)) n += 1;
  }
  return n;
}
