/**
 * deriveSnapshot row helpers — extracted from estado-actual-data-snapshot.mjs.
 */
import {
  ioDiuresisForBalance,
  ioNumericEgressTotal,
} from './estado-actual-io.mjs';
import { sortGlucometriasChronologically } from './estado-actual-registro-defaults.mjs';
import { getVitalExtraStorageKey, VITAL_BASE_KEYS } from './estado-actual-vital-extras.mjs';
import { VITAL_KEYS } from './estado-actual-data-constants.mjs';

function hasIoNumber(v) {
  return v != null && v !== '';
}

/**
 * @param {Record<string, unknown>} vitals
 * @param {Record<string, string>} alteredAt
 * @param {string} key
 * @param {unknown} val
 * @param {Record<string, string>} rowAlt
 */
export function applyVitalReading(vitals, alteredAt, key, val, rowAlt) {
  if (val == null || val === '') return;
  vitals[key] = val;
  if (rowAlt && rowAlt[key] != null && String(rowAlt[key]).length > 0) {
    alteredAt[key] = String(rowAlt[key]);
  } else {
    delete alteredAt[key];
  }
}

/**
 * @param {unknown} row
 */
export function rowVitalsAndAltered(row) {
  if (!row || typeof row !== 'object') {
    return { rv: {}, rowAlt: {} };
  }
  /** @type {any} */
  var r = row;
  var rv = r.vitals && typeof r.vitals === 'object' ? r.vitals : {};
  var rowAlt =
    r.alteredAt && typeof r.alteredAt === 'object' ? /** @type {Record<string, string>} */ (r.alteredAt) : {};
  return { rv, rowAlt };
}

/**
 * @param {unknown} e
 */
export function normalizeBombaEntry(e) {
  if (!e || typeof e !== 'object') return null;
  var v = Number(e.value);
  var u = Number(e.units);
  if (!Number.isFinite(v)) return null;
  return {
    value: v,
    units: Number.isFinite(u) ? u : 0,
    time: e.time != null ? String(e.time) : undefined,
  };
}

/**
 * @param {unknown[]} garr
 */
export function nonemptyGlucometrias(garr) {
  var nonempty = /** @type {Array<{ value?: unknown, time?: string }>} */ ([]);
  for (var gg of garr) {
    if (!gg || typeof gg !== 'object') continue;
    if (gg.value != null && gg.value !== '') nonempty.push(gg);
  }
  return nonempty;
}

/**
 * @param {unknown} row
 */
export function bombaFromRow(row) {
  if (!row || typeof row !== 'object') return [];
  var barr = Array.isArray(row.bombaInsulina) ? row.bombaInsulina : [];
  return barr.map(normalizeBombaEntry).filter(Boolean);
}

/**
 * @param {unknown} row
 */
export function glucometriasFromRow(row) {
  if (!row || typeof row !== 'object') return [];
  return Array.isArray(row.glucometrias) ? row.glucometrias : [];
}

/**
 * @param {unknown} rowIo
 * @param {{ egrPartsSeen: unknown, egrSeen: unknown, evacSeen: unknown, ingSeen: unknown }} state
 */
export function absorbIoRow(rowIo, state) {
  if (state.egrPartsSeen === null && Array.isArray(rowIo.egrParts) && rowIo.egrParts.length) {
    state.egrPartsSeen = rowIo.egrParts.slice();
    state.egrSeen = ioNumericEgressTotal(rowIo) ?? ioDiuresisForBalance(rowIo);
  }
  if (state.egrSeen === null && rowIo.egr != null && rowIo.egr !== '') state.egrSeen = rowIo.egr;
  if (state.evacSeen === null && rowIo.evac != null && rowIo.evac !== '') state.evacSeen = rowIo.evac;
  if (state.ingSeen === null && hasIoNumber(rowIo.ing)) state.ingSeen = rowIo.ing;
}

export { VITAL_KEYS, VITAL_BASE_KEYS, getVitalExtraStorageKey, sortGlucometriasChronologically };
