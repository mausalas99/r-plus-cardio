/**
 * Fechas relativas a «hoy» para el tour guiado (DEMO PÉREZ / DEMO GARCÍA).
 */
import {
  DEMO_SOME_LAB_REPORT,
  OLDER_DEMO_SOME_LAB_REPORT,
  DEMO_GARCIA_LAB_REPORT,
} from './tour-demo-some-lab.mjs';
import { LAB_BULK_PATIENT_SEPARATOR } from './lab-bulk-paste.mjs';

const SOME_MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const FECHA_REGISTRO_RE = /Fecha Registro:\t[^\n]+/;

/**
 * @param {Date} d
 * @param {number} days
 */
export function addTourDays(d, days) {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return out;
}

/** @param {Date} d */
export function formatTourFechaSlash(d) {
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  );
}

/** @param {Date} d */
export function formatTourHora(d) {
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}

/** ISO YYYY-MM-DD para inputs type=date (FIUX / FIMI). @param {Date} d */
export function formatTourIsoDate(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * Encabezado SOME en inglés (p. ej. «May 31 2026 9:42AM»).
 * @param {Date} d
 * @param {number} hour24
 * @param {number} minute
 */
export function formatSomeFechaRegistroEn(d, hour24, minute) {
  const h = hour24 % 12 || 12;
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  const minStr = String(minute).padStart(2, '0');
  return (
    SOME_MONTHS_EN[d.getMonth()] +
    ' ' +
    d.getDate() +
    ' ' +
    d.getFullYear() +
    ' ' +
    h +
    ':' +
    minStr +
    ampm
  );
}

/**
 * @param {string} report
 * @param {Date} date
 * @param {{ hour?: number, minute?: number }} [opts]
 */
export function patchSomeLabFechaRegistro(report, date, opts) {
  const hour = opts && opts.hour != null ? opts.hour : 9;
  const minute = opts && opts.minute != null ? opts.minute : 0;
  const line = 'Fecha Registro:\t' + formatSomeFechaRegistroEn(date, hour, minute);
  return String(report || '').replace(FECHA_REGISTRO_RE, line);
}

/**
 * @param {Date} [ref]
 */
export function buildTourDemoDates(ref) {
  const now = ref instanceof Date ? ref : new Date();
  const fiuxDate = addTourDays(now, -2);
  const fimiDate = addTourDays(now, -1);
  const labOlderDate = addTourDays(now, -8);
  const labNewerDate = addTourDays(now, -1);

  const demoSomeLabReport = patchSomeLabFechaRegistro(DEMO_SOME_LAB_REPORT, labNewerDate, {
    hour: 9,
    minute: 42,
  });
  const olderDemoSomeLabReport = patchSomeLabFechaRegistro(OLDER_DEMO_SOME_LAB_REPORT, labOlderDate, {
    hour: 7,
    minute: 18,
  });
  const demoGarciaLabReport = patchSomeLabFechaRegistro(DEMO_GARCIA_LAB_REPORT, now, {
    hour: 11,
    minute: 5,
  });

  return {
    fecha: formatTourFechaSlash(now),
    hora: formatTourHora(now),
    fiuxFecha: formatTourIsoDate(fiuxDate),
    fimiFecha: formatTourIsoDate(fimiDate),
    labFechaOlder: formatTourFechaSlash(labOlderDate),
    labFechaNewer: formatTourFechaSlash(labNewerDate),
    demoSomeLabReport,
    olderDemoSomeLabReport,
    demoGarciaLabReport,
    demoTourLabPaste: demoSomeLabReport + '\n\n' + olderDemoSomeLabReport,
  };
}

/** FIUX / FIMI en el objeto paciente desde el bundle del tour. */
export function applyTourDemoIngresoDates(patient, bundle) {
  if (!patient || !bundle) return;
  patient.fiuxFecha = bundle.fiuxFecha;
  patient.fimiFecha = bundle.fimiFecha;
}

/** Pérez (dos días) + separador + GARCÍA para vista previa multi-paciente del tour. */
export function buildTourDemoLabPasteBoth(ref) {
  const bundle = buildTourDemoDates(ref);
  return (
    bundle.demoTourLabPaste +
    '\n' +
    LAB_BULK_PATIENT_SEPARATOR +
    '\n' +
    bundle.demoGarciaLabReport
  );
}
