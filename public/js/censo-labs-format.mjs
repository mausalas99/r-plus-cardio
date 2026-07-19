import { sortLabHistoryChronological } from './tend-core.mjs';
import { formatLabsForCensoCompactBody } from './censo-labs-format-compact.mjs';
import { linesFromParsedBySectionFull } from './censo-labs-format-lines.mjs';

function linesFromRawChunk(chunk) {
  var s = String(chunk || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return [s];
}

/**
 * @param {unknown[]} sets
 * @param {number} [maxDates]
 * @returns {string[]}
 */
export function formatLabsForCenso(sets, maxDates) {
  maxDates = maxDates == null ? 2 : maxDates;
  var sorted = sortLabHistoryChronological(sets || []).slice(0, maxDates);
  if (!sorted.length) return [];

  var out = [];
  sorted.forEach(function (set) {
    var fecha =
      set.fecha && set.fecha !== 'Anterior' ? String(set.fecha).trim() : 'Sin fecha';
    var pb = set.parsedBySection || set.parsed || null;
    var blockLines = [];

    if (pb && typeof pb === 'object' && !Array.isArray(pb)) {
      linesFromParsedBySectionFull(pb).forEach(function (ln) {
        blockLines.push(ln);
      });
    }

    if (!blockLines.length) {
      var chunks = (set.resLabs || [])
        .map(function (c) {
          return String(c || '').replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean)
        .slice(0, 2);
      chunks.forEach(function (chunk) {
        linesFromRawChunk(chunk).forEach(function (ln) {
          blockLines.push(ln);
        });
      });
    }

    if (!blockLines.length) return;
    out.push(fecha);
    blockLines.forEach(function (ln) {
      out.push('  ' + ln);
    });
  });

  return out;
}

/**
 * Laboratorios del día más reciente: texto completo (sin resumen ni truncado).
 * @param {unknown[]} sets
 * @returns {string[]}
 */
export function formatLabsForCensoCompact(sets) {
  return formatLabsForCensoCompactBody(sets);
}
