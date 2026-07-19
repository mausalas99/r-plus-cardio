/**
 * SOME table parse loop — line dispatch (complexity split from labs-some-table.mjs).
 * @param {object} state — { departments, currentDept, currentGroup, skipSection }
 * @param {string[]} lines
 * @param {number} i
 * @param {string} trimmed
 * @param {object} h — helper fns from labs-some-table.mjs
 * @returns {number|null} next line index if handled, else null
 */

function handleSomeCultureBlock(state, lines, i, trimmed, h) {
  if (h.normalizeDeptKey(state.currentDept.key) !== 'BACTERIOLOGIA') return null;
  if (!h.isCultureSampleTitle(trimmed, lines.slice(i + 1))) return null;
  var cultBlock = h.parseBacteriologiaCultureGroup(lines, i);
  h.ensureGroup(cultBlock.title);
  cultBlock.rows.forEach(function (r) {
    state.currentGroup.rows.push(r);
  });
  return cultBlock.nextIdx - 1;
}

function handleSomeTipoMuestra(state, lines, i, _trimmed, h) {
  var idx = i + 1;
  while (idx < lines.length) {
    var tipoNext = h.cleanEstudio(lines[idx]);
    idx++;
    if (!tipoNext) continue;
    if (h.isFlagToken(tipoNext)) continue;
    if (h.isCitoGroupTitle(tipoNext) || h.CITO_GROUP_RE.test(tipoNext)) {
      h.ensureGroup(tipoNext);
      continue;
    }
    break;
  }
  return idx - 2;
}

function handleSomeComentario(state, lines, i, _trimmed, h) {
  var fluidVal = '';
  var fj = i + 1;
  while (fj < lines.length) {
    var fline = h.cleanEstudio(lines[fj]);
    fj++;
    if (!fline) break;
    if (h.isDepartmentLine(fline) || h.isTableHeaderLine(fline)) {
      fj--;
      break;
    }
    if (h.isFlagToken(fline)) continue;
    fluidVal = fline;
    break;
  }
  if (state.currentGroup) {
    state.currentGroup.fluidSource = fluidVal || state.currentGroup.fluidSource || '';
  }
  return fj - 1;
}

function handleSomeSkipResume(state, lines, i, trimmed, h) {
  if (!state.skipSection || h.isCommentNoiseEstudio(trimmed)) return null;
  var resumeIdx = i;
  var nextTrim = h.cleanEstudio(lines[i + 1] || '');
  if (nextTrim && nextTrim.toUpperCase() === trimmed.toUpperCase()) resumeIdx = i + 1;
  var resumeParsed = h.readRowAt(lines, resumeIdx, state.currentGroup && state.currentGroup.title);
  if (
    !resumeParsed ||
    !resumeParsed.row ||
    h.isCommentNoiseEstudio(resumeParsed.row.estudio) ||
    !resumeParsed.row.resultado ||
    h.isFlagToken(resumeParsed.row.resultado)
  ) {
    return null;
  }
  state.skipSection = false;
  if (!state.currentGroup) h.ensureGroup('');
  state.currentGroup.rows.push(resumeParsed.row);
  return resumeParsed.nextIdx - 1;
}

function pushGroupTitleRow(state, lines, startIdx, title, h) {
  var dup = h.cleanEstudio(lines[startIdx + 1] || '');
  if (dup && dup.toUpperCase() === title.toUpperCase()) {
    var parsedDup = h.readRowAt(lines, startIdx + 1, title);
    if (parsedDup && parsedDup.row) {
      state.currentGroup.rows.push(parsedDup.row);
      return parsedDup.nextIdx - 1;
    }
    return startIdx + 1;
  }
  return startIdx + 1;
}

function handleSomeFlattenCitoTitle(state, lines, i, trimmed, h) {
  h.ensureGroup(trimmed);
  var citoDup = h.cleanEstudio(lines[i + 1] || '');
  if (citoDup && citoDup.toUpperCase() === trimmed.toUpperCase()) {
    var citoParsed = h.readRowAt(lines, i + 1, trimmed);
    if (citoParsed && citoParsed.row) {
      state.currentGroup.rows.push(citoParsed.row);
      return citoParsed.nextIdx - 1;
    }
    return i + 1;
  }
  return i;
}

function handleSomeGroupTitle(state, lines, i, trimmed, h) {
  if (!h.isLikelyGroupTitle(trimmed, lines.slice(i + 1), state.currentGroup && state.currentGroup.title)) {
    return null;
  }
  if (h.FLATTEN_DEPT_KEYS[h.normalizeDeptKey(state.currentDept.key)]) {
    if (h.isCitoGroupTitle(trimmed)) return handleSomeFlattenCitoTitle(state, lines, i, trimmed, h);
    h.ensureGroup('');
    var flatParsed = h.readRowAt(lines, i, '');
    if (flatParsed && flatParsed.row) {
      state.currentGroup.rows.push(flatParsed.row);
      return flatParsed.nextIdx - 1;
    }
    return i;
  }
  h.ensureGroup(trimmed);
  return pushGroupTitleRow(state, lines, i, trimmed, h);
}

function handleSomeFlatStudyRow(state, lines, i, trimmed, h) {
  if (!h.FLATTEN_DEPT_KEYS[h.normalizeDeptKey(state.currentDept.key)]) return null;
  if (h.isCitoGroupTitle(trimmed)) return null;
  if (!h.isStudyRowHeader(trimmed, lines.slice(i + 1))) return null;
  if (state.currentGroup && h.isCitoGroupTitle(state.currentGroup.title) && !h.isSerumQcAnalyte(trimmed)) {
    return null;
  }
  if (h.isLikelyGroupTitle(trimmed, lines.slice(i + 1), state.currentGroup && state.currentGroup.title)) {
    return null;
  }
  h.ensureGroup('');
  var flatRow = h.readRowAt(lines, i, '');
  if (flatRow && flatRow.row) {
    state.currentGroup.rows.push(flatRow.row);
    return flatRow.nextIdx - 1;
  }
  return null;
}

function handleSomeDataRow(state, lines, i, _trimmed, h) {
  var parsedRow = h.readRowAt(lines, i, state.currentGroup && state.currentGroup.title);
  if (
    parsedRow &&
    parsedRow.row &&
    (h.isCitoGroupTitle(parsedRow.row.resultado) || h.CITO_GROUP_RE.test(parsedRow.row.resultado || ''))
  ) {
    h.ensureGroup(String(parsedRow.row.resultado).trim());
    return parsedRow.nextIdx - 1;
  }
  var parsed = parsedRow;
  if (!parsed || !parsed.row) return null;
  if (!state.currentGroup) h.ensureGroup('');
  state.currentGroup.rows.push(parsed.row);
  return parsed.nextIdx - 1;
}

/**
 * @returns {number|null}
 */
export function dispatchSomeParseLine(state, lines, i, trimmed, h) {
  if (h.isDepartmentLine(trimmed)) {
    h.ensureDept(h.departmentKey(trimmed));
    state.currentGroup = null;
    state.skipSection = false;
    return i;
  }
  if (h.isTableHeaderLine(trimmed) || !state.currentDept) return i;
  if (trimmed === ':' || trimmed === '—') return i;
  if (h.isSectionDividerRow({ estudio: trimmed, resultado: '', unidades: '', ref: '' })) return i;
  if (h.isSectionDividerEstudio(trimmed)) return h.skipSectionDividerBlock(lines, i) - 1;

  var handlers = [
    function () {
      return handleSomeCultureBlock(state, lines, i, trimmed, h);
    },
    function () {
      if (!/^TIPO\s+DE\s+MUESTRA$/i.test(trimmed)) return null;
      return handleSomeTipoMuestra(state, lines, i, trimmed, h);
    },
    function () {
      if (!/^COMENTARIO$/i.test(trimmed)) return null;
      return handleSomeComentario(state, lines, i, trimmed, h);
    },
    function () {
      if (!h.isSkippedGroupTitle(trimmed)) return null;
      state.skipSection = true;
      state.currentGroup = null;
      return i;
    },
    function () {
      return handleSomeSkipResume(state, lines, i, trimmed, h);
    },
    function () {
      if (!state.skipSection) return null;
      return i;
    },
    function () {
      return handleSomeGroupTitle(state, lines, i, trimmed, h);
    },
    function () {
      return handleSomeFlatStudyRow(state, lines, i, trimmed, h);
    },
    function () {
      return handleSomeDataRow(state, lines, i, trimmed, h);
    },
  ];

  for (var hi = 0; hi < handlers.length; hi++) {
    var next = handlers[hi]();
    if (next != null) return next;
  }
  return i;
}

export function finalizeSomeDepartments(departments, h) {
  departments.forEach(function (dept) {
    dept.groups.forEach(function (g) {
      h.normalizeSomeGroup(g);
    });
    dept.groups = dept.groups.filter(function (g) {
      return g.rows.length > 0;
    });
    if (h.FLATTEN_DEPT_KEYS[h.normalizeDeptKey(dept.key)]) {
      h.flattenDeptGroups(dept);
    }
    h.stripCommentNoiseFromDepartment(dept);
  });
  return departments.filter(function (d) {
    return d.groups.length > 0;
  });
}
