/**
 * Defaults del modal «Registrar medición»: cierre de turno a las 00:00 de hoy,
 * glucometrías del turno previo (ayer 08:00 → hoy 00:00).
 */
import { pad2 } from './estado-actual-panel-format.mjs';

/** Horarios estándar: 08:00 y 16:00 del día previo, 00:00 (medianoche) del día actual. */
export const STANDARD_GLUCOMETRIA_TIMES = ['08:00', '16:00', '00:00'];

/** Hora de cierre de turno en registro manual — no es «cuándo» ocurrió un signo alterado. */
export const TURN_CLOSE_HM = '00:00';

/**
 * @param {unknown} time
 * @returns {boolean}
 */
export function isTurnCloseHm(time) {
  return String(time || '').trim() === TURN_CLOSE_HM;
}

/**
 * Hora alterada para narrativa SOAP / snapshot de signos (omite cierre de turno).
 * @param {unknown} time
 * @returns {string}
 */
export function vitalAlteredTimeForDisplay(time) {
  var t = String(time || '').trim();
  if (!t || isTurnCloseHm(t)) return '';
  return t;
}

/**
 * Etiqueta de momento para snapshot: fecha corta si cierre de turno; si no, `dd/mm HH:mm`.
 * @param {string | undefined} recordedAt
 * @param {string | undefined} timeHm
 * @returns {string}
 */
export function formatEaVitalStampForSnapshot(recordedAt, timeHm) {
  var rec = recordedAt != null ? String(recordedAt) : '';
  if (!rec) return vitalAlteredTimeForDisplay(timeHm);
  if (isTurnCloseHm(timeHm) || !String(timeHm || '').trim()) {
    var ms = gluPointMs(rec, '');
    if (!ms) return '';
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
  }
  return formatEaVitalPointShorthand(rec, timeHm);
}

/**
 * @param {Date} d
 * @returns {Date}
 */
export function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Última toma del turno: medianoche del día local actual.
 * @param {Date} [now]
 * @returns {Date}
 */
export function getDefaultRegistroRecordedAt(now) {
  var ref = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return startOfLocalDay(ref);
}

/**
 * Ventana de glucometrías: desde ayer 08:00 hasta la toma de cierre (hoy 00:00, inclusive).
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date }}
 */
export function getGlucometriaRegistroWindow(now) {
  var ref = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  var end = startOfLocalDay(ref);
  var start = new Date(end);
  start.setDate(start.getDate() - 1);
  start.setHours(8, 0, 0, 0);
  return { start: start, end: end };
}

/**
 * @param {string | undefined} iso
 * @returns {Date | null}
 */
function parseRecordedAt(iso) {
  if (!iso) return null;
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} d
 * @returns {boolean}
 */
function isStartOfLocalDay(d) {
  return (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  );
}

/**
 * Instantánea local de una glucometría (fecha del registro + hora de la toma).
 * En cierre de turno (recordedAt a las 00:00 locales), 08:00 y 16:00 son del día previo.
 * @param {string} recordedAt
 * @param {string | undefined} timeHm
 * @returns {number}
 */
export function gluPointMs(recordedAt, timeHm) {
  var base = parseRecordedAt(recordedAt);
  if (!base) return 0;
  if (!timeHm || !String(timeHm).trim()) return base.getTime();
  var parts = String(timeHm).trim().split(':');
  var h = Number(parts[0]);
  var m = Number(parts[1] != null ? parts[1] : 0);
  if (!Number.isFinite(h)) return base.getTime();
  var d = new Date(base);
  d.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  if (isStartOfLocalDay(base)) {
    var hm = String(timeHm).trim();
    if (hm === '08:00' || hm === '16:00') {
      d.setDate(d.getDate() - 1);
    }
  }
  return d.getTime();
}

/**
 * Fecha corta para narrativa SOAP de picos: `dd/mm HH:mm` (local).
 * @param {string | undefined} recordedAt
 * @param {string | undefined} timeHm
 * @returns {string}
 */
export function formatEaVitalPointShorthand(recordedAt, timeHm) {
  var rec = recordedAt != null ? String(recordedAt) : '';
  if (!rec) return '';
  var ms = gluPointMs(rec, timeHm != null ? String(timeHm) : '');
  if (!ms) return '';
  var d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return (
    pad2(d.getDate()) +
    '/' +
    pad2(d.getMonth() + 1) +
    ' ' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes())
  );
}

/**
 * @param {Array<{ value?: unknown, time?: string, [key: string]: unknown }>} glus
 * @param {string} [recordedAt]
 * @returns {Array<{ value?: unknown, time?: string, [key: string]: unknown }>}
 */
export function sortGlucometriasChronologically(glus, recordedAt) {
  var list = Array.isArray(glus) ? glus.slice() : [];
  var rec = recordedAt != null ? String(recordedAt) : '';
  list.sort(function (a, b) {
    var ta = a && typeof a === 'object' && a.time != null ? String(a.time) : '';
    var tb = b && typeof b === 'object' && b.time != null ? String(b.time) : '';
    var ma = gluPointMs(rec, ta);
    var mb = gluPointMs(rec, tb);
    if (ma !== mb) return ma - mb;
    return String(a && typeof a === 'object' ? a.value : '').localeCompare(
      String(b && typeof b === 'object' ? b.value : '')
    );
  });
  return list;
}

/**
 * @param {number} ms
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isGluPointInRegistroWindow(ms, now) {
  if (!ms) return false;
  var win = getGlucometriaRegistroWindow(now);
  return ms >= win.start.getTime() && ms <= win.end.getTime();
}

/**
 * @param {Array<{ recordedAt?: string, glucometrias?: Array<{ value?: unknown, time?: string }> }>} historial
 * @param {Date} [now]
 * @returns {Array<{ value: unknown, time: string }>}
 */
/**
 * @param {Array<{ recordedAt?: string, glucometrias?: Array<{ value?: unknown, time?: string }> }>} historial
 * @param {Date} ref
 * @param {Set<string>} seen
 * @returns {Array<{ value: unknown, time: string, recordedAt: string }>}
 */
function collectGluFromHistRow(row, ref, seen) {
  var out = [];
  if (!row || typeof row !== 'object') return out;
  var recordedAt = row.recordedAt != null ? String(row.recordedAt) : '';
  var glus = Array.isArray(row.glucometrias) ? row.glucometrias : [];
  for (var j = 0; j < glus.length; j++) {
    var g = glus[j];
    if (!g || typeof g !== 'object') continue;
    var val = /** @type {any} */ (g).value;
    if (val == null || val === '') continue;
    var time = /** @type {any} */ (g).time != null ? String(/** @type {any} */ (g).time) : '';
    var ms = gluPointMs(recordedAt, time);
    if (!isGluPointInRegistroWindow(ms, ref)) continue;
    var key = String(val) + '@' + time + '@' + recordedAt;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value: val, time: time, recordedAt: recordedAt });
  }
  return out;
}

export function collectGlucometriasForRegistroWindow(historial, now) {
  var ref = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  var hist = Array.isArray(historial) ? historial : [];
  /** @type {Array<{ value: unknown, time: string, recordedAt: string }>} */
  var out = [];
  /** @type {Set<string>} */
  var seen = new Set();

  for (var i = 0; i < hist.length; i++) {
    out.push.apply(out, collectGluFromHistRow(hist[i], ref, seen));
  }

  out.sort(function (a, b) {
    var ma = gluPointMs(a.recordedAt, a.time);
    var mb = gluPointMs(b.recordedAt, b.time);
    if (ma !== mb) return ma - mb;
    return String(a.value).localeCompare(String(b.value));
  });
  return out.map(function (entry) {
    return { value: entry.value, time: entry.time };
  });
}
