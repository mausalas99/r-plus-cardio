/** Shared date helpers for IC export payload. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** @param {unknown} raw */
export function toYmd(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (ISO_RE.test(s)) return s;
  const m = DMY_RE.exec(s);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** @param {string} ymd */
export function formatDisplayDate(ymd) {
  const m = ISO_RE.exec(String(ymd || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** @param {string} ymd → 13.03.26 */
export function formatShortDate(ymd) {
  const m = ISO_RE.exec(String(ymd || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
}

/** @param {unknown} patient */
export function resolveIngresoYmd(patient) {
  if (!patient || typeof patient !== 'object') return '';
  /** @type {any} */
  const p = patient;
  return toYmd(p.fimiFecha) || toYmd(p.fiuxFecha) || toYmd(p.ingresoDate) || '';
}
