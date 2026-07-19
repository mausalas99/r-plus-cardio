/** SOME table row readers — standard rows + bacteriología culture blocks. */
import {
  cleanEstudio,
  isTableHeaderLine,
  isDepartmentLine,
  isFlagToken,
} from './labs-some-table-helpers.mjs';
import {
  isCultureFieldLine,
  isCultureSampleTitle,
  finalizeRow,
  readCultureSomeRowAt,
  readRowAt,
} from './labs-some-table-row-parse.mjs';

/** Campos típicos de informes SOME de cultivos (uro/hemo/aspirado, etc.). */
var CULTURE_FIELD_RE =
  /^(PRODUCTO|TINCION|CALIDAD|ESTADO(\s+DE)?\s+CULTIVO|REPORTE\s+PRELIMINAR|MICROORGANISMO|COMENTARIO:?|CUENTA(\s+DE\s+KASS)?|ANTIBIOGRAMA|IDENTIFICACION)/i;

function isCultureFieldLineBound(line) {
  return isCultureFieldLine(line, CULTURE_FIELD_RE);
}

function isCultureSampleTitleBound(line, nextLines) {
  return isCultureSampleTitle(line, nextLines, CULTURE_FIELD_RE);
}

function cultureBlockEndIdx(lines, startIdx) {
  for (var k = startIdx + 1; k < lines.length; k++) {
    var t = cleanEstudio(lines[k]);
    if (!t || isFlagToken(t)) continue;
    if (isDepartmentLine(t) || isTableHeaderLine(t)) return k;
    if (k > startIdx + 1 && isCultureSampleTitleBound(t, lines.slice(k + 1))) return k;
  }
  return lines.length;
}

function readCultureSomeRowAtBound(lines, startIdx, endIdx) {
  return readCultureSomeRowAt(lines, startIdx, endIdx, CULTURE_FIELD_RE, isCultureSampleTitleBound);
}

function parseBacteriologiaCultureGroup(lines, startIdx) {
  var title = cleanEstudio(lines[startIdx]);
  var endIdx = cultureBlockEndIdx(lines, startIdx);
  var rows = [];
  var i = startIdx + 1;
  while (i < endIdx) {
    var parsed = readCultureSomeRowAtBound(lines, i, endIdx);
    if (!parsed) {
      i++;
      continue;
    }
    rows.push(parsed.row);
    i = parsed.nextIdx;
  }
  return { title: title, rows: rows, nextIdx: endIdx };
}

function isCultureGroupTitle(title) {
  var t = cleanEstudio(title);
  if (!t) return false;
  return isCultureSampleTitleBound(t, ['PRODUCTO']);
}

export {
  cultureBlockEndIdx,
  readCultureSomeRowAtBound as readCultureSomeRowAt,
  parseBacteriologiaCultureGroup,
  finalizeRow,
  readRowAt,
  isCultureFieldLineBound as isCultureFieldLine,
  isCultureSampleTitleBound as isCultureSampleTitle,
  isCultureGroupTitle,
};
