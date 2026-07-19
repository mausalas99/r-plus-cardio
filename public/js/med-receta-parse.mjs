import { trimStr } from './med-receta-util.mjs';
import {
  parseFechaDMYFromTimestampCell,
  extractDiaTratamiento,
} from './med-receta-dates.mjs';
import {
  extractDietNutrients,
  dietNutrientBlobFromCols,
  normalizeDietaCols,
  resolveDietaDescripcionRaw,
} from './med-receta-diet.mjs';
import { normalizeNombreForSoapClassify } from './med-receta-nombre.mjs';
import { classifyMedicationSoapCategory, shouldIncludeMedicationInSoap } from './med-receta-soap.mjs';

var SOME_TS_CLASS_RE =
  /^(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:a\.m\.|p\.m\.))\s+(MEDICAMENTOS(?:\s+P[12])?|MEDICAMENTO(?:\s+P[12])?|DIETAS|CUIDADOS|ESTUDIOS|PROCEDIMIENTO)\s+(.*)$/i;

var SOME_MED_VIA_RE =
  /\s+(VIA\s+(?:ORAL|INTRAVENOSA|SUBCUT[AÁ]NEA|RECTAL|T[OÓ]PICA|INHALATORIA|NEBULIZACI[OÓ]N|GASTROENTERICA|INTRAMUSCULAR))\s+/i;

var SOME_MED_FREC_TAIL_RE =
  /\s+(CADA\s+(?:\d+\s+)?(?:HORAS?|HRS?)|PRN|POR\s+TURNO|UNICA\s+VEZ)\s*$/i;

/** @param {string} tipo */
function isIndicacionesMedClass(tipo) {
  return /^MEDICAMENTOS?(?:\s+P[12])?$/i.test(trimStr(tipo));
}

/**
 * SOME copiado con espacios simples: NOMBRE VIA … DOSIS FRECUENCIA [NW].
 * @param {string} tail
 * @returns {string[] | null}
 */
function splitMedSpaceSeparatedTail_(tail) {
  var s = trimStr(tail);
  var viaM = s.match(SOME_MED_VIA_RE);
  if (!viaM || viaM.index == null) return null;
  var nombre = trimStr(s.slice(0, viaM.index));
  var via = trimStr(viaM[1]);
  var mid = trimStr(s.slice(viaM.index + viaM[0].length));
  if (!nombre || !via || !mid) return null;
  var nw = false;
  if (/\s+NW\s*$/i.test(mid)) {
    nw = true;
    mid = trimStr(mid.replace(/\s+NW\s*$/i, ''));
  }
  var frecuencia = '';
  var dosis = mid;
  var frecM = mid.match(SOME_MED_FREC_TAIL_RE);
  if (frecM && frecM.index != null) {
    frecuencia = trimStr(frecM[0]);
    dosis = trimStr(mid.slice(0, frecM.index));
  } else if (/\s+-\s*$/.test(mid)) {
    frecuencia = '-';
    dosis = trimStr(mid.replace(/\s+-\s*$/, ''));
  }
  return [nombre, via, dosis, frecuencia, nw ? 'NW' : ''];
}

function splitIndicacionesCols(line) {
  var raw = String(line || '');
  if (raw.indexOf('\t') >= 0) return raw.split('\t');
  var s = trimStr(raw);
  var m = s.match(SOME_TS_CLASS_RE);
  if (!m) return [s];
  var clase = m[2].toUpperCase();
  var tail = trimStr(m[3]);
  if (clase === 'DIETAS') {
    var nw = /\bNW\s*$/i.test(tail);
    var desc = nw ? trimStr(tail.replace(/\s+NW\s*$/i, '')) : tail;
    if (/\s{2,}/.test(desc)) {
      var chunks = desc.split(/\s{2,}/).map(trimStr);
      return padIndicacionesCols_([m[1], clase].concat(chunks).concat(nw ? ['NW'] : []));
    }
    return padIndicacionesCols_([m[1], clase, desc, '', '', nw ? 'NW' : '', '']);
  }
  if (/\s{2,}/.test(tail)) {
    return padIndicacionesCols_([m[1], clase].concat(tail.split(/\s{2,}/).map(trimStr)));
  }
  if (isIndicacionesMedClass(clase)) {
    var medCols = splitMedSpaceSeparatedTail_(tail);
    if (medCols) return padIndicacionesCols_([m[1], clase].concat(medCols));
  }
  return [s];
}

function normalizeIndicacionesPasteText(text) {
  var raw = String(text || '');
  if (/\t/.test(raw)) return raw;
  return raw
    .split(/\r?\n/)
    .map(function (line) {
      if (!trimStr(line) || line.indexOf('\t') >= 0) return line;
      var cols = splitIndicacionesCols(line);
      return cols.length > 1 ? cols.join('\t') : line;
    })
    .join('\n');
}

function indicacionesMinCols_(tipoEarly) {
  if (tipoEarly === 'DIETAS') return 4;
  return 6;
}

function parseMedRow(cols, lineIndex, lineText) {
  var dosisRaw = trimStr(cols[4]);
  var dia = extractDiaTratamiento(dosisRaw);
  if (dia == null) dia = extractDiaTratamiento(lineText);
  return {
    id: 'med-' + Date.now().toString(36) + '-' + lineIndex + '-' + Math.random().toString(36).slice(2, 5),
    tipoRaw: trimStr(cols[1]).toUpperCase(),
    nombreRaw: trimStr(cols[2]),
    viaRaw: trimStr(cols[3]),
    dosisRaw: dosisRaw,
    frecuenciaRaw: trimStr(cols[5]),
    suspendido: false,
    diaTratamiento: dia,
  };
}

function parseDietaRow(cols, lineIndex) {
  var norm = normalizeDietaCols(cols);
  var detalleRaw = trimStr(norm[4]) || trimStr(norm[5]);
  var nutrients = extractDietNutrients(dietNutrientBlobFromCols(norm));
  return {
    id: 'dieta-' + Date.now().toString(36) + '-' + lineIndex,
    descripcionRaw: resolveDietaDescripcionRaw(cols, norm),
    detalleRaw: detalleRaw,
    kcal: nutrients.kcal,
    proteinG: nutrients.proteinG,
    suspendido: false,
  };
}

function padIndicacionesCols_(cols) {
  while (cols.length < 7) cols.push('');
  return cols;
}

function shouldSkipIndicacionesLine_(cols, tipoEarly) {
  var minCols = indicacionesMinCols_(tipoEarly);
  if (cols.length >= 7) return false;
  if (cols.length >= minCols && (tipoEarly === 'DIETAS' || isIndicacionesMedClass(tipoEarly))) {
    return false;
  }
  return true;
}

function processIndicacionesLine_(cols, lineIndex, lineText, items, dietas, fechas, skippedSummary) {
  var tipo = trimStr(cols[1]).toUpperCase();
  var fd = parseFechaDMYFromTimestampCell(cols[0]);
  if (fd) fechas.push(fd);
  if (isIndicacionesMedClass(tipo)) {
    items.push(parseMedRow(cols, lineIndex, lineText));
    return 0;
  }
  if (tipo === 'DIETAS') {
    dietas.push(parseDietaRow(cols, lineIndex));
    return 0;
  }
  if (tipo === 'CUIDADOS') skippedSummary.cuidados += 1;
  else if (tipo === 'ESTUDIOS') skippedSummary.estudios += 1;
  else if (tipo === 'PROCEDIMIENTO') skippedSummary.other += 1;
  else skippedSummary.other += 1;
  return 1;
}

export function parseIndicacionesPaste(text) {
  var normalized = normalizeIndicacionesPasteText(text);
  var lines = String(normalized || '')
    .split(/\r?\n/)
    .map(trimStr)
    .filter(Boolean);
  var items = [];
  var dietas = [];
  var fechas = [];
  var skipped = 0;
  var skippedSummary = { cuidados: 0, estudios: 0, other: 0 };
  for (var i = 0; i < lines.length; i += 1) {
    var cols = splitIndicacionesCols(lines[i]);
    var tipoEarly = cols.length >= 2 ? trimStr(cols[1]).toUpperCase() : '';
    if (shouldSkipIndicacionesLine_(cols, tipoEarly)) {
      skipped += 1;
      skippedSummary.other += 1;
      continue;
    }
    if (cols.length < 7) cols = padIndicacionesCols_(cols);
    skipped += processIndicacionesLine_(cols, i, lines[i], items, dietas, fechas, skippedSummary);
  }
  return {
    items: items,
    dietas: dietas,
    fechas: fechas,
    skipped: skipped,
    skippedSummary: skippedSummary,
  };
}

export function parseMedicationPaste(text) {
  var r = parseIndicacionesPaste(text);
  return { items: r.items, fechas: r.fechas, skipped: r.skipped };
}

/** Bloque TSV SOME (medicamentos, dietas, etc.). */
export function looksLikeSomeIndicacionesPaste(text) {
  var raw = String(text || '');
  if (!raw.trim()) return false;
  var lines = raw.split(/\r?\n/).map(trimStr).filter(Boolean);
  for (var i = 0; i < lines.length; i += 1) {
    var cols = splitIndicacionesCols(lines[i]);
    if (cols.length < 2) continue;
    var tipo = trimStr(cols[1]).toUpperCase();
    if (cols.length < indicacionesMinCols_(tipo)) continue;
    if (isIndicacionesMedClass(tipo) || tipo === 'DIETAS') return true;
  }
  return false;
}

export function looksLikeSomeMedicationPaste(text) {
  return looksLikeSomeIndicacionesPaste(text);
}

export function shouldAutoSelectSoap(item) {
  if (!item || item.suspendido) return false;
  if (!shouldIncludeMedicationInSoap(item, classifyMedicationSoapCategory)) return false;
  var nombre = trimStr(item.nombreRaw);
  if (classifyMedicationSoapCategory(nombre, item.dosisRaw) !== 'otros') return true;
  var blob = normalizeNombreForSoapClassify(
    [nombre, item.dosisRaw, item.frecuenciaRaw].join(' ')
  );
  if (/\bINSULINA\b/.test(blob)) return true;
  if (/\b(GLARGINA|DEGLUDEC|DETEMIR|NPH)\b/.test(blob)) return true;
  return false;
}

export function resolveFechaActualizacion(fechas, fallbackDMY) {
  var list = (fechas || []).filter(Boolean);
  if (!list.length) return trimStr(fallbackDMY) || '';
  var counts = Object.create(null);
  for (var i = 0; i < list.length; i += 1) {
    var k = list[i];
    counts[k] = (counts[k] || 0) + 1;
  }
  var best = list[0];
  var bestN = 0;
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > bestN) {
      bestN = counts[k];
      best = k;
    }
  });
  return best;
}
