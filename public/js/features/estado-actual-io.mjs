/**
 * Ingresos/egresos/evacuaciones — parseo, balance (suma de salidas numéricas) y texto SOAP.
 */

/**
 * Texto visible al usuario (vista previa, SOAP, balance en vivo): siempre mayúsculas.
 * @param {unknown} raw
 * @returns {string}
 */
export function toEaSalidaText(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).toUpperCase();
}

/**
 * @param {number} bal
 * @returns {string}
 */
export function formatBalanceLive(bal) {
  if (!Number.isFinite(bal)) return '—';
  return (bal > 0 ? '+' : '') + bal + ' CC';
}

/**
 * @param {unknown} io
 * @returns {boolean}
 */
export function hasIoEgressDeclared(io) {
  if (!io || typeof io !== 'object') return false;
  /** @type {any} */
  var o = io;
  if (Array.isArray(o.egrParts) && o.egrParts.length) return true;
  return o.egr != null && String(o.egr).trim() !== '';
}

/**
 * @param {unknown} io
 * @returns {boolean}
 */
export function isIoIngresoNc(io) {
  if (!io || typeof io !== 'object') return false;
  /** @type {any} */
  var o = io;
  return o.ing === 'NC' || String(o.ing || '').toUpperCase() === 'NC';
}

/**
 * Egresos declarados sin total numérico (p. ej. solo DIURESIS NC), o ingresos NC.
 * @param {unknown} io
 * @returns {boolean}
 */
export function isIoBalanceNc(io) {
  if (isIoIngresoNc(io)) return true;
  return hasIoEgressDeclared(io) && ioNumericEgressTotal(io) == null;
}

/**
 * @param {unknown} ing
 * @param {unknown} io
 * @returns {string}
 */
export function formatIoBalanceDisplay(ing, io) {
  io = io || {};
  if (isIoIngresoNc(io) || ing === 'NC' || String(ing || '').toUpperCase() === 'NC') return 'NC';
  var bal = computeIoBalanceFromIngEgr(ing, io);
  if (Number.isFinite(bal)) return formatBalanceLive(bal);
  if (isIoBalanceNc(io)) return 'NC';
  return '—';
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseIoIngresoField(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (/^nc$/i.test(s) || /no\s+cuantificad/i.test(s)) return 'NC';
  var numMatch = s.match(/([\d.,]+)\s*(?:CC|ML)?\b/i);
  if (numMatch) {
    var n = parseIoNumber(numMatch[1]);
    if (n != null) return n;
  }
  return parseIoNumber(s);
}

export function parseIoNumber(raw) {
  if (raw == null) return null;
  var s = String(raw).trim().replace(/\s/g, '').replace(/,/g, '');
  if (!s) return null;
  var n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isIoNumericValue(v) {
  if (v == null || v === '') return false;
  if (v === 'NC' || String(v).toUpperCase() === 'NC') return false;
  var n = Number(v);
  return Number.isFinite(n);
}

/**
 * @param {unknown} raw
 * @returns {number | string | null}
 */
/**
 * @param {unknown} val
 * @returns {number | string | null}
 */
export function normalizeEvacAbbrev(val) {
  if (val == null || val === '') return val;
  var s = String(val).trim();
  if (/^nc$/i.test(s)) return 'NC';
  if (/no\s+reportad|sin\s+evacuacion|sin\s+evac\b|no\s+hubo\s+evac/i.test(s)) return 'NC';
  return val;
}

export function parseIoEvacField(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  var abbrev = normalizeEvacAbbrev(s);
  if (abbrev === 'NC') return 'NC';
  if (/sin\s+evacuaciones/i.test(s)) return toEaSalidaText(s);
  var numMatch = s.match(/([\d.,]+)\s*(?:CC|ML)?\b/i);
  if (numMatch) {
    var n = parseIoNumber(numMatch[1]);
    if (n != null) return n;
  }
  var n2 = parseIoNumber(s);
  if (n2 != null) return n2;
  return s.toUpperCase();
}

/**
 * NC o «no cuantificada» → siempre «NC» en datos y salida.
 * @param {unknown} val
 * @returns {unknown}
 */
export function normalizeIoNcAbbrev(val) {
  if (val == null || val === '') return val;
  if (val === 'NC' || String(val).toUpperCase() === 'NC') return 'NC';
  if (typeof val === 'string' && /no\s+cuantificad/i.test(val)) return 'NC';
  return val;
}

/**
 * @param {string} seg
 * @returns {number | string}
 */
function parseSegmentValue(seg) {
  var s = String(seg || '').trim();
  if (/^nc$/i.test(s)) return 'NC';
  if (/no\s+cuantificad/i.test(s)) return 'NC';
  var numMatch = s.match(/([\d.,]+)\s*(?:CC|ML)?\b/i);
  if (numMatch) {
    var n = parseIoNumber(numMatch[1]);
    if (n != null) return n;
  }
  var n2 = parseIoNumber(s);
  if (n2 != null) return n2;
  return s.toUpperCase();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function splitIoSegments(text) {
  var s = String(text || '').trim();
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
    if ((ch === ',' || ch === ';') && depth === 0) {
      if (buf.trim()) tokens.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) tokens.push(buf.trim());
  return tokens;
}

/**
 * @typedef {{ kind: 'diuresis' | 'drain' | 'gastrostomy' | 'nephro', label: string, value: number | string }} IoEgresoPart
 */

/** @returns {IoEgresoPart} */
function ncDiuresisPart() {
  return { kind: 'diuresis', label: 'DIURESIS', value: 'NC' };
}

/** @param {string} s @returns {IoEgresoPart} */
function classifyDiuresisSegment(s) {
  var rest = s.replace(/^(?:DIURESIS|ORINA)\s*/i, '').trim();
  var value =
    !rest || /no\s+cuantificad/i.test(rest) ? (rest ? parseSegmentValue(rest) : 'NC') : parseSegmentValue(rest);
  return { kind: 'diuresis', label: 'DIURESIS', value: value };
}

/** @param {string} s @returns {IoEgresoPart} */
function classifyDrainSegment(s) {
  var dRest = s.replace(/^DRENAJ(?:E|ES)?\s*/i, '').trim();
  return { kind: 'drain', label: 'DRENAJE', value: parseSegmentValue(dRest || s) };
}

/** @param {string} s @returns {IoEgresoPart} */
function classifyGastrostomySegment(s) {
  var gRest = s.replace(/^GASTROSTOM(?:ÍA|IA)?\s*/i, '').trim();
  return { kind: 'gastrostomy', label: 'GASTROSTOMÍA', value: parseSegmentValue(gRest || s) };
}

/** @param {string} s @param {string} u @returns {IoEgresoPart} */
function classifyNephroSegment(s, u) {
  var side = '';
  if (/IZQ|IZQUIERDA/i.test(u)) side = 'IZQUIERDA';
  else if (/\bDER\b|DERECHA/i.test(u)) side = 'DERECHA';
  var nRest = s.replace(/^NEFRO(?:STOM(?:ÍA|IA))?/i, '').trim();
  nRest = nRest.replace(/\b(IZQ|IZQUIERDA|DER|DERECHA)\b/gi, '').trim();
  var label = side ? 'NEFROSTOMÍA ' + side : 'NEFROSTOMÍA';
  return { kind: 'nephro', label: label, value: parseSegmentValue(nRest || s) };
}

/** @param {string} s @param {string} u @returns {IoEgresoPart} */
function classifyFallbackDiuresisSegment(s, u) {
  var n = parseIoNumber(s);
  if (n != null) return { kind: 'diuresis', label: 'DIURESIS', value: n };
  if (/no\s+cuantificad/i.test(s)) return ncDiuresisPart();
  return { kind: 'diuresis', label: 'DIURESIS', value: u };
}

/**
 * @param {string} seg
 * @returns {IoEgresoPart}
 */
function classifyEgresoSegment(seg) {
  var s = String(seg || '').trim();
  var u = s.toUpperCase();
  if (/^NC$/i.test(s) || /^no\s+cuantificad/i.test(s)) return ncDiuresisPart();
  if (/^DIURESIS\b/i.test(s) || /^ORINA\b/i.test(s)) return classifyDiuresisSegment(s);
  if (/DRENAJ/i.test(u)) return classifyDrainSegment(s);
  if (/GASTROSTOM/i.test(u)) return classifyGastrostomySegment(s);
  if (/NEFRO/i.test(u)) return classifyNephroSegment(s, u);
  return classifyFallbackDiuresisSegment(s, u);
}

/**
 * @param {unknown} raw
 * @returns {IoEgresoPart[]}
 */
export function parseIoEgresoLine(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return [];
  var segments = splitIoSegments(s);
  if (!segments.length) segments = [s];
  return segments.map(classifyEgresoSegment);
}

/**
 * @param {IoEgresoPart[]} parts
 * @returns {number | string | null}
 */
export function diuresisValueFromParts(parts) {
  if (!Array.isArray(parts)) return null;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p && p.kind === 'diuresis') return p.value;
  }
  return null;
}

/**
 * @param {IoEgresoPart[]} parts
 * @returns {number}
 */
export function sumNumericEgressFromParts(parts) {
  if (!Array.isArray(parts)) return 0;
  var sum = 0;
  var any = false;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    if (isIoNumericValue(p.value)) {
      sum += Number(p.value);
      any = true;
    }
  }
  return any ? sum : 0;
}

/**
 * @param {unknown} io
 * @returns {number | null} Total cc de egresos numéricos (diuresis + drenajes + gastrostomía + nefros)
 */
export function ioNumericEgressTotal(io) {
  if (!io || typeof io !== 'object') return null;
  /** @type {any} */
  var o = io;
  if (Array.isArray(o.egrParts) && o.egrParts.length) {
    var sum = sumNumericEgressFromParts(o.egrParts);
    return sum > 0 ? sum : null;
  }
  if (isIoNumericValue(o.egr)) return Number(o.egr);
  return null;
}

/**
 * @param {unknown} io
 * @returns {number | string | null} Solo diuresis (legacy / campo egr)
 */
export function ioDiuresisForBalance(io) {
  if (!io || typeof io !== 'object') return null;
  /** @type {any} */
  var o = io;
  if (Array.isArray(o.egrParts) && o.egrParts.length) {
    return diuresisValueFromParts(o.egrParts);
  }
  return o.egr != null && o.egr !== '' ? o.egr : null;
}

/**
 * @param {unknown} ing
 * @param {unknown} io
 * @returns {number}
 */
export function computeIoBalanceFromIngEgr(ing, io) {
  if (!isIoNumericValue(ing)) return NaN;
  var egrTotal = ioNumericEgressTotal(io);
  if (egrTotal == null) return NaN;
  return Number(ing) - egrTotal;
}

/**
 * @param {IoEgresoPart} part
 * @returns {string}
 */
export function formatEgresoPartForText(part) {
  if (!part) return '';
  var val = normalizeIoNcAbbrev(part.value);
  var valStr =
    val === 'NC'
      ? 'NC'
      : isIoNumericValue(val)
        ? String(val) + ' CC'
        : String(val).toUpperCase();
  return part.label.toUpperCase() + ' ' + valStr;
}

/**
 * @param {IoEgresoPart[]} parts
 * @returns {string}
 */
export function serializeEgrPartsToFormText(parts) {
  if (!Array.isArray(parts) || !parts.length) return '';
  return parts.map(formatEgresoPartForText).join(', ');
}

/**
 * @param {unknown} egrLegacy
 * @returns {IoEgresoPart[]}
 */
export function legacyEgrToParts(egrLegacy) {
  if (egrLegacy == null || egrLegacy === '') return [];
  return parseIoEgresoLine(String(egrLegacy));
}

/**
 * @param {unknown} evac
 * @returns {string}
 */
export function formatEvacForText(evac) {
  if (evac == null || evac === '') return '___';
  var norm = normalizeEvacAbbrev(evac);
  if (norm === 'NC' || String(norm).toUpperCase() === 'NC') return 'NC';
  if (isIoNumericValue(evac)) return String(evac);
  return String(evac).toUpperCase();
}

/** @param {string[]} clauses @param {unknown} egr */
function appendLegacyEgrClause(clauses, egr) {
  var egrNorm = normalizeIoNcAbbrev(egr);
  if (isIoNumericValue(egrNorm)) clauses.push('DIURESIS ' + String(egrNorm) + ' CC');
  else if (egrNorm === 'NC') clauses.push('DIURESIS NC');
  else clauses.push(String(egrNorm).toUpperCase());
}

/** @param {string[]} clauses @param {{ egr?: unknown, egrParts?: IoEgresoPart[] }} io */
function appendEgressClauses(clauses, io) {
  var parts = Array.isArray(io.egrParts) && io.egrParts.length ? io.egrParts : legacyEgrToParts(io.egr);
  if (parts.length) {
    for (var i = 0; i < parts.length; i++) clauses.push(formatEgresoPartForText(parts[i]));
    return;
  }
  if (io.egr != null && io.egr !== '') appendLegacyEgrClause(clauses, io.egr);
  else clauses.push('DIURESIS ___');
}

/** @param {{ ing?: unknown, egr?: unknown, egrParts?: IoEgresoPart[] }} io @param {unknown} balanceTurno */
function resolveSoapBalanceNum(io, balanceTurno) {
  if (balanceTurno != null && balanceTurno !== '' && Number.isFinite(Number(balanceTurno))) {
    return Number(balanceTurno);
  }
  var fromIo = computeIoBalanceFromIngEgr(io.ing, io);
  return Number.isFinite(fromIo) ? fromIo : NaN;
}

/**
 * @param {{ ing?: unknown, egr?: unknown, egrParts?: IoEgresoPart[], evac?: unknown }} io
 * @param {unknown} balanceTurno
 * @returns {string}
 */
export function formatIoClauseForSoap(io, balanceTurno) {
  io = io || {};
  if (isIoIngresoNc(io)) {
    var ncClauses = ['INGRESOS NC', 'DIURESIS NC'];
    if (io.evac != null && io.evac !== '') ncClauses.push('EVACUACIONES ' + formatEvacForText(io.evac));
    ncClauses.push('BALANCE NC');
    return ncClauses.join(', ');
  }
  var clauses = ['INGRESOS ' + (io.ing != null && io.ing !== '' ? String(io.ing) : '___') + ' CC'];
  appendEgressClauses(clauses, io);
  if (io.evac != null && io.evac !== '') clauses.push('EVACUACIONES ' + formatEvacForText(io.evac));
  if (isIoBalanceNc(io)) {
    clauses.push('BALANCE NC');
    return clauses.join(', ');
  }
  var balNum = resolveSoapBalanceNum(io, balanceTurno);
  var balance = Number.isFinite(balNum) ? (balNum > 0 ? '+' : '') + balNum : '___';
  clauses.push('BALANCE ' + balance + ' CC');
  return clauses.join(', ');
}
