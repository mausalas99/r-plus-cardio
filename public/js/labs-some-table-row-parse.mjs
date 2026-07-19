/** SOME table row parsing helpers — complexity extraction from labs-some-table-row.mjs. */
import {
  cleanEstudio,
  cleanValue,
  isTableHeaderLine,
  isDepartmentLine,
  isFlagToken,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  isSectionDividerEstudio,
  isCitoGroupTitle,
  isAbnormalFlag,
  lineHasSomeMetadata,
  stripSomeInlineMetadata,
  looksLikeUnitsRefLine,
  looksLikeReferenceValue,
  isLikelyGroupTitle,
  parseUnitsRef,
} from './labs-some-table-helpers.mjs';

var CULTURE_SAMPLE_RE =
  /^(ASPIRADO|UROCULTIVO|HEMOCULTIVO|FUNGICULTIVO|CATETER|LIQUIDO|SECRECION|ABSCESO|BRONCOALVEOLAR|CULTIVO)\b/i;

export function isCultureFieldLine(line, cultureFieldRe) {
  var n = cleanEstudio(line);
  return !!(n && cultureFieldRe.test(n));
}

function isInvalidCultureSampleName_(name) {
  return (
    !name ||
    isFlagToken(name) ||
    isDepartmentLine(name) ||
    isTableHeaderLine(name) ||
    isCitoGroupTitle(name) ||
    /^FIBRAS\s+VEGETALES$/i.test(name) ||
    /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(name)
  );
}

function cultureSampleHasProductFollow_(nextLines) {
  for (var i = 0; i < Math.min(nextLines.length, 8); i++) {
    var n = cleanEstudio(nextLines[i]);
    if (!n || isFlagToken(n)) continue;
    if (/^PRODUCTO|^TINCION|^CALIDAD|^ESTADO(\s+DE)?\s+CULTIVO/i.test(n)) return true;
    if (n.toUpperCase() === cleanEstudio(nextLines[0] || '').toUpperCase()) continue;
    break;
  }
  return false;
}

export function isCultureSampleTitle(line, nextLines, cultureFieldRe) {
  var name = cleanEstudio(line);
  if (isInvalidCultureSampleName_(name) || isCultureFieldLine(name, cultureFieldRe)) return false;
  if (CULTURE_SAMPLE_RE.test(name)) return true;
  if (name !== name.toUpperCase()) return false;
  return cultureSampleHasProductFollow_(nextLines);
}

function cultureRowShouldBreak(estudio, t, parts) {
  if (/^MICROORGANISMO$/i.test(estudio) || /^CUENTA/i.test(estudio)) return true;
  return (
    /^PRODUCTO$|^TINCION|^CALIDAD|^ESTADO|^REPORTE\s+PRELIMINAR/i.test(estudio) && parts.length >= 1
  );
}

function assignRowPrimaryValue_(value, p) {
  if (!value && p !== ':' && p !== '—') return p;
  if (value === ':' && p !== ':' && p !== '—') return p;
  return value;
}

function mergeRowUnitsRef_(unidades, ref, p, value) {
  var ur = parseUnitsRef(p);
  if (!unidades && ur.unidades) unidades = ur.unidades;
  if (!ref && ur.ref) ref = ur.ref;
  if (!unidades && !ref && p !== value) {
    if (/^\d/.test(p) && /\s-\s/.test(p)) ref = p;
    else if (!unidades) unidades = p;
  }
  return { unidades: unidades, ref: ref };
}

export function finalizeRow(estudio, flag, valueParts) {
  var est = cleanEstudio(estudio);
  if (!est) return null;
  var flagTok = isFlagToken(flag) ? flag.trim() : '*';
  var value = '';
  var unidades = '';
  var ref = '';
  for (var i = 0; i < valueParts.length; i++) {
    var p = cleanValue(stripSomeInlineMetadata(valueParts[i]));
    if (!p || lineHasSomeMetadata(p)) continue;
    var nextValue = assignRowPrimaryValue_(value, p);
    if (nextValue !== value) {
      value = nextValue;
      continue;
    }
    var merged = mergeRowUnitsRef_(unidades, ref, p, value);
    unidades = merged.unidades;
    ref = merged.ref;
  }
  return {
    estudio: est,
    flag: flagTok,
    resultado: value,
    unidades: unidades,
    ref: ref,
    abnormal: isAbnormalFlag(flagTok),
  };
}

function shouldStopCultureRow_(t, lines, j, estudio, parts, cultureFieldRe, isSampleTitle) {
  if (isCultureFieldLine(t, cultureFieldRe) || isSampleTitle(t, lines.slice(j))) return true;
  if (isDepartmentLine(t) || isTableHeaderLine(t)) return true;
  if (!parts.length && isFlagToken(t)) {
    var peek = cleanEstudio(lines[j] || '');
    return !!(peek && (isCultureFieldLine(peek, cultureFieldRe) || isSampleTitle(peek, lines.slice(j + 1))));
  }
  return false;
}

export function readCultureSomeRowAt(lines, startIdx, endIdx, cultureFieldRe, isSampleTitle) {
  var estudio = cleanEstudio(lines[startIdx]);
  if (!estudio || !isCultureFieldLine(estudio, cultureFieldRe)) return null;

  var j = startIdx + 1;
  var flag = '*';
  var parts = [];

  while (j < endIdx) {
    var t = cleanEstudio(lines[j]);
    j++;
    if (!t) continue;
    if (shouldStopCultureRow_(t, lines, j, estudio, parts, cultureFieldRe, isSampleTitle)) {
      if (!parts.length && isFlagToken(t)) break;
      j--;
      break;
    }
    if (!parts.length && isFlagToken(t)) {
      flag = t;
      continue;
    }
    if (t.toUpperCase() === estudio.toUpperCase()) continue;
    parts.push(t);
    if (cultureRowShouldBreak(estudio, t, parts)) break;
  }

  var row = finalizeRow(estudio, flag, parts);
  if (!row) return null;
  return { row: row, nextIdx: j };
}

function isInvalidStandardRowHeader(estudio) {
  return (
    !estudio ||
    isFlagToken(estudio) ||
    isTableHeaderLine(estudio) ||
    isDepartmentLine(estudio) ||
    isSkippedGroupTitle(estudio) ||
    isCommentNoiseEstudio(estudio) ||
    isSectionDividerEstudio(estudio) ||
    estudio === ':' ||
    estudio === '—'
  );
}

function shouldStopAtGroupTitle(t, lines, j, parts, currentGroupTitle) {
  if (!isLikelyGroupTitle(t, lines.slice(j), currentGroupTitle)) return false;
  return (
    parts.length > 0 ||
    isCitoGroupTitle(t) ||
    /\b(FIBRAS VEGETALES|BIOMETRIA HEMATICA|TIEMPO DE|FROTIS)\b/i.test(t)
  );
}

function appendUnitsRefIfNext(parts, lines, j) {
  if (parts.length <= 1 || !looksLikeUnitsRefLine(parts[parts.length - 1])) return j;
  var nxtRef = cleanEstudio(lines[j] || '');
  if (nxtRef && looksLikeReferenceValue(nxtRef) && !isFlagToken(cleanEstudio(lines[j + 1] || ''))) {
    parts.push(nxtRef);
    return j + 1;
  }
  return j;
}

function shouldBreakStandardRowAtFlag_(estudio, lines, j) {
  var peekAfterFlag = cleanEstudio(lines[j] || '');
  return (
    /^COMENTARIO/i.test(estudio) &&
    peekAfterFlag &&
    /^(CUENTA|MICROORGANISMO|ANTIBIOGRAMA)\b/i.test(peekAfterFlag)
  );
}

function consumeStandardRowPart_(estudio, t, lines, j, parts, currentGroupTitle) {
  if (lineHasSomeMetadata(t)) {
    var withoutMeta = stripSomeInlineMetadata(t);
    if (!withoutMeta || /^\d+-\d+$/.test(withoutMeta)) return { stop: true, rewind: true };
    parts.push(withoutMeta);
    return { j: j };
  }
  if (shouldStopAtGroupTitle(t, lines, j, parts, currentGroupTitle)) {
    return { stop: true, rewind: true };
  }
  parts.push(t);
  return { j: appendUnitsRefIfNext(parts, lines, j) };
}

function shouldBreakAfterParts_(parts, lines, j, t) {
  if (parts.length > 1 && looksLikeUnitsRefLine(t)) return true;
  if (parts.length >= 1) {
    var nxtFlag = cleanEstudio(lines[j + 1] || '');
    if (cleanEstudio(lines[j] || '') && isFlagToken(nxtFlag)) return true;
  }
  return parts.length >= 4;
}

function handleStandardRowToken_(estudio, t, lines, j, parts, currentGroupTitle, flagState) {
  if (isTableHeaderLine(t) || isDepartmentLine(t)) return { stop: true, rewind: true, j: j };
  if (!parts.length && isFlagToken(t)) {
    if (shouldBreakStandardRowAtFlag_(estudio, lines, j)) return { stop: true, j: j };
    flagState.flag = t;
    return { j: j };
  }
  if (t.toUpperCase() === estudio.toUpperCase()) return { j: j };
  return consumeStandardRowPart_(estudio, t, lines, j, parts, currentGroupTitle);
}

export function readRowAt(lines, startIdx, currentGroupTitle) {
  var estudio = cleanEstudio(lines[startIdx]);
  if (isInvalidStandardRowHeader(estudio)) return null;

  var j = startIdx + 1;
  var flagState = { flag: '*' };
  var parts = [];

  while (j < lines.length) {
    var t = cleanEstudio(lines[j]);
    j++;
    if (!t) continue;
    var step = handleStandardRowToken_(estudio, t, lines, j, parts, currentGroupTitle, flagState);
    if (step.stop) {
      if (step.rewind) j--;
      break;
    }
    j = step.j;
    if (shouldBreakAfterParts_(parts, lines, j, t)) break;
  }

  var row = finalizeRow(estudio, flagState.flag, parts);
  if (!row) return null;
  return { row: row, nextIdx: j };
}
