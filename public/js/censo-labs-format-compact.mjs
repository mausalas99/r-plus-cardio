import { sortLabHistoryChronological } from './tend-core.mjs';
import { splitResLabsByTipo } from './censo-cultivo-format.mjs';
import { formatBhExtrasDisplayLine, isCitoquimInterpretacionResLabChunk } from './labs.js';
import { normalizeCensoPanelLine, reflowLabsForCensoDisplay } from './censo-table-style.mjs';
import { linesFromParsedBySectionFull, pushLabTextLines } from './censo-labs-format-lines.mjs';

function appendLabChunks(lines, set, sp) {
  var bhExtDone = false;
  sp.labs.forEach(function (chunk) {
    if (isCitoquimInterpretacionResLabChunk(chunk)) return;
    pushLabTextLines(lines, chunk);
    if (!bhExtDone && set.bhExtras && typeof set.bhExtras === 'object') {
      var ext = formatBhExtrasDisplayLine(set.bhExtras, set.sourceText);
      if (ext) {
        pushLabTextLines(lines, ext);
        bhExtDone = true;
      }
    }
  });
}

function appendParsedSection(lines, set) {
  var pb = set.parsedBySection || set.parsed || null;
  if (!pb || typeof pb !== 'object' || Array.isArray(pb)) return;
  linesFromParsedBySectionFull(pb).forEach(function (ln) {
    lines.push(ln);
  });
}

/** @param {unknown[]} sets @returns {string[]} */
export function formatLabsForCensoCompactBody(sets) {
  var sorted = sortLabHistoryChronological(sets || []).slice(0, 1);
  if (!sorted.length) return [];

  var set = sorted[0];
  var fecha = set.fecha && set.fecha !== 'Anterior' ? String(set.fecha).trim() : '';
  var lines = [];
  if (fecha) lines.push(fecha);

  var sp = splitResLabsByTipo(set.resLabs || []);
  var hasLabChunks = sp.labs.some(function (r) {
    return String(r || '').trim();
  });

  if (hasLabChunks) appendLabChunks(lines, set, sp);
  else appendParsedSection(lines, set);

  if (!lines.length || (fecha && lines.length === 1)) return [];
  return reflowLabsForCensoDisplay(lines.map(normalizeCensoPanelLine));
}
