/** Fecha de acceso del paciente: ISO (YYYY-MM-DD) en UI type=date; legado DD/MM/AAAA. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** @param {unknown} raw */
export function accesoFechaToDateInputValue(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (ISO_RE.test(s)) return s;
  var m = DMY_RE.exec(s);
  if (!m) return '';
  var d = m[1].padStart(2, '0');
  var mo = m[2].padStart(2, '0');
  var y = m[3];
  return y + '-' + mo + '-' + d;
}

/** @param {unknown} isoValue from input[type=date] */
export function dateInputValueToAccesoFecha(isoValue) {
  var s = String(isoValue == null ? '' : isoValue).trim();
  return ISO_RE.test(s) ? s : '';
}

/** @param {unknown} raw stored value */
export function formatAccesoFechaDisplay(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  var m = ISO_RE.exec(s);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return s;
}
