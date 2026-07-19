/**
 * Cultivos para censo: mismo texto que «Copiar informe completo» (formatCultivoCondensedForCopy).
 */
import {
  sortLabHistoryChronological,
  normalizeFechaLabHistory,
  normalizeHoraLabHistory,
} from './tend-core.mjs';
import { formatCultivoCondensedForCopy } from './labs.js';
import {
  splitResLabsByTipo as splitResLabsByTipoCore,
  isCultureTableHeaderLine,
  parseCultureBlockFromLineArray,
  findCultivoChunkInSet,
} from './cultivo-block-core.mjs';

export { splitResLabsByTipo } from './cultivo-block-core.mjs';

function buildLabSetDateLine(set) {
  if (!set) return '';
  var rawDate = normalizeFechaLabHistory(set.fecha) || String(set.fecha || '').trim();
  var rawHora = normalizeHoraLabHistory(set.hora);
  if (!rawDate) return '';
  return rawHora ? rawDate + ' ' + rawHora.slice(0, 5) : rawDate;
}

var CENSO_MAX_CULTIVO_REPORTS = 3;

function extractCultivoTableRowsFromLabHistory(history) {
  var rows = [];
  var seq = 0;
  sortLabHistoryChronological(history || []).forEach(function (set) {
    if (!set || !set.resLabs || !set.resLabs.length) return;
    var cult = splitResLabsByTipoCore(set.resLabs).cultivo;
    cult.forEach(function (chunk) {
      var sections = String(chunk || '')
        .split(/\n\n+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      sections.forEach(function (sec) {
        var lines = sec.split(/\r?\n/).map(function (l) {
          return l.replace(/\*+$/g, '').trim();
        }).filter(function (l) {
          return l;
        });
        if (!lines.length) return;
        if (!isCultureTableHeaderLine(lines[0])) return;
        rows.push(parseCultureBlockFromLineArray(lines, set, seq++).row);
      });
    });
  });
  return rows;
}

/** Mismo criterio que modo Pase / tabla de cultivos. */
function filterCultivoRowsSignificantFlip(rows) {
  function seriesKey(r) {
    return (
      (r.tipoKey || 'otro') +
      '\x01' +
      String(r.sitio || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  var bySeries = Object.create(null);
  rows.forEach(function (r) {
    var k = seriesKey(r);
    if (!bySeries[k]) bySeries[k] = [];
    bySeries[k].push(r);
  });
  var out = [];
  Object.keys(bySeries).forEach(function (k) {
    var arr = bySeries[k].slice().sort(function (a, b) {
      var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
      var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
      if (da !== db) return da - db;
      return (a._seq || 0) - (b._seq || 0);
    });
    for (var i = 0; i < arr.length; i++) {
      var r = arr[i];
      if (!r.negativo) {
        out.push(r);
        continue;
      }
      var prev = arr[i - 1];
      var next = arr[i + 1];
      if ((prev && !prev.negativo) || (next && !next.negativo)) out.push(r);
    }
  });
  return out;
}

/**
 * @param {unknown[]} labHistory
 * @param {number} [maxReports]
 * @returns {string}
 */
export function formatCultivosForCenso(labHistory, maxReports) {
  var max = maxReports != null ? maxReports : CENSO_MAX_CULTIVO_REPORTS;
  var flat = extractCultivoTableRowsFromLabHistory(labHistory);
  var display = filterCultivoRowsSignificantFlip(flat);
  display.sort(function (a, b) {
    var da = a.sortKeyMs != null ? a.sortKeyMs : a.sortMs || 0;
    var db = b.sortKeyMs != null ? b.sortKeyMs : b.sortMs || 0;
    if (db !== da) return db - da;
    return (b._seq || 0) - (a._seq || 0);
  });
  if (!display.length) return '';

  var setById = Object.create(null);
  (labHistory || []).forEach(function (set) {
    if (set && set.id != null) setById[String(set.id)] = set;
  });

  var blocks = [];
  for (var i = 0; i < display.length && blocks.length < max; i++) {
    var r = display[i];
    var set = setById[String(r.labSetId)];
    if (!set) continue;
    var chunk = findCultivoChunkInSet(set, r.organismo);
    if (!chunk) continue;
    var text = formatCultivoCondensedForCopy(chunk, buildLabSetDateLine(set) || '');
    if (text.trim()) blocks.push(text.trim());
  }
  return blocks.join('\n\n');
}
