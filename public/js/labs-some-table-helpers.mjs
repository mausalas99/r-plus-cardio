/** SOME table parse helpers — line classification, flags, metadata. */

const SOME_DEPARTMENTS = [
  'HEMATOLOGIA',
  'QUIMICA CLINICA',
  'BACTERIOLOGIA',
  'GASOMETRIA',
  'GASOMETRIAS',
  'INMUNOLOGIA',
  'COAGULACION',
  'URIANALISIS',
  'EXAMEN GENERAL DE ORINA',
  'ANALISIS DE ORINA',
  'CULTIVO',
  'BANDEJA',
];

const DEPT_RE = new RegExp(
  '^(' +
    SOME_DEPARTMENTS.map(function (d) {
      return d.replace(/\s+/g, '\\s+');
    }).join('|') +
    ')$',
  'i'
);

function normLine(raw) {
  return String(raw == null ? '' : raw).replace(/\r/g, '').trim();
}

function cleanValue(raw) {
  return normLine(raw).replace(/^\*+\s*/, '').trim();
}

function cleanEstudio(raw) {
  return normLine(raw).replace(/\t+$/, '').trim();
}

function isTableHeaderLine(line) {
  var u = line.toUpperCase();
  return /ESTUDIO/.test(u) && /RESULTADO/.test(u);
}

function isDepartmentLine(line) {
  var c = cleanEstudio(line).toUpperCase();
  return DEPT_RE.test(c);
}

function departmentKey(line) {
  var c = cleanEstudio(line).toUpperCase();
  var m = c.match(DEPT_RE);
  if (!m) return '';
  var hit = SOME_DEPARTMENTS.find(function (d) {
    return d.replace(/\s+/g, ' ') === m[1].replace(/\s+/g, ' ');
  });
  return hit || m[1];
}

function isFlagToken(tok) {
  return /^(\*|A|B|CB|CA)$/i.test(String(tok || '').trim());
}

function isAbnormalFlag(flag) {
  return /^(\*|A|B|CB|CA)$/i.test(String(flag || '').trim()) && String(flag).trim() !== '*';
}

/** Departamentos que se muestran como una sola tabla (sin subgrupos). */
const FLATTEN_DEPT_KEYS = {
  'QUIMICA CLINICA': true,
  'EXAMEN GENERAL DE ORINA': true,
  'ANALISIS DE ORINA': true,
  'URIANALISIS': true,
};

const CITO_GROUP_RE = /CITOQUIMICO\s+DE\s+LIQUIDOS\s+CORPORALES/i;

function normalizeDeptKey(key) {
  return String(key || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isSkippedGroupTitle(name) {
  var u = cleanEstudio(name).toUpperCase();
  return isCommentNoiseEstudio(u) || /^OBSERVACIONES?\b/.test(u);
}

function isCommentNoiseEstudio(name) {
  var u = cleanEstudio(name).toUpperCase();
  if (u === 'COMENTARIO') return false;
  return (
    /^COMENTARIOS?\s+DE(?:\s+LA)?\s+MUESTRA\b/.test(u) ||
    /^OBSERVACIONES?\b/.test(u) ||
    /^OBSERVACION\b/.test(u) ||
    /^OBS\b/.test(u) ||
    /^SIN\s+VALOR\b/.test(u) ||
    /^TEXTO\s+LIBRE\b/.test(u) ||
    /^VALOR\s+DE\s+REFERENCIA\b/.test(u) ||
    /^NOTA(?:S)?\s+(?:DE\s+)?MUESTRA\b/.test(u)
  );
}

function isCitoGroupTitle(title) {
  return CITO_GROUP_RE.test(String(title || ''));
}

function isSectionDividerEstudio(name) {
  var u = cleanEstudio(name).toUpperCase();
  return /^(FISICO|QUIMICO|SEDIMENTO|MICROSCOPICO)$/.test(u);
}

function skipSectionDividerBlock(lines, startIdx) {
  var label = cleanEstudio(lines[startIdx] || '');
  var i = startIdx + 1;
  while (i < lines.length) {
    var p = cleanEstudio(lines[i]);
    i++;
    if (!p) continue;
    if (isTableHeaderLine(p) || isDepartmentLine(p)) {
      i--;
      break;
    }
    if (isFlagToken(p)) continue;
    if (p.toUpperCase() === label.toUpperCase()) continue;
    if (p === ':' || /^AUSENTE$/i.test(p)) continue;
    break;
  }
  return i;
}

function pruneSomeCultureRows(rows) {
  return (rows || []).filter(function (r) {
    if (!r || !r.estudio || isSectionDividerRow(r)) return false;
    var res = String(r.resultado || '').trim();
    if (/^MICROORGANISMO|^CUENTA|^COMENTARIO/i.test(r.estudio)) {
      return !!res && res !== ':' && res !== '—';
    }
    if (!res || res === ':' || res === '—') return false;
    return true;
  });
}

function pruneSomeRows(rows) {
  var out = [];
  (rows || []).forEach(function (r) {
    if (!r || !r.estudio || isSectionDividerRow(r)) return;
    var res = String(r.resultado || '').trim();
    if (!res || res === ':' || res === '—') return;
    var key = r.estudio.toUpperCase();
    var idx = -1;
    for (var k = 0; k < out.length; k++) {
      if (out[k].estudio.toUpperCase() === key) {
        idx = k;
        break;
      }
    }
    if (idx >= 0) {
      var prevRes = String(out[idx].resultado || '').trim();
      if (!prevRes || prevRes === '—') out[idx] = r;
      return;
    }
    out.push(r);
  });
  return out;
}

function isSectionDividerRow(row) {
  if (!row) return false;
  var u = String(row.estudio || '')
    .trim()
    .toUpperCase();
  if (isSectionDividerEstudio(u)) return true;
  if (/^EXAMEN\s+QUIMICO$/.test(u)) return true;
  if (/^CITOQUIMICO\s+DE\s*$/.test(u)) return true;
  var res = String(row.resultado || '').trim();
  if ((res === ':' || res === '') && !row.unidades && !row.ref && /^EXAMEN\b/.test(u)) return true;
  return false;
}

/** Resultado con unidades integradas (todas las tablas SOME). */
export function formatSomeResultado(row) {
  if (!row) return '—';
  var val = String(row.resultado == null ? '' : row.resultado).trim();
  if (!val) return '—';
  var units = String(row.unidades || '').trim();
  return units ? val + ' ' + units : val;
}

function isMetadataLine(line) {
  var t = line.trim();
  if (!t) return true;
  if (/^(Expediente|Solicitud|Nombre|Sexo|Edad|Ubicaci[oó]n|M[eé]dico|Fecha\s+Registro)\s*:/i.test(t)) {
    return true;
  }
  if (/^[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(t) && t.indexOf('\t') !== -1) return true;
  return false;
}

/** Quita Expediente/Solicitud pegados al valor (copia parcial al final del reporte). */
function stripSomeInlineMetadata(raw) {
  var t = String(raw == null ? '' : raw).trim();
  if (!t) return '';
  if (/^(?:Expediente|Solicitud)\s*:/i.test(t)) return '';
  return t.replace(/\s*(?:Expediente|Solicitud)\s*:[\s\S]*$/i, '').trim();
}

function lineHasSomeMetadata(line) {
  var t = String(line || '').trim();
  if (!t) return false;
  if (isMetadataLine(t)) return true;
  return /\b(?:Expediente|Solicitud)\s*:/i.test(t);
}

function isInvalidStudyHeaderName_(name) {
  return (
    !name ||
    isTableHeaderLine(name) ||
    isDepartmentLine(name) ||
    isFlagToken(name) ||
    /^\d+([.,]\d+)?$/.test(name) ||
    name === ':' ||
    isSkippedGroupTitle(name) ||
    isCommentNoiseEstudio(name) ||
    !/[A-ZÁÉÍÓÚÑ]/.test(name)
  );
}

function studyHeaderMatchesNext_(name, nextLines) {
  var n0 = cleanEstudio(nextLines[0] || '');
  var n1 = cleanEstudio(nextLines[1] || '');
  if (n0 && n0.toUpperCase() === name.toUpperCase()) return true;
  if (isFlagToken(n0)) return true;
  return !!(n0 && n0.toUpperCase() === name.toUpperCase() && isFlagToken(n1));
}

/** SOME row header: estudio line then flag (or duplicate estudio) before valores. */
function isStudyRowHeader(line, nextLines) {
  var name = cleanEstudio(line);
  if (isInvalidStudyHeaderName_(name)) return false;
  return studyHeaderMatchesNext_(name, nextLines);
}

/** Analitos de química sérica que siguen al bloque de citoquímico en el mismo departamento. */
function isSerumQcAnalyte(name) {
  return /^(ALBUMINA|COLESTEROL|TRIGLICERIDOS)\b/i.test(String(name || '').trim());
}

function isInvalidGroupTitleName_(name) {
  return (
    !name ||
    isTableHeaderLine(name) ||
    isDepartmentLine(name) ||
    /^COMENTARIO$/i.test(name) ||
    /^EXAMEN\s+QUIMICO$/i.test(name) ||
    isFlagToken(name) ||
    /^\d+([.,]\d+)?$/.test(name) ||
    name === ':' ||
    looksLikeUnitsRefLine(name) ||
    !/[A-ZÁÉÍÓÚÑ]/.test(name)
  );
}

function groupTitleLooksLikeSection_(name, nextLines) {
  var upper = name.toUpperCase();
  for (var i = 0; i < Math.min(nextLines.length, 4); i++) {
    var n = cleanEstudio(nextLines[i]);
    if (!n) continue;
    if (isTableHeaderLine(n) || isDepartmentLine(n)) return true;
    if (n.toUpperCase().indexOf(upper + ' ') === 0) return true;
    break;
  }
  return /\b(CITOQUIMICO DE|LIQUIDOS CORPORALES|BIOMETRIA HEMATICA|TIEMPO DE|EXAMEN GENERAL DE ORINA|FISICOQUIMICO|FIBRAS VEGETALES|RELACION A\/G|PLAQUETAS CON|FROTIS|VELOCIDAD DE)\b/i.test(
    name
  );
}

function isLikelyGroupTitle(line, nextLines, currentGroupTitle) {
  var name = cleanEstudio(line);
  if (isInvalidGroupTitleName_(name)) return false;
  if (currentGroupTitle && name.toUpperCase() === String(currentGroupTitle).toUpperCase()) return false;
  var upper = name.toUpperCase();
  if (upper !== name && upper.replace(/[^A-ZÁÉÍÓÚÑ0-9\s/().-]/g, '') !== upper) return false;
  return groupTitleLooksLikeSection_(name, nextLines);
}

function stripCommentNoiseFromDepartment(dept) {
  if (!dept || !dept.groups) return dept;
  dept.groups = dept.groups
    .map(function (g) {
      var title = cleanEstudio(g.title || '');
      if (isSkippedGroupTitle(title) || isCommentNoiseEstudio(title)) return null;
      g.rows = (g.rows || []).filter(function (r) {
        return r && !isCommentNoiseEstudio(r.estudio) && !isSkippedGroupTitle(r.estudio);
      });
      return g;
    })
    .filter(function (g) {
      return g && g.rows && g.rows.length > 0;
    });
  return dept;
}

function looksLikeReferenceValue(line) {
  var t = String(line || '').trim();
  if (!t) return false;
  if (/^(NEGATIVO|POSITIVO|AUSENTE|AUSENTES|N\/A|NA)$/.test(t)) return true;
  if (/^\d/.test(t) && /\s-\s/.test(t)) return true;
  if (/^\d+([.,]\d+)?\s*-\s*\d+([.,]\d+)?(\/[A-Za-z]+)?$/i.test(t)) return true;
  return false;
}

function looksLikeQualitativeResult(line) {
  var t = String(line || '').trim();
  if (!t) return false;
  return /^(negativo|positivo|ausente|ausentes|escasas?|abundantes?|moderadas?|claro|amarillo|turbi[do]a?|presente|no\s+detectado)$/i.test(
    t
  );
}

function looksLikeUnitsRefLine(line) {
  var t = String(line || '').trim();
  if (!t) return false;
  if (looksLikeQualitativeResult(t)) return false;
  if (/\t/.test(t)) {
    var left = t.split('\t')[0].trim();
    if (left && !/^\d/.test(left)) return true;
    if (/\d/.test(t)) return true;
  }
  if (looksLikeReferenceValue(t)) return true;
  if (/^\d/.test(t) && /\s-\s/.test(t)) return true;
  if (
    /^(g\/dL|mg\/dL|mmol\/L|K\/uL|M\/uL|mm\/hr|mm3|\/CAMPO|UI\/L|IU\/L|E\.U\.|Hem\/uL|Leucocitos\/uL|%|SEG\.?|fL|pg)$/i.test(
      t
    )
  ) {
    return true;
  }
  if (/^[A-Za-z][A-Za-z0-9/.%-]*\/[A-Za-z0-9/.%-]+$/i.test(t)) return true;
  return false;
}

function parseUnitsRef(line) {
  var t = stripSomeInlineMetadata(line);
  if (!t) return { unidades: '', ref: '' };
  var tab = t.indexOf('\t');
  if (tab >= 0) {
    return {
      unidades: stripSomeInlineMetadata(t.slice(0, tab)),
      ref: stripSomeInlineMetadata(t.slice(tab + 1)),
    };
  }
  if (looksLikeReferenceValue(t)) {
    return { unidades: '', ref: t };
  }
  if (/^\d/.test(t) && /\s-\s/.test(t) && !/[a-zA-Z]{3,}/.test(t.split(/\s-\s/)[0])) {
    return { unidades: '', ref: t };
  }
  return { unidades: t, ref: '' };
}

export {
  SOME_DEPARTMENTS,
  DEPT_RE,
  FLATTEN_DEPT_KEYS,
  CITO_GROUP_RE,
  normLine,
  cleanValue,
  cleanEstudio,
  isTableHeaderLine,
  isDepartmentLine,
  departmentKey,
  isFlagToken,
  isAbnormalFlag,
  normalizeDeptKey,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  isCitoGroupTitle,
  isSectionDividerEstudio,
  skipSectionDividerBlock,
  pruneSomeCultureRows,
  pruneSomeRows,
  isSectionDividerRow,
  isMetadataLine,
  stripSomeInlineMetadata,
  lineHasSomeMetadata,
  isStudyRowHeader,
  isSerumQcAnalyte,
  isLikelyGroupTitle,
  stripCommentNoiseFromDepartment,
  looksLikeReferenceValue,
  looksLikeQualitativeResult,
  looksLikeUnitsRefLine,
  parseUnitsRef,
};
