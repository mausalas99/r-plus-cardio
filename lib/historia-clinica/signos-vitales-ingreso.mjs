/**
 * Signos vitales al ingreso — texto derivado del monitoreo (Estado actual).
 */

import {
  appendTempFcFrLines,
  appendSatTaLines,
  appendGluBombaLines,
} from './signos-vitales-ingreso-parts.mjs';
import { trim } from './string-util.mjs';


/**
 * @param {{ vitals?: Record<string, unknown>, alteredAt?: Record<string, string>, glucometrias?: Array<{ value?: unknown, time?: string }>, bombaInsulina?: Array<{ value?: number, units?: number, time?: string }> } | null | undefined} snapshot
 * @returns {boolean}
 */
export function signosVitalesSnapshotHasData(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const v = snapshot.vitals && typeof snapshot.vitals === 'object' ? snapshot.vitals : {};
  const keys = ['tas', 'tad', 'fc', 'fr', 'temp', 'sat', 'tempPeak'];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (v[k] != null && v[k] !== '') return true;
  }
  if (Array.isArray(snapshot.glucometrias) && snapshot.glucometrias.length) return true;
  if (Array.isArray(snapshot.bombaInsulina) && snapshot.bombaInsulina.length) return true;
  return false;
}

/**
 * @param {{ vitals?: Record<string, unknown>, alteredAt?: Record<string, string>, glucometrias?: Array<{ value?: unknown, time?: string }>, bombaInsulina?: Array<{ value?: number, units?: number, time?: string }> } | null | undefined} snapshot
 * @param {{ soporte?: unknown } | null | undefined} [estadoClinico]
 * @returns {string}
 */
export function formatSignosVitalesIngresoFromSnapshot(snapshot, estadoClinico) {
  if (!signosVitalesSnapshotHasData(snapshot)) return '';
  const v = snapshot && snapshot.vitals && typeof snapshot.vitals === 'object' ? snapshot.vitals : {};
  const alt =
    snapshot && snapshot.alteredAt && typeof snapshot.alteredAt === 'object' ? snapshot.alteredAt : {};
  const parts = [];

  appendTempFcFrLines(v, alt, parts);
  appendSatTaLines(v, estadoClinico, parts);
  appendGluBombaLines(snapshot, parts);

  return parts.join(' · ').toUpperCase();
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @param {{ signosVitalesIngresoFromMonitoreo?: string } | null | undefined} [ctx]
 * @returns {string}
 */
export function resolveSignosVitalesIngresoBody(data, ctx) {
  const fromMon = ctx && trim(ctx.signosVitalesIngresoFromMonitoreo);
  if (fromMon) return fromMon;
  return trim(data && data.signosVitalesIngreso);
}
