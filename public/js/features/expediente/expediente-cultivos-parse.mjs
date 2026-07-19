// Cultivo block parsing, copy, lab output fragments
import { labHistory } from '../../app-state.mjs';
import { parseFechaLabToMs, normalizeFechaLabHistory } from '../../tend-core.mjs';
import {
  renderEntry,
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
  formatCultivoCondensedForCopy,
  isParsedCultivoHeaderLine,
  parseCuentaFromCultivoChunkLines,
} from '../../labs.js';
import { rt, aid } from './expediente-runtime.mjs';

var CULTIVO_TIPO_LABELS = {
  hemo: 'Hemocultivo',
  uro: 'Urocultivo',
  cateter: 'Cultivo de catéter',
  gram: 'Tinción Gram',
  fungi: 'Fungicultivo',
  otro: 'Otros cultivos',
};

function isCultureTableHeaderLine(t) {
  return isParsedCultivoHeaderLine(t);
}

/** Clave estable desde la línea cabecera del bloque (UROCULTIVO / HEMOCULTIVO / …). */
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
    /NEGATIVO|NO HAY CRECIMIENTO|SIN AISLAMIENTO|AUSENCIA(\s+DE)?\s+CRECIMIENTO|NO SE AISL|ESCASA FLORA|CONTAMINACI(O|Ó)N|SIN CRECIMIENTO/i.test(L)
  );
}

/**
 * Una fila de tabla = primera línea cabecera (sitio/fecha:germen) + resto (ATB, cuenta…).
 */
function parseCultureHeaderFields(rawHeader, set) {
  var line = String(rawHeader || '').replace(/\s+/g, ' ').trim();
  var colon = line.indexOf(':');
  var left = colon >= 0 ? line.slice(0, colon).trim() : line;
  var right = colon >= 0 ? line.slice(colon + 1).trim() : '';
  var fechaMuestra = '';
  var sitio = left;
  var dm = left.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*$/);
  if (dm) {
    fechaMuestra = completePartialFechaForCultivo(dm[1], set);
    sitio = left.slice(0, dm.index).trim() || left.replace(/\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*$/, '').trim();
  }
  return { line, left, right, fechaMuestra, sitio };
}

function resolveCultureOrganismo(left, right) {
  var organismo = right.replace(/\s+/g, ' ').trim();
  var negativo = cultureBlockLooksNegative(left, right);
  if (negativo && !organismo) organismo = 'Negativo';
  else if (negativo && /^NEGATIVO$/i.test(organismo)) organismo = 'Negativo';
  else if (!organismo) organismo = '—';
  return { organismo, negativo };
}

function buildCultureRowObject(set, seq, tipoKey, studyDate, sortMs, header, org, cuenta, resStr) {
  var sortKeyMs = sortMs;
  if (header.fechaMuestra) {
    var fmNorm = normalizeFechaLabHistory(header.fechaMuestra) || header.fechaMuestra;
    var fmParsed = parseFechaLabToMs(fmNorm, '');
    if (typeof fmParsed === 'number' && isFinite(fmParsed)) sortKeyMs = fmParsed;
  }
  return {
    row: {
      studyDate: studyDate,
      fechaMuestra: header.fechaMuestra || '—',
      sitio: header.sitio || '—',
      organismo: org.organismo,
      cuenta: cuenta || '',
      resistencias: resStr || (org.negativo ? '—' : ''),
      negativo: org.negativo,
      sortMs: sortMs,
      sortKeyMs: sortKeyMs,
      tipoKey: tipoKey,
      tipoLabel: CULTIVO_TIPO_LABELS[tipoKey] || CULTIVO_TIPO_LABELS.otro,
      labSetId: set && set.id != null ? set.id : '',
      _seq: typeof seq === 'number' ? seq : 0,
    },
  };
}

function parseCultureBlockFromLineArray(lines, set, seq) {
  var rawHeader = String(lines[0] || '');
  var tipoKey = classifyCultureTipoKeyFromHeaderLine(rawHeader);
  var studyDate = rt.buildLabSetDateLine(set) || '—';
  var sortMs = parseFechaLabToMs(set.fecha, set.hora);
  if (typeof sortMs !== 'number' || !isFinite(sortMs)) sortMs = 0;
  var header = parseCultureHeaderFields(rawHeader, set);
  var org = resolveCultureOrganismo(header.left, header.right);
  var bodyLines = lines.slice(1);
  var cuenta = parseCuentaFromCultivoChunkLines(bodyLines);
  var resStr = bodyLines
    .filter(function (ln) {
      return !/^Cuenta:/i.test(String(ln || '').trim());
    })
    .join('\n')
    .trim();
  return buildCultureRowObject(set, seq, tipoKey, studyDate, sortMs, header, org, cuenta, resStr);
}

function cultivoChunkMatchesQuery(gq, q) {
  if (gq === q || gq.indexOf(q) !== -1 || q.indexOf(gq) !== -1) return true;
  var gTok = gq.split(/\s+/).filter(Boolean)[0] || '';
  var qTok = q.split(/\s+/).filter(Boolean)[0] || '';
  return (
    gTok.length > 3 &&
    qTok.length > 3 &&
    (gTok === qTok || gq.indexOf(qTok) === 0 || q.indexOf(gTok) === 0)
  );
}

function findCultivoChunkInSet(set, organismoQuery) {
  if (!set || !set.resLabs) return null;
  var q = String(organismoQuery || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (!q || q === '—') return null;
  var cult = rt.splitResLabsByTipo(set.resLabs).cultivo;
  for (var ei = 0; ei < cult.length; ei++) {
    var chunks = String(cult[ei] || '')
      .split(/\n\n+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    for (var ci = 0; ci < chunks.length; ci++) {
      var head = chunks[ci].split(/\n/)[0] || '';
      var gq = germQueryFromCultivoChunkHead(head)
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      if (!gq) continue;
      if (cultivoChunkMatchesQuery(gq, q)) return chunks[ci];
    }
  }
  return null;
}

function copyCultivoCondensado(setId, organismo) {
  var pid = aid();
  if (!pid) {
    rt.showToast('Selecciona un paciente', 'error');
    return;
  }
  var sets = labHistory[pid] || [];
  var set = sets.find(function (s) {
    return String(s.id) === String(setId);
  });
  if (!set) {
    rt.showToast('No se encontró el envío en historial', 'error');
    return;
  }
  var chunk = findCultivoChunkInSet(set, organismo);
  if (!chunk) {
    rt.showToast('No hay resumen de cultivo procesado para copiar', 'error');
    return;
  }
  var t = formatCultivoCondensedForCopy(chunk, rt.buildLabSetDateLine(set) || '');
  if (!t.trim()) {
    rt.showToast('No hay texto para copiar', 'error');
    return;
  }
  var p =
    navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(t)
      : Promise.reject(new Error('no clipboard'));
  p.then(
    function () {
      rt.showToast('Cultivo condensado copiado', 'success');
    },
    function () {
      rt.showToast('No se pudo copiar al portapapeles', 'error');
    }
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

function isResLabChunkPureCultivo(text) {
  var sp = rt.splitResLabsByTipo([text]);
  if (sp.labs.length) return false;
  return sp.cultivo.some(function (r) {
    return String(r || '').trim();
  });
}

function buildCultivoOutputHtmlFragments(text, sourceText) {
  var raw = String(text || '');
  var chunks = raw
    .split(/\n\n+/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (!chunks.length) return '';
  var parts = [];
  chunks.forEach(function (chunk) {
    var lines = chunk.split(/\n/);
    var germQuery = germQueryFromCultivoChunkHead(lines[0] || '');
    var sens = sourceText ? extractSensCrudasForGermFromSource(sourceText, germQuery) : null;
    lines.forEach(function (lineRaw) {
      var t = String(lineRaw || '').trim();
      if (/^ATB\b/i.test(t) && sens && sens.length) {
        parts.push(
          '<div class="out-line cultivos-atb-chips lab-out-atb">' + buildAtbRisSummaryHtml(sens) + '</div>'
        );
        return;
      }
      renderEntry(lineRaw).forEach(function (html, idx) {
        parts.push('<div class="' + (idx === 0 ? 'out-line' : 'out-indent') + '">' + html + '</div>');
      });
    });
  });
  return parts.join('');
}

export {
  copyCultivoCondensado,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
  parseCultureBlockFromLineArray,
  isCultureTableHeaderLine,
};
