/**
 * Parser de texto pegado para monitoreo (signos, DXT, I/O, EVAC).
 * Líneas en cualquier orden; B se ignora (balance calculado).
 */
import {
  parseIoIngresoField,
  parseIoEgresoLine,
  parseIoEvacField,
  serializeEgrPartsToFormText,
  diuresisValueFromParts,
  toEaSalidaText,
} from './estado-actual-io.mjs';
import { parseSatLineVariants, stripVitalUnitSuffix } from './estado-actual-parse-variants.mjs';

export { parseIoIngresoField } from './estado-actual-io.mjs';

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseNumberToken(raw) {
  if (raw == null) return null;
  var s = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  if (!s) return null;
  var n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} token
 * @returns {{ value: number, time?: string } | null}
 */
export function parseGlucometriaToken(token) {
  var s = String(token || '').trim();
  if (!s) return null;
  var m = s.match(/^([\d.,]+)(?:\s*(?:@|\s)\s*(\d{1,2}:\d{2}))?$/i);
  if (!m) {
    m = s.match(/^([\d.,]+)\s*\(\s*(\d{1,2}:\d{2})\s*\)$/i);
  }
  if (!m) return null;
  var value = parseNumberToken(m[1]);
  if (value == null) return null;
  /** @type {{ value: number, time?: string }} */
  var out = { value: value };
  if (m[2]) {
    var parts = m[2].split(':');
    out.time = pad2(parts[0]) + ':' + pad2(parts[1]);
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {string} rest
 * @returns {string[]}
 */
export function splitGlucoseList(rest) {
  var s = String(rest || '')
    .replace(/\s*MG\s*\/?\s*DL\s*$/i, '')
    .trim();
  if (!s) return [];
  var tokens = [];
  var buf = '';
  var depth = 0;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === '(') {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      if (buf.trim()) tokens.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) tokens.push(buf.trim());
  return tokens;
}

/** @deprecated use parseIoEgresoLine */
export function parseIoEgresoFromText(raw) {
  var parts = parseIoEgresoLine(raw);
  return diuresisValueFromParts(parts);
}

/**
 * @param {string} line
 * @returns {{ temp?: number, time?: string } | null}
 */
function parseTempLine(line) {
  var m = line.match(
    /^(?:T[°º]?\s*:?|TEMP(?:ERATURA)?\s*:?)\s*([\d.,]+)\s*(?:°\s*C|°C)?(?:\s*(?:@|\s|-|a\s+las?\s+)?\s*(\d{1,2}:\d{2}))?/i
  );
  if (!m) return null;
  var temp = parseNumberToken(m[1]);
  if (temp == null) return null;
  /** @type {{ temp: number, time?: string }} */
  var out = { temp: temp };
  if (m[2]) {
    var p = m[2].split(':');
    out.time = pad2(p[0]) + ':' + pad2(p[1]);
  }
  return out;
}

/**
 * @param {string} text
 * @param {{ vitals: Record<string, number | null>, alteredAt: Record<string, string>, glucometrias: Array<{ value: number, time?: string }>, io: { ing: number | null, egr: number | string | null, egrParts: import('./estado-actual-io.mjs').IoEgresoPart[], evac: number | string | null }, recognized: string[], warnings: string[] }} result
 */
function parseVitalLine(trimmed, result) {
  var temp = parseTempLine(trimmed);
  if (temp) {
    result.vitals.temp = temp.temp;
    if (temp.time) result.alteredAt.temp = temp.time;
    result.recognized.push('temp');
    return true;
  }

  var fc = trimmed.match(/^(?:FC|F\.?\s*C\.?)\s*:?\s*([\d.,]+)/i);
  if (fc) {
    result.vitals.fc = parseNumberToken(stripVitalUnitSuffix(fc[1]));
    result.recognized.push('fc');
    return true;
  }

  var fr = trimmed.match(/^(?:FR|F\.?\s*R\.?)\s*:?\s*([\d.,]+)/i);
  if (fr) {
    result.vitals.fr = parseNumberToken(stripVitalUnitSuffix(fr[1]));
    result.recognized.push('fr');
    return true;
  }

  var sat = parseSatLineVariants(trimmed);
  if (sat != null) {
    result.vitals.sat = sat.value;
    if (sat.soporteHint) result.soporteHint = sat.soporteHint;
    result.recognized.push('sat');
    return true;
  }

  var ta = trimmed.match(/^(?:TA|T\.?\s*A\.?)\s*:?\s*([\d.,]+)\s*\/\s*([\d.,]+)/i);
  if (ta) {
    result.vitals.tas = parseNumberToken(ta[1]);
    result.vitals.tad = parseNumberToken(ta[2]);
    result.recognized.push('ta');
    return true;
  }
  return false;
}

function parseDxtLine(trimmed, result) {
  var dxt = trimmed.match(/^(?:DXT|DESTROX(?:IAS)?|GLUCOMETR(?:ÍA|IA)?(?:S)?)\s*:?\s*(.+)$/i);
  if (!dxt) return false;
  var tokens = splitGlucoseList(dxt[1]);
  for (var i = 0; i < tokens.length; i++) {
    var g = parseGlucometriaToken(tokens[i]);
    if (g) result.glucometrias.push(g);
  }
  if (tokens.length && !result.glucometrias.length) {
    result.warnings.push('No se pudieron leer valores DXT en: ' + dxt[1]);
  } else {
    result.recognized.push('dxt');
  }
  return true;
}

function parseIoLine(trimmed, result) {
  var ing = trimmed.match(/^(?:I|ING(?:RESOS)?)\s*:?\s*(.+)$/i);
  if (ing) {
    result.io.ing = parseIoIngresoField(ing[1]);
    result.recognized.push('ing');
    return true;
  }

  var evac = trimmed.match(/^(?:EVAC|EVACUAC(?:IONES)?)\s*:?\s*(.+)$/i);
  if (evac) {
    result.io.evac = parseIoEvacField(evac[1]);
    result.recognized.push('evac');
    return true;
  }

  var egr = trimmed.match(/^(?:E(?!VAC)|EGR(?:ESOS)?)\s*:?\s*(.+)$/i);
  if (egr) {
    var egrBody = String(egr[1]).trim();
    if (/^(?:NC|NO\s+CUANTIFICADA)$/i.test(egrBody)) {
      result.io.egrParts = [{ kind: 'diuresis', label: 'DIURESIS', value: 'NC' }];
    } else {
      result.io.egrParts = parseIoEgresoLine(egrBody);
    }
    result.io.egr = diuresisValueFromParts(result.io.egrParts);
    result.recognized.push('egr');
    return true;
  }

  var bal = trimmed.match(/^(?:B|BAL(?:ANCE)?)\s*:?\s*(.+)$/i);
  if (bal) {
    result.recognized.push('balance-ignored');
    return true;
  }
  return false;
}

function parseLine(line, result) {
  var trimmed = String(line || '').trim();
  if (!trimmed) return;
  if (parseVitalLine(trimmed, result)) return;
  if (parseDxtLine(trimmed, result)) return;
  if (parseIoLine(trimmed, result)) return;
  result.warnings.push('Línea no reconocida: ' + trimmed);
}

/**
 * @param {string} text
 */
function scanInlineTemp(text, result) {
  if (result.recognized.indexOf('temp') >= 0) return;
  var t = text.match(/(?:T[°º]?\s*:?|TEMP(?:ERATURA)?\s*:?)\s*([\d.,]+)/i);
  if (!t) return;
  result.vitals.temp = parseNumberToken(t[1]);
  result.recognized.push('temp');
}

function scanInlineFc(text, result) {
  if (result.recognized.indexOf('fc') >= 0) return;
  var fc = text.match(/\bFC\s*:?\s*([\d.,]+)/i);
  if (!fc) return;
  result.vitals.fc = parseNumberToken(fc[1]);
  result.recognized.push('fc');
}

function scanInlineFr(text, result) {
  if (result.recognized.indexOf('fr') >= 0) return;
  var fr = text.match(/\bFR\s*:?\s*([\d.,]+)/i);
  if (!fr) return;
  result.vitals.fr = parseNumberToken(fr[1]);
  result.recognized.push('fr');
}

function scanInlineSat(text, result) {
  if (result.recognized.indexOf('sat') >= 0) return;
  var satM = text.match(
    /^(?:SATURACI(?:O|Ó)N(?:\s+O2)?|SAT(?:O2)?|SPO2)\s*:?\s*([\d.,]+)\s*%?\s*(.*)$/im
  );
  if (!satM) return;
  var satInline = parseSatLineVariants(satM[0]);
  if (!satInline) return;
  result.vitals.sat = satInline.value;
  if (satInline.soporteHint) result.soporteHint = satInline.soporteHint;
  result.recognized.push('sat');
}

function scanInlineTa(text, result) {
  if (result.recognized.indexOf('ta') >= 0) return;
  var ta = text.match(/\bTA\s*:?\s*([\d.,]+)\s*\/\s*([\d.,]+)/i);
  if (!ta) return;
  result.vitals.tas = parseNumberToken(ta[1]);
  result.vitals.tad = parseNumberToken(ta[2]);
  result.recognized.push('ta');
}

function scanInlineDxt(text, result) {
  if (result.recognized.indexOf('dxt') >= 0) return;
  var dxt = text.match(/\b(?:DXT|DESTROX(?:IAS)?)\s*:?\s*([^|\n]+?)(?:\s*(?:\||$)|\s+I\s*:|\s+E\s*:)/i);
  if (!dxt) dxt = text.match(/\b(?:DXT|DESTROX(?:IAS)?)\s*:?\s*(.+)$/im);
  if (!dxt) return;
  var tokens = splitGlucoseList(dxt[1]);
  for (var i = 0; i < tokens.length; i++) {
    var g = parseGlucometriaToken(tokens[i]);
    if (g) result.glucometrias.push(g);
  }
  if (result.glucometrias.length) result.recognized.push('dxt');
}

function scanInlineIng(text, result) {
  if (result.recognized.indexOf('ing') >= 0) return;
  var ing = text.match(/\bI\s*:?\s*([\d.,]+)/i);
  if (!ing) return;
  result.io.ing = parseIoIngresoField(ing[1]);
  result.recognized.push('ing');
}

function scanInlineEgr(text, result) {
  if (result.recognized.indexOf('egr') >= 0) return;
  var egr = text.match(/\bE\s*:?\s*(.+?)(?:\s*$)/im);
  if (!egr) return;
  result.io.egrParts = parseIoEgresoLine(egr[1]);
  result.io.egr = diuresisValueFromParts(result.io.egrParts);
  result.recognized.push('egr');
}

function scanInlineEvac(text, result) {
  if (result.recognized.indexOf('evac') >= 0) return;
  var evac = text.match(/\bEVAC(?:UAC(?:IONES)?)?\s*:?\s*(.+?)(?:\s*$)/im);
  if (!evac) return;
  result.io.evac = parseIoEvacField(evac[1]);
  result.recognized.push('evac');
}

function scanInlinePatterns(text, result) {
  scanInlineTemp(text, result);
  scanInlineFc(text, result);
  scanInlineFr(text, result);
  scanInlineSat(text, result);
  scanInlineTa(text, result);
  scanInlineDxt(text, result);
  scanInlineIng(text, result);
  scanInlineEgr(text, result);
  scanInlineEvac(text, result);
}

/**
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean,
 *   vitals: Record<string, number | null>,
 *   alteredAt: Record<string, string>,
 *   glucometrias: Array<{ value: number, time?: string }>,
 *   io: { ing: number | null, egr: number | string | null, egrParts: import('./estado-actual-io.mjs').IoEgresoPart[], evac: number | string | null },
 *   recognized: string[],
 *   warnings: string[],
 *   soporteHint?: string | null,
 *   error?: string
 * }}
 */
export function parseEstadoActualPaste(raw) {
  var text = String(raw == null ? '' : raw).trim();
  /** @type {Record<string, number | null>} */
  var vitals = {
    tas: null,
    tad: null,
    fc: null,
    fr: null,
    temp: null,
    sat: null,
  };
  /** @type {Record<string, string>} */
  var alteredAt = {};
  /** @type {Array<{ value: number, time?: string }>} */
  var glucometrias = [];
  /** @type {{ ing: number | null, egr: number | string | null, egrParts: import('./estado-actual-io.mjs').IoEgresoPart[], evac: number | string | null }} */
  var io = { ing: null, egr: null, egrParts: [], evac: null };
  /** @type {string[]} */
  var recognized = [];
  /** @type {string[]} */
  var warnings = [];

  if (!text) {
    return {
      ok: false,
      error: 'Pega el texto de monitoreo',
      vitals: vitals,
      alteredAt: alteredAt,
      glucometrias: glucometrias,
      io: io,
      recognized: recognized,
      warnings: warnings,
    };
  }

  var result = {
    ok: true,
    vitals: vitals,
    alteredAt: alteredAt,
    glucometrias: glucometrias,
    io: io,
    recognized: recognized,
    warnings: warnings,
    soporteHint: null,
  };

  var lines = text.split(/\r?\n/).map(function (l) {
    return l.trim();
  });
  var nonEmpty = lines.filter(Boolean);
  if (!nonEmpty.length) nonEmpty = [text];

  for (var i = 0; i < nonEmpty.length; i++) {
    parseLine(nonEmpty[i], result);
  }

  if (!result.recognized.length) {
    scanInlinePatterns(text, result);
  }

  var hasData =
    result.recognized.length > 0 ||
    Object.keys(result.vitals).some(function (k) {
      return result.vitals[k] != null;
    }) ||
    result.glucometrias.length > 0 ||
    result.io.ing != null ||
    result.io.egr != null ||
    (result.io.egrParts && result.io.egrParts.length > 0) ||
    result.io.evac != null;

  if (!hasData) {
    result.ok = false;
    result.error = 'No se reconoció ningún campo (T°, FC, TA, DXT, I, E…)';
  }

  return result;
}

/**
 * Resumen legible para vista previa del modal.
 * @param {ReturnType<typeof parseEstadoActualPaste>} parsed
 * @returns {string}
 */
function formatPreviewVitals(parsed, parts) {
  if (parsed.vitals.temp != null) {
    parts.push('TEMP ' + parsed.vitals.temp + ' °C' + (parsed.alteredAt.temp ? ' @ ' + parsed.alteredAt.temp : ''));
  }
  if (parsed.vitals.fc != null) parts.push('FC ' + parsed.vitals.fc + ' LPM');
  if (parsed.vitals.fr != null) parts.push('FR ' + parsed.vitals.fr + ' RPM');
  if (parsed.vitals.sat != null) {
    var satLine = 'SATURACION ' + parsed.vitals.sat + '%';
    if (parsed.soporteHint) satLine += ' ' + toEaSalidaText(parsed.soporteHint);
    parts.push(satLine);
  }
  if (parsed.vitals.tas != null || parsed.vitals.tad != null) {
    parts.push('TA ' + (parsed.vitals.tas ?? '—') + '/' + (parsed.vitals.tad ?? '—') + ' MMHG');
  }
}

function formatPreviewIo(parsed, parts) {
  if (parsed.glucometrias.length) {
    parts.push(
      'DXT ' +
        parsed.glucometrias
          .map(function (g) {
            return String(g.value) + (g.time ? '@' + g.time : '');
          })
          .join(', ') +
        ' MG/DL'
    );
  }
  if (parsed.io.ing != null) parts.push('I ' + parsed.io.ing + ' CC');
  if (parsed.io.egrParts && parsed.io.egrParts.length) {
    parts.push('E ' + serializeEgrPartsToFormText(parsed.io.egrParts));
  } else if (parsed.io.egr != null) {
    parts.push('E ' + toEaSalidaText(parsed.io.egr));
  }
  if (parsed.io.evac != null) parts.push('EVAC ' + toEaSalidaText(parsed.io.evac));
}

export function formatEstadoActualParsePreview(parsed) {
  if (!parsed || !parsed.ok) {
    return toEaSalidaText(parsed && parsed.error ? parsed.error : 'Sin datos');
  }
  var parts = [];
  formatPreviewVitals(parsed, parts);
  formatPreviewIo(parsed, parts);
  if (parsed.recognized.indexOf('balance-ignored') >= 0) {
    parts.push('B (CALCULADO AL APLICAR)');
  }
  if (parsed.warnings.length) {
    parts.push('AVISOS: ' + parsed.warnings.join('; '));
  }
  return toEaSalidaText(parts.length ? parts.join(' · ') : 'Sin campos detectados');
}
