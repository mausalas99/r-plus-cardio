/** @typedef {{ text: string, savedAt: string | null }} TextoGuardado */
/** @typedef {{ kind: 'diuresis' | 'drain' | 'gastrostomy' | 'nephro', label: string, value: number | string }} IoEgresoPart */
/** @typedef {{ id: string, recordedAt: string, vitals?: Record<string, unknown>, vitalSeries?: Record<string, Array<{ value?: number, time?: string }>>, glucometrias?: Array<{ value?: unknown, time?: string, altered?: boolean, rescueUnits?: number, postRescueValue?: number }>, bombaInsulina?: Array<{ value?: unknown, units?: unknown, time?: string }>, io?: { ing?: unknown, egr?: unknown, egrParts?: IoEgresoPart[], evac?: unknown }, alteredAt?: Record<string, string> }} MedicionHistorial */

import {
  isIoNumericValue as isIoNumericValueIo,
  computeIoBalanceFromIngEgr,
} from './estado-actual-io.mjs';
import {
  deriveVitalsFromHistorial_,
  deriveGluFromHistorial_,
  deriveIoFromHistorial_,
  deriveVitalSeriesFromHistorial_,
  deriveTempPeakAtFromHistorial_,
  deriveBpPairsFromHistorial_,
} from './estado-actual-data-snapshot.mjs';
import { VITAL_BASE_KEYS } from './estado-actual-vital-extras.mjs';
import { vitalSeriesToLegacyFields } from './estado-actual-vital-series.mjs';
import { MED_FIELD_KEYS, DIET_CALORIC_KEYS } from './estado-actual-data-constants.mjs';
import { buildEaMonitoreoRevision } from './estado-actual-data-revision.mjs';
import { medicionHasCoreData } from './estado-actual-data-core-check.mjs';
import { mergeMonitoreo } from './estado-actual-data-merge.mjs';
import { emptyEstadoClinico, emptyMonitoreo, emptyPendienteReceta } from './estado-actual-data-model.mjs';

export { MED_FIELD_KEYS, DIET_CALORIC_KEYS, buildEaMonitoreoRevision, medicionHasCoreData, mergeMonitoreo };
export { emptyEstadoClinico, emptyMonitoreo };

function backfillEstadoClinico(monitoreo) {
  if (!monitoreo || typeof monitoreo !== 'object') return;
  var template = emptyEstadoClinico();
  var ec = monitoreo.estadoClinico;
  if (!ec || typeof ec !== 'object') {
    monitoreo.estadoClinico = Object.assign({}, template);
  } else {
    Object.keys(template).forEach(function (k) {
      if (ec[k] == null) ec[k] = template[k];
    });
  }
  if (!monitoreo.pendienteReceta || typeof monitoreo.pendienteReceta !== 'object') {
    monitoreo.pendienteReceta = emptyPendienteReceta();
  } else {
    Object.keys(template).forEach(function (k) {
      if (monitoreo.pendienteReceta[k] == null) monitoreo.pendienteReceta[k] = '';
    });
  }
  if (!monitoreo.confirmado || typeof monitoreo.confirmado !== 'object') {
    monitoreo.confirmado = {
      dieta: !!String(monitoreo.estadoClinico.dieta || '').trim(),
    };
  } else if (monitoreo.confirmado.dieta == null || monitoreo.confirmado.dieta === false) {
    monitoreo.confirmado.dieta = !!String(monitoreo.estadoClinico.dieta || '').trim();
  }
  for (var mk of MED_FIELD_KEYS) {
    if (monitoreo.confirmado[mk] == null) monitoreo.confirmado[mk] = false;
  }
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isIoNumericValue(v) {
  return isIoNumericValueIo(v);
}

/**
 * Egresos: cc numéricos o «NC» (sin cambio).
 * @param {unknown} raw
 * @returns {number | string | null}
 */
export function parseIoEgresoField(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (/^nc$/i.test(s)) return 'NC';
  var n = Number(s);
  return Number.isFinite(n) ? n : s;
}

/**
 * Compare ISO timestamps as strings (lex works for canonical ISO UTC); null sorts old.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @returns {number}
 */
function compareSavedAt(a, b) {
  if ((a == null || a === '') && (b == null || b === '')) return 0;
  if (a == null || a === '') return -1;
  if (b == null || b === '') return 1;
  return String(a).localeCompare(String(b));
}

/**
 * @param {unknown} patient
 */
export function ensureMonitoreo(patient) {
  if (!patient || typeof patient !== 'object') return patient;
  if (!/** @type {any} */ (patient).monitoreo) {
    /** @type {any} */ (patient).monitoreo = emptyMonitoreo();
  }
  backfillEstadoClinico(/** @type {any} */ (patient).monitoreo);
  return patient;
}

/**
 * Migra legacy `patient.estadoActual` a `patient.monitoreo.textoGuardado` y elimina la clave legacy.
 * @param {unknown} patient
 * @returns {boolean} true si cambió algo que conviene persistir (merge o eliminación de legacy)
 */
export function migratePatientMonitoreo(patient) {
  if (!patient || typeof patient !== 'object') return false;
  /** @type {any} */
  var p = patient;
  ensureMonitoreo(p);
  var leg = p.estadoActual;
  var hadLegacyKey = Object.prototype.hasOwnProperty.call(p, 'estadoActual');
  if (!leg || typeof leg !== 'object') {
    delete p.estadoActual;
    return hadLegacyKey;
  }
  var tg = p.monitoreo.textoGuardado;
  var legText = typeof leg.text === 'string' ? leg.text : leg.text != null ? String(leg.text) : '';
  var legSaved = leg.savedAt != null ? String(leg.savedAt) : null;
  if (compareSavedAt(legSaved, tg.savedAt) > 0) {
    tg.text = legText;
    tg.savedAt = legSaved;
  } else if ((!tg.text || tg.text === '') && !(tg.savedAt != null && String(tg.savedAt).length > 0) && legText) {
    tg.text = legText;
    tg.savedAt = legSaved != null ? legSaved : tg.savedAt;
  }
  delete p.estadoActual;
  return true;
}

/**
 * Copia modelo de monitoreo / legacy estadoActual desde un snapshot JSON hacia `target`, luego normaliza en sitio.
 * No muta `source`. Devuelve true si hubo que persistir cambios locales (migrate).
 * @param {unknown} target
 * @param {unknown} source
 */
export function mergePatientMonitoreoFromImported(target, source) {
  if (!target || typeof target !== 'object') return false;
  if (!source || typeof source !== 'object') return migratePatientMonitoreo(target);
  /** @type {any} */
  var s = source;
  /** @type {any} */
  var t = target;
  try {
    if ('monitoreo' in s && s.monitoreo != null && typeof s.monitoreo === 'object') {
      var incoming = JSON.parse(JSON.stringify(s.monitoreo));
      if (t.monitoreo != null && typeof t.monitoreo === 'object') {
        t.monitoreo = mergeMonitoreo(t.monitoreo, incoming);
      } else {
        t.monitoreo = incoming;
      }
    }
    if ('estadoActual' in s && s.estadoActual != null && typeof s.estadoActual === 'object') {
      t.estadoActual = JSON.parse(JSON.stringify(s.estadoActual));
    }
  } catch (_e) { void _e; }
  return migratePatientMonitoreo(target);
}

/**
 * Sort historial by recordedAt ascending.
 * @param {unknown[]} historial
 */
function historialSortedAsc(historial) {
  return historial.slice().sort(function (a, b) {
    var ra = typeof a === 'object' && a && 'recordedAt' in a ? String(/** @type {any} */ (a).recordedAt) : '';
    var rb = typeof b === 'object' && b && 'recordedAt' in b ? String(/** @type {any} */ (b).recordedAt) : '';
    return ra.localeCompare(rb);
  });
}

/**
 * SOAP/snapshot vitals follow vitalSeries when present (matches Signos vitales strip).
 * @param {{ vitals: Record<string, unknown>, alteredAt: Record<string, string>, vitalSeries: Record<string, unknown> }} snap
 */
function overlayVitalsFromSeries(snap) {
  var series = snap.vitalSeries;
  if (!series || typeof series !== 'object') return;
  var hasSeries = VITAL_BASE_KEYS.some(function (k) {
    return Array.isArray(series[k]) && series[k].length > 0;
  });
  if (!hasSeries) return;
  var leg = vitalSeriesToLegacyFields(/** @type {Record<string, Array<{ value: number, time?: string }>>} */ (series));
  Object.keys(leg.vitals).forEach(function (k) {
    if (leg.vitals[k] != null) snap.vitals[k] = leg.vitals[k];
  });
  Object.keys(leg.alteredAt).forEach(function (k) {
    if (leg.alteredAt[k]) snap.alteredAt[k] = leg.alteredAt[k];
  });
}

/**
 * @param {unknown} monitoreoLike
 */
export function deriveSnapshot(monitoreoLike) {
  /** @type {any} */
  var m = monitoreoLike || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var sortedAsc = historialSortedAsc(hist);

  var snap = {
    vitals: {},
    alteredAt: {},
    glucometrias: /** @type {Array<{ value?: unknown, time?: string }>} */ ([]),
    io: /** @type {{ ing: null | unknown, egr: null | unknown }} */ ({ ing: null, egr: null }),
  };

  var vitalsBlock = deriveVitalsFromHistorial_(sortedAsc);
  var gluBlock = deriveGluFromHistorial_(sortedAsc);
  snap.vitals = vitalsBlock.vitals;
  snap.alteredAt = vitalsBlock.alteredAt;
  snap.glucometrias = gluBlock.glucometrias.slice();
  snap.bombaInsulina = gluBlock.bombaInsulina;
  snap.bombaInsulinaAlgoritmo =
    m.bombaInsulinaAlgoritmo != null && Number.isFinite(Number(m.bombaInsulinaAlgoritmo))
      ? Number(m.bombaInsulinaAlgoritmo)
      : null;
  snap.io = deriveIoFromHistorial_(sortedAsc);
  snap.vitalSeries = deriveVitalSeriesFromHistorial_(sortedAsc);
  snap.tempPeakAt = deriveTempPeakAtFromHistorial_(sortedAsc);
  snap.bpPairs = deriveBpPairsFromHistorial_(sortedAsc);
  overlayVitalsFromSeries(snap);
  return snap;
}

/**
 * @param {unknown} monitoreoLike
 */
export function balanceTurno(monitoreoLike) {
  /** @type {any} */
  var m = monitoreoLike || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var sortedAsc = historialSortedAsc(hist);
  for (var i = sortedAsc.length - 1; i >= 0; i--) {
    var row = sortedAsc[i];
    if (!row || typeof row !== 'object') continue;
    var io =
      /** @type {any} */ (row).io && typeof /** @type {any} */ (row).io === 'object'
        ? /** @type {any} */ (/** @type {any} */ (row).io)
        : {};
    var bal = computeIoBalanceFromIngEgr(io.ing, io);
    if (!Number.isFinite(bal)) continue;
    return bal;
  }
  return NaN;
}

/**
 * @param {unknown} monitoreoLike
 */
export function balanceGlobalHistorico(monitoreoLike) {
  /** @type {any} */
  var m = monitoreoLike || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var sortedAsc = historialSortedAsc(hist);
  var sum = 0;
  var any = false;
  for (var i = 0; i < sortedAsc.length; i++) {
    var row = sortedAsc[i];
    if (!row || typeof row !== 'object') continue;
    var io =
      /** @type {any} */ (row).io && typeof /** @type {any} */ (row).io === 'object'
        ? /** @type {any} */ (/** @type {any} */ (row).io)
        : {};
    var bal = computeIoBalanceFromIngEgr(io.ing, io);
    if (!Number.isFinite(bal)) continue;
    sum += bal;
    any = true;
  }
  return any ? sum : NaN;
}

/**
 * @param {unknown} patientOrMonitoreo
 * @returns {any}
 */
function resolveMonitoreoContainer(patientOrMonitoreo) {
  /** @type {any} */
  var tgt = patientOrMonitoreo;
  if (!tgt || typeof tgt !== 'object') return null;
  if (Array.isArray(tgt.historial)) return tgt;
  if (tgt.monitoreo && typeof tgt.monitoreo === 'object' && Array.isArray(tgt.monitoreo.historial))
    return tgt.monitoreo;
  tgt.monitoreo = emptyMonitoreo();
  return tgt.monitoreo;
}

/**
 * @param {unknown} patientOrMonitoreo
 * @param {MedicionHistorial | unknown} medicion
 */
export function appendMedicion(patientOrMonitoreo, medicion) {
  if (!medicion || typeof medicion !== 'object') return { ok: false, error: 'empty' };
  /** @type {any} */
  var mon = resolveMonitoreoContainer(patientOrMonitoreo);
  if (!mon) return { ok: false, error: 'empty' };
  mon.historial.push(structuredClone(/** @type {object} */ (medicion)));
  return { ok: true };
}

/**
 * @param {unknown} patientOrMonitoreo
 * @param {string} id
 */
export function removeMedicion(patientOrMonitoreo, id) {
  /** @type {any} */
  var mon = resolveMonitoreoContainer(patientOrMonitoreo);
  if (!mon || !Array.isArray(mon.historial)) return;
  mon.historial = mon.historial.filter(function (row) {
    return row && typeof row === 'object' && /** @type {any} */ (row).id !== id;
  });
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseWeightKg(raw) {
  if (raw == null || raw === '') return null;
  var n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Peso para cálculo dietético: solo datos del paciente (o pesoRef legacy en monitoreo).
 * @param {{ patientPeso?: unknown, pesoRef?: unknown }} [opts]
 * @returns {number | null}
 */
export function resolveDietWeightKg(opts) {
  opts = opts || {};
  return parseWeightKg(opts.patientPeso) ?? parseWeightKg(opts.pesoRef);
}

/**
 * Normaliza etiqueta SOME de tipo dieta (quita *, prefijo DIETA, espacios).
 * @param {unknown} dietaText
 * @returns {string}
 */
export function normalizeDietaTypeLabel(dietaText) {
  return String(dietaText || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[*•-]+\s*/g, '')
    .replace(/\s*[*•-]+$/g, '')
    .toUpperCase()
    .replace(/^DIETA\s+/, '');
}

/**
 * Quita sufijo calórico SOME en paréntesis del label (p. ej. "NORMAL (1750 kcal, 70 g prot)" → "NORMAL").
 * @param {unknown} dietaText
 * @returns {string}
 */
export function stripDietaMacroSuffixFromLabel(dietaText) {
  return normalizeDietaTypeLabel(dietaText).replace(
    /\s*\(\s*\d+\s*KCAL(?:\s*,\s*\d+\s*G\s*PROT)?[^)]*\)\s*$/i,
    ''
  ).trim();
}

export function isDietaAyuno(dietaText) {
  return normalizeDietaTypeLabel(dietaText) === 'AYUNO';
}

/**
 * Dieta SOME tipo suplemento: sin requerimiento calórico en EA.
 * @param {unknown} dietaText
 * @returns {boolean}
 */
export function isDietaSuplemento(dietaText) {
  var t = normalizeDietaTypeLabel(dietaText);
  if (!t) return false;
  if (t === 'SUPLEMENTO') return true;
  if (!t.startsWith('SUPLEMENTO')) return false;
  return !/\b(NORMAL|BLANDA|LIQUIDA|LIQUID[OA]|PICAD[OA]|DIABETIC[OA]|HIPERPROTEIC[OA]|RESTRINGID[OA])\b/.test(t);
}

/**
 * @param {Record<string, unknown> | null | undefined} record
 */
export function clearDietCaloricFields(record) {
  if (!record || typeof record !== 'object') return;
  DIET_CALORIC_KEYS.forEach(function (k) {
    record[k] = '';
  });
}

/**
 * Suplemento: sin requerimiento calórico — limpia campos calóricos en estado y propuesta.
 * @param {Record<string, unknown> | null | undefined} estadoClinico
 * @param {Record<string, unknown> | null | undefined} [pendienteReceta]
 * @returns {boolean} true si la dieta es suplemento y se aplicó la limpieza
 */
export function applyDietaSuplementoPolicy(estadoClinico, pendienteReceta) {
  if (!estadoClinico || typeof estadoClinico !== 'object') return false;
  if (!isDietaSuplemento(estadoClinico.dieta) && !isDietaAyuno(estadoClinico.dieta)) return false;
  clearDietCaloricFields(estadoClinico);
  if (pendienteReceta && typeof pendienteReceta === 'object') {
    clearDietCaloricFields(pendienteReceta);
  }
  return true;
}

/**
 * @param {unknown} kcalKg
 * @param {number | null} weightKg
 * @returns {number | null}
 */
export function computeDietKcalTotal(kcalKg, weightKg) {
  var k = Number(kcalKg);
  if (!Number.isFinite(k) || k <= 0 || weightKg == null) return null;
  return Math.round(k * weightKg);
}

/**
 * @param {unknown} kcalTotal
 * @param {number | null} weightKg
 * @returns {number | null}
 */
export function computeDietKcalKgFromTotal(kcalTotal, weightKg) {
  var t = Number(kcalTotal);
  if (!Number.isFinite(t) || t <= 0 || weightKg == null || weightKg <= 0) return null;
  return Math.round((t / weightKg) * 10) / 10;
}

/**
 * Actualiza estadoClinico.kcal cuando hay kcal/kg y peso válidos.
 * @param {Record<string, unknown> | null | undefined} estadoClinico
 * @param {number | null} weightKg
 * @returns {boolean}
 */
export function syncDietKcalFromWeight(estadoClinico, weightKg) {
  if (!estadoClinico || typeof estadoClinico !== 'object' || weightKg == null) return false;
  if (isDietaSuplemento(estadoClinico.dieta)) return false;
  var total = computeDietKcalTotal(estadoClinico.kcalKg, weightKg);
  if (total == null) return false;
  estadoClinico.kcal = String(total);
  return true;
}
