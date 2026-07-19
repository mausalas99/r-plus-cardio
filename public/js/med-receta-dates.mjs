import { trimStr } from './med-receta-util.mjs';

function normalizeDiaMarkerText(s) {
  return String(s == null ? '' : s)
    .replace(/\u2217/g, '*')
    .replace(/\u204E/g, '*')
    .replace(/\uFF0A/g, '*')
    .replace(/\u00B7/g, ' ');
}

export function stripDiaMarkersFromDosis(dosisPart) {
  var t = normalizeDiaMarkerText(String(dosisPart || ''));
  return trimStr(
    t.replace(/\*?\s*DIA\s*#\s*\d+\s*\*?/gi, '').replace(/\s+/g, ' ')
  );
}

export function parseFechaDMYFromTimestampCell(cell) {
  var t = trimStr(cell);
  var m = t.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return m ? m[1] : '';
}

export function extractDiaTratamiento(dosisRaw) {
  var t = normalizeDiaMarkerText(trimStr(dosisRaw));
  var m = t.match(/DIA\s*#\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** @param {string} fechaDMY dd/mm/yyyy */
export function parseFechaDMYToLocalDate(fechaDMY) {
  var m = trimStr(fechaDMY).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  var day = parseInt(m[1], 10);
  var mon = parseInt(m[2], 10) - 1;
  var y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  var d = new Date(y, mon, day);
  if (d.getFullYear() !== y || d.getMonth() !== mon || d.getDate() !== day) return null;
  return d;
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Días calendario desde fechaDMY (inclusive) hasta refDate (por defecto hoy).
 * @param {string} fechaDMY
 * @param {Date} [refDate]
 */
export function calendarDaysSinceFechaDMY(fechaDMY, refDate) {
  var start = parseFechaDMYToLocalDate(fechaDMY);
  if (!start) return 0;
  var ref = refDate ? startOfLocalDay(refDate) : startOfLocalDay(new Date());
  var diff = Math.round((ref.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

/** Suma dayOffset a cada marcador DIA n en texto SOAP (p. ej. MEROPENEM … DIA 10 → DIA 12). */
export function advanceDiaInMedSoapText(text, dayOffset) {
  var off = parseInt(dayOffset, 10);
  if (!Number.isFinite(off) || off <= 0 || text == null || !String(text).trim()) {
    return trimStr(text);
  }
  return String(text).replace(/\bDIA\s+(\d+)\b/gi, function (_m, n) {
    return 'DIA ' + (parseInt(n, 10) + off);
  });
}

/**
 * Antibióticos en EA: el DIA guardado es relativo a fechaActualizacion de Manejo;
 * en pantalla se avanza por días calendario transcurridos.
 * @param {string} text
 * @param {string} fechaActualizacion dd/mm/yyyy
 * @param {Date} [refDate]
 */
export function advanceAbxMedTextForManejoDate(text, fechaActualizacion, refDate) {
  var offset = calendarDaysSinceFechaDMY(fechaActualizacion, refDate);
  return advanceDiaInMedSoapText(text, offset);
}

/**
 * Día de tratamiento efectivo hoy (o refDate) respecto a fechaActualizacion de Manejo.
 * @param {number | null | undefined} baseDia
 * @param {string | null | undefined} fechaActualizacion
 * @param {Date} [refDate]
 */
export function effectiveDiaTratamiento(baseDia, fechaActualizacion, refDate) {
  if (baseDia == null || !Number.isFinite(baseDia)) return null;
  var fecha = trimStr(fechaActualizacion);
  if (!fecha) return baseDia;
  return baseDia + calendarDaysSinceFechaDMY(fecha, refDate);
}

/** Reemplaza el primer marcador DIA# en dosisRaw conservando formato (*DIA# n*). */
export function setDiaTratamientoInDosis(dosisRaw, dia) {
  var t = normalizeDiaMarkerText(trimStr(dosisRaw));
  if (!/DIA\s*#\s*\d+/i.test(t)) return trimStr(dosisRaw);
  var n = parseInt(dia, 10);
  if (!Number.isFinite(n) || n < 1) return trimStr(dosisRaw);
  return t.replace(/(\*?\s*DIA\s*#\s*)\d+(\s*\*?)/i, function (_m, pre, post) {
    return pre + String(n) + post;
  });
}

/** Incrementa día en ítems con DIA# (no suspendidos). */
export function incrementMedItemsDiaTratamiento(items) {
  var list = Array.isArray(items) ? items : [];
  var count = 0;
  var next = list.map(function (it) {
    if (!it || it.suspendido || it.diaTratamiento == null) return it;
    var diaNext = it.diaTratamiento + 1;
    count += 1;
    return Object.assign({}, it, {
      diaTratamiento: diaNext,
      dosisRaw: setDiaTratamientoInDosis(it.dosisRaw, diaNext),
    });
  });
  return { items: next, count: count };
}
