/** SOME table group/dept normalization and flattening. */
import { isCitoGroupTitle, isSectionDividerRow, normalizeDeptKey, pruneSomeCultureRows, pruneSomeRows } from './labs-some-table-helpers.mjs';
import { isCultureGroupTitle } from './labs-some-table-row.mjs';

function normalizeSomeGroup(group) {
  if (!group) return group;
  if (group._someNormalized) return group;
  var isCito = group.tableVariant === 'cito' || isCitoGroupTitle(group.title);
  var fluidSource = group.fluidSource || '';
  var rows = [];
  group.rows.forEach(function (r) {
    if (/^COMENTARIO$/i.test(r.estudio)) {
      fluidSource = String(r.resultado || '').trim() || fluidSource;
      return;
    }
    if (/^TIPO\s+DE\s+MUESTRA$/i.test(r.estudio)) return;
    if (isCitoGroupTitle(r.resultado) || isCitoGroupTitle(r.estudio)) return;
    if (isSectionDividerRow(r)) return;
    rows.push(r);
  });
  if (isCito) {
    var extracted = extractFluidSourceFromRows(rows);
    rows = extracted.rows;
    fluidSource = fluidSource || extracted.fluid || '';
  }
  group.rows = isCultureGroupTitle(group.title) ? pruneSomeCultureRows(rows) : pruneSomeRows(rows);
  group.fluidSource = fluidSource;
  group.tableVariant = isCito ? 'cito' : 'standard';
  group._someNormalized = true;
  return group;
}

function flattenDeptGroupsSimple(dept) {
  var rows = [];
  dept.groups.forEach(function (g) {
    rows = rows.concat(g.rows);
  });
  dept.groups = rows.length ? [{ title: '', rows: rows, tableVariant: 'standard' }] : [];
}

function extractFluidSourceFromRows(rows) {
  var fluid = '';
  var kept = [];
  rows.forEach(function (r) {
    if (/^COMENTARIO$/i.test(r.estudio)) {
      fluid = String(r.resultado || '').trim() || fluid;
      return;
    }
    if (/^LIQUIDO\s+DE\s+/i.test(r.estudio) || /^CITOQUIMICO\s+DE\s*$/i.test(r.estudio)) {
      if (!fluid && r.resultado) fluid = r.resultado;
      if (/^LIQUIDO\s+DE\s+/i.test(r.estudio) && !r.resultado) fluid = r.estudio;
      return;
    }
    if (!isSectionDividerRow(r)) kept.push(r);
  });
  return { fluid: fluid, rows: kept };
}

function flattenQuimicaClinica(dept) {
  var normalRows = [];
  var citoGroups = [];
  dept.groups.forEach(function (g) {
    if (isCitoGroupTitle(g.title) || g.tableVariant === 'cito') {
      var extracted = extractFluidSourceFromRows(g.rows);
      g.rows = extracted.rows;
      g.fluidSource = g.fluidSource || extracted.fluid || '';
      normalizeSomeGroup(g);
      if (g.rows.length) citoGroups.push(g);
    } else {
      g.rows.forEach(function (r) {
        if (!isSectionDividerRow(r)) normalRows.push(r);
      });
    }
  });
  var out = [];
  if (normalRows.length) {
    out.push({ title: '', rows: normalRows, tableVariant: 'standard' });
  }
  citoGroups.forEach(function (g) {
    out.push(g);
  });
  dept.groups = out;
}

function flattenDeptGroups(dept) {
  var key = normalizeDeptKey(dept.key);
  if (key === 'QUIMICA CLINICA') {
    flattenQuimicaClinica(dept);
    return;
  }
  flattenDeptGroupsSimple(dept);
}

export {
  normalizeSomeGroup,
  flattenDeptGroupsSimple,
  extractFluidSourceFromRows,
  flattenQuimicaClinica,
  flattenDeptGroups,
};
