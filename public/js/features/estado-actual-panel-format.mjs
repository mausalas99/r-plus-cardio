/** Display / escape helpers for Estado Actual panel markup. */
import { formatBalanceLive } from './estado-actual-io.mjs';

export { escHtml, escAttr };

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {unknown} value
 * @returns {string}
 */

import { escHtml, escAttr } from '../dom-escape.mjs';
export function displayValue(value) {
  return value != null && value !== '' ? String(value) : '—';
}

/**
 * @param {unknown} n
 * @returns {string}
 */
export function displayBalance(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return formatBalanceLive(n);
}

/** Number inputs reject non-numeric value attributes (e.g. legacy demo strings). */
export function escAttrNumeric(s) {
  const raw = String(s ?? '').trim();
  if (!raw) return '';
  const n = Number(raw);
  return Number.isFinite(n) ? escAttr(String(n)) : '';
}

/**
 * @param {string | null | undefined} savedAt
 * @returns {string}
 */
export function formatEaSavedLabel(savedAt) {
  if (!savedAt) return '';
  var d = new Date(savedAt);
  if (isNaN(d.getTime())) return '';
  return (
    'Guardado ' +
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
 * @param {Date | string | number} [when]
 * @returns {string}
 */
export function toDatetimeLocalValue(when) {
  var d = when == null ? new Date() : when instanceof Date ? when : new Date(when);
  if (isNaN(d.getTime())) return '';
  return (
    d.getFullYear() +
    '-' +
    pad2(d.getMonth() + 1) +
    '-' +
    pad2(d.getDate()) +
    'T' +
    pad2(d.getHours()) +
    ':' +
    pad2(d.getMinutes())
  );
}

/**
 * @param {string} localValue
 * @returns {string}
 */
export function datetimeLocalToIso(localValue) {
  if (!localValue || !String(localValue).trim()) return new Date().toISOString();
  var d = new Date(localValue);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function isoToHHmm(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseNumOrNull(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  var n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
