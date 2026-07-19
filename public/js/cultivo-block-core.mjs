/**
 * Single implementation for cultivo block detection/parsing in lab historial.
 *
 * Superset everywhere; decided by maintainer 2026-06-12 (plan 011); was deferred from plan 007.
 *
 * isCultivoBlockStartLine: CULTIVO-family headers, ATB/Cuenta/bullet lines, "Cultivos" section,
 * isParsedCultivoHeaderLine (BACILOSCOPIA, MICOBACTERIAS, LIQUIDO, …), and ALL-CAPS site headers
 * (2–5 words, no tabs) via matchesAllCapsSiteHeader exclusion guards.
 *
 * isLabSectionHeaderLine: BH|QS|…|FROTIS|SEROL|HECES lab section boundaries.
 *
 * splitResLabsByTipo / findCultivoChunkInSet: shared loop and chunk lookup for all call sites.
 *
 * parseCultureBlockFromLineArray: censo table rows (expediente.mjs extended copy — out of scope).
 */
import { isParsedCultivoHeaderLine, parseCuentaFromCultivoChunkLines } from './labs.js';
import { parseFechaLabToMs, normalizeFechaLabHistory } from './tend-core.mjs';

var CULTIVO_BASE_START_PATTERNS = [
  /^CULTIVO\b/i,
  null,
  /^BACTERIOLOGIA\b/i,
  /^UROCULTIVO\b/i,
  /^HEMOCULTIVO\b/i,
  /^FUNGICULTIVO\b/i,
  /^TINCION\s+DE\s+GRAM/i,
  /^CATETER\b/i,
  /^ATB\b/i,
  /^Cuenta:/i,
  /^[•\u2022\u00B7]\s*/,
  /^Cultivos$/i,
];

var LAB_SECTION_BASE =
  /^(BH|QS|ESC|PFHs|GASES|PIE|LCR|EGO|CUANTORINA|PltCit|FROTIS|SEROL|HECES|LIPASA|TROP)\b/i;

function matchesAnyPattern(t, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (p === null) {
      if (isParsedCultivoHeaderLine(t)) return true;
    } else if (p.test(t)) {
      return true;
    }
  }
  return false;
}

function matchesAllCapsSiteHeader(t) {
  if (t.indexOf('\t') !== -1) return false;
  if (!/^[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,4}$/.test(t)) return false;
  var ws = t.split(/\s+/).filter(Boolean);
  if (ws.length < 2 || ws[0].length < 5 || ws[1].length < 3) return false;
  if (/^(INTERCONSULTA|SALA|SERVICIO|UNIDAD|PACIENTE|HOSPITAL|AREA|CONTROL|DEPARTAMENTO)/i.test(ws[0])) {
    return false;
  }
  if (/^(CARDIOLOGIA|CIRUGIA|URGENCIAS|INTERNA|MEDICINA|PEDIATRIA|NEFROLOGIA|HEMATOLOGIA)$/i.test(ws[1])) {
    return false;
  }
  return true;
}

/**
 * @param {string} s
 */
export function isCultivoBlockStartLine(s) {
  var t = String(s).trim();
  if (!t) return false;
  if (matchesAnyPattern(t, CULTIVO_BASE_START_PATTERNS)) return true;
  if (matchesAllCapsSiteHeader(t)) return true;
  return false;
}

/**
 * @param {string} s
 */
export function isLabSectionHeaderLine(s) {
  return LAB_SECTION_BASE.test(String(s).trim());
}

/**
 * @param {unknown[]} rows
 */
export function splitResLabsByTipo(rows) {
  var labs = [];
  var cultivo = [];
  var inCultivo = false;
  (rows || []).forEach(function (row) {
    var raw = row == null ? '' : row;
    var s = String(raw).trim();
    if (isLabSectionHeaderLine(s)) {
      inCultivo = false;
      labs.push(raw);
      return;
    }
    if (inCultivo) {
      cultivo.push(raw);
      return;
    }
    if (isCultivoBlockStartLine(s)) {
      inCultivo = true;
      cultivo.push(raw);
      return;
    }
    labs.push(raw);
  });
  return { labs: labs, cultivo: cultivo };
}

function classifyCultureTipoKeyFromHeaderLine(rawLine) {
  var s = String(rawLine || '').replace(/\s+/g, ' ').trim();
  var beforeColon = (s.split(':')[0] || s).toUpperCase();
  if (/^HEMOCULTIVO\b/.test(beforeColon)) return 'hemo';
  if (/^UROCULTIVO\b/.test(beforeColon)) return 'uro';
  if (/^FUNGICULTIVO\b/.test(beforeColon)) return 'fungi';
  if (/^TINCION(\s+DE)?\s+GRAM\b/.test(beforeColon)) return 'gram';
  if (/^CATETER\b/.test(beforeColon)) return 'cateter';
  return 'otro';
}

function completePartialFechaForCultivo(dm, set) {
  if (!dm) return '';
  var parts = String(dm).trim().split('/');
  if (parts.length === 3) {
    var y3 = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    var joined = parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + y3;
    return normalizeFechaLabHistory(joined) || joined;
  }
  if (parts.length !== 2) return dm;
  var y = new Date().getFullYear();
  if (set && set.fecha && set.fecha !== 'Anterior') {
    var fd = normalizeFechaLabHistory(set.fecha) || String(set.fecha);
    var ms = parseFechaLabToMs(fd, '');
    if (typeof ms === 'number' && isFinite(ms)) y = new Date(ms).getFullYear();
  }
  return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + y;
}

function cultureBlockLooksNegative(left, right) {
  var L = (left + ' ' + right).toUpperCase();
  if (!String(right || '').trim()) return true;
  return (
    /NEGATIVO|NO HAY CRECIMIENTO|SIN AISLAMIENTO|AUSENCIA(\s+DE)?\s+CRECIMIENTO|NO SE AISL|ESCASA FLORA|CONTAMINACI(O|Ó)N|SIN CRECIMIENTO/i.test(
      L
    )
  );
}

function germHintFromCultivoHeadLine(headLine) {
  var line = String(headLine || '').replace(/\s+/g, ' ').trim();
  var colon = line.lastIndexOf(':');
  if (colon >= 0) {
    var right = line.slice(colon + 1).trim();
    if (right) return right;
  }
  return line;
}

function germQueryFromCultivoChunkHead(headLine) {
  var h = germHintFromCultivoHeadLine(headLine);
  var base = h.split(/\s*·\s*/)[0].trim();
  return base || h;
}

export function isCultureTableHeaderLine(t) {
  return isParsedCultivoHeaderLine(t);
}

function parseCultureHeaderLeftRight(line) {
  var colon = line.indexOf(':');
  return {
    left: colon >= 0 ? line.slice(0, colon).trim() : line,
    right: colon >= 0 ? line.slice(colon + 1).trim() : '',
  };
}

function parseCultureSitioAndFecha(left, set) {
  var fechaMuestra = '';
  var sitio = left;
  var dm = left.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/);
  if (!dm) return { fechaMuestra: fechaMuestra, sitio: sitio };
  fechaMuestra = completePartialFechaForCultivo(dm[1], set);
  sitio =
    left.slice(0, dm.index).trim() ||
    left.replace(/\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, '').trim();
  return { fechaMuestra: fechaMuestra, sitio: sitio };
}

function resolveCultureOrganismo(left, right) {
  var organismo = right.replace(/\s+/g, ' ').trim();
  var negativo = cultureBlockLooksNegative(left, right);
  if (negativo && !organismo) organismo = 'Negativo';
  else if (negativo && /^NEGATIVO$/i.test(organismo)) organismo = 'Negativo';
  else if (!organismo) organismo = '—';
  return { organismo: organismo, negativo: negativo };
}

function cultureSortKeyMs(sortMs, fechaMuestra) {
  if (!fechaMuestra) return sortMs;
  var fmNorm = normalizeFechaLabHistory(fechaMuestra) || fechaMuestra;
  var fmParsed = parseFechaLabToMs(fmNorm, '');
  if (typeof fmParsed === 'number' && isFinite(fmParsed)) return fmParsed;
  return sortMs;
}

function cultureSetSortMs(set) {
  var sortMs = parseFechaLabToMs(set.fecha, set.hora);
  if (typeof sortMs === 'number' && isFinite(sortMs)) return sortMs;
  return 0;
}

/**
 * @param {string[]} lines
 * @param {object} set
 * @param {number} seq
 */
export function parseCultureBlockFromLineArray(lines, set, seq) {
  var rawHeader = String(lines[0] || '');
  var line = rawHeader.replace(/\s+/g, ' ').trim();
  var lr = parseCultureHeaderLeftRight(line);
  var sf = parseCultureSitioAndFecha(lr.left, set);
  var org = resolveCultureOrganismo(lr.left, lr.right);
  var sortMs = cultureSetSortMs(set);

  return {
    row: {
      fechaMuestra: sf.fechaMuestra || '—',
      sitio: sf.sitio || '—',
      organismo: org.organismo,
      cuenta: parseCuentaFromCultivoChunkLines(lines.slice(1)) || '',
      negativo: org.negativo,
      sortMs: sortMs,
      sortKeyMs: cultureSortKeyMs(sortMs, sf.fechaMuestra),
      tipoKey: classifyCultureTipoKeyFromHeaderLine(rawHeader),
      labSetId: set && set.id != null ? set.id : '',
      _seq: typeof seq === 'number' ? seq : 0,
    },
  };
}

function normalizeCultivoOrganismoQuery(organismoQuery) {
  return String(organismoQuery || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function cultivoChunkMatchesQuery(head, q) {
  var gq = germQueryFromCultivoChunkHead(head)
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!gq) return false;
  if (gq === q || gq.indexOf(q) !== -1 || q.indexOf(gq) !== -1) return true;
  var gTok = gq.split(/\s+/).filter(Boolean)[0] || '';
  var qTok = q.split(/\s+/).filter(Boolean)[0] || '';
  return (
    gTok.length > 3 &&
    qTok.length > 3 &&
    (gTok === qTok || gq.indexOf(qTok) === 0 || q.indexOf(gTok) === 0)
  );
}

function splitCultivoEntryChunks(entry) {
  return String(entry || '')
    .split(/\n\n+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/**
 * @param {object} set
 * @param {string} organismoQuery
 */
export function findCultivoChunkInSet(set, organismoQuery) {
  if (!set || !set.resLabs) return null;
  var q = normalizeCultivoOrganismoQuery(organismoQuery);
  if (!q || q === '—') return null;
  var cult = splitResLabsByTipo(set.resLabs).cultivo;
  for (var ei = 0; ei < cult.length; ei++) {
    var chunks = splitCultivoEntryChunks(cult[ei]);
    for (var ci = 0; ci < chunks.length; ci++) {
      var head = chunks[ci].split(/\n/)[0] || '';
      if (cultivoChunkMatchesQuery(head, q)) return chunks[ci];
    }
  }
  return null;
}
