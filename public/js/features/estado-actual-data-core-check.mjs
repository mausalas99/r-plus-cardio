import {
  ioDiuresisForBalance,
  ioNumericEgressTotal,
} from './estado-actual-io.mjs';
import { getVitalExtraStorageKey, VITAL_BASE_KEYS } from './estado-actual-vital-extras.mjs';
import { VITAL_KEYS } from './estado-actual-data-constants.mjs';

/**
 * @param {unknown} v
 */
function hasIoNumber(v) {
  return v != null && v !== '';
}

/**
 * @param {Record<string, unknown>} vit
 */
function hasBaseVitalData(vit) {
  for (var vk of VITAL_KEYS) {
    var vv = vit[vk];
    if (vv != null && vv !== '') return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} vit
 */
function hasExtraVitalData(vit) {
  for (var ek = 0; ek < VITAL_BASE_KEYS.length; ek++) {
    var extraKey = getVitalExtraStorageKey(VITAL_BASE_KEYS[ek]);
    if (vit[extraKey] != null && vit[extraKey] !== '') return true;
  }
  return false;
}

/**
 * @param {unknown} vs
 */
function hasVitalSeriesData(vs) {
  if (!vs || typeof vs !== 'object') return false;
  for (var vk2 in vs) {
    if (Array.isArray(vs[vk2]) && vs[vk2].length) return true;
  }
  return false;
}

/**
 * @param {unknown} medicion
 */
function hasBombaOrGluData(medicion) {
  /** @type {any} */
  var m = medicion;
  var bombas = Array.isArray(m.bombaInsulina) ? m.bombaInsulina : [];
  for (var bi = 0; bi < bombas.length; bi++) {
    var b = bombas[bi];
    if (b && typeof b === 'object' && b.value != null && b.value !== '') return true;
  }
  var glus = Array.isArray(m.glucometrias) ? m.glucometrias : [];
  for (var i = 0; i < glus.length; i++) {
    var g = glus[i];
    if (!g || typeof g !== 'object') continue;
    if (g.value != null && g.value !== '') return true;
  }
  return false;
}

/**
 * @param {unknown} io
 */
function hasIoBlockData(io) {
  if (!io || typeof io !== 'object') return false;
  /** @type {any} */
  var block = io;
  if (hasIoNumber(block.ing)) return true;
  if (ioNumericEgressTotal(block) != null) return true;
  if (ioDiuresisForBalance(block) != null && ioDiuresisForBalance(block) !== '') return true;
  if (Array.isArray(block.egrParts) && block.egrParts.length) return true;
  if (block.evac != null && block.evac !== '') return true;
  return hasIoNumber(block.egr);
}

/**
 * @param {unknown} medicion
 */
export function medicionHasCoreData(medicion) {
  if (!medicion || typeof medicion !== 'object') return false;
  /** @type {any} */
  var m = medicion;
  /** @type {Record<string, unknown>} */
  var vit = m.vitals && typeof m.vitals === 'object' ? m.vitals : {};
  if (hasBaseVitalData(vit)) return true;
  if (hasExtraVitalData(vit)) return true;
  if (hasVitalSeriesData(m.vitalSeries)) return true;
  if (hasBombaOrGluData(m)) return true;
  return hasIoBlockData(m.io);
}
