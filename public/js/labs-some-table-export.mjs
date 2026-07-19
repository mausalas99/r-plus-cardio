/** SOME table export models and TSV builders. */
import { buildTableTsv } from './tend-export.mjs';
import { formatSomeResultado } from './labs-some-table-helpers.mjs';
import { normalizeSomeGroup } from './labs-some-table-normalize.mjs';

export function buildSomeGroupExportModel(group) {
  var g = normalizeSomeGroup(group || { rows: [] });
  var rows = g.rows || [];
  var isCito = g.tableVariant === 'cito';
  var columns = [{ header: 'Resultado', hidden: false }];
  if (!isCito) {
    columns.push({ header: 'Valor de Referencia', hidden: false });
  }
  return {
    theme: isCito ? 'some-cito' : 'some',
    labelHeader: 'Estudio',
    columns: columns,
    rows: rows.map(function (r) {
      var resTxt = formatSomeResultado(r);
      if (r.flag && r.flag !== '*' && resTxt === '—') resTxt = r.flag;
      var cells = [
        {
          text: resTxt,
          abnormal: r.abnormal,
          flag: r.flag,
        },
      ];
      if (!isCito) {
        cells.push({ text: r.ref || '', abnormal: false });
      }
      return {
        label: r.estudio,
        hidden: false,
        cells: cells,
      };
    }),
  };
}

export function buildSomeGroupTsv(group, title) {
  var model = buildSomeGroupExportModel(group);
  var tsv = buildTableTsv(model);
  if (!tsv) return '';
  var lines = tsv.split('\n');
  if (lines.length) lines[0] = lines[0].replace(/^Analito\t/, 'Estudio\t');
  if (title) lines.unshift(String(title));
  return lines.join('\n');
}

export function buildSomeDeptTsv(dept, title) {
  var tsv = buildTableTsv(buildSomeDeptExportModel(dept, title));
  if (!tsv) return '';
  var lines = tsv.split('\n');
  if (lines.length) lines[0] = lines[0].replace(/^Analito\t/, 'Estudio\t');
  if (title) lines.unshift(String(title));
  return lines.join('\n');
}

export function buildSomeDeptExportModel(dept, _title) {
  var rows = [];
  (dept.groups || []).forEach(function (group) {
    var g = normalizeSomeGroup(group);
    var isCito = g.tableVariant === 'cito';
    (g.rows || []).forEach(function (r) {
      var resTxt = formatSomeResultado(r);
      var cells = [{ text: resTxt, abnormal: r.abnormal, flag: r.flag }];
      if (!isCito) cells.push({ text: r.ref || '', abnormal: false });
      rows.push({ label: r.estudio, cells: cells });
    });
  });
  var hasCitoOnly =
    dept.groups &&
    dept.groups.length &&
    dept.groups.every(function (g) {
      return normalizeSomeGroup(g).tableVariant === 'cito';
    });
  return {
    theme: hasCitoOnly ? 'some-cito' : 'some',
    labelHeader: 'Estudio',
    columns: hasCitoOnly
      ? [{ header: 'Resultado', hidden: false }]
      : [
          { header: 'Resultado', hidden: false },
          { header: 'Valor de Referencia', hidden: false },
        ],
    rows: rows,
  };
}
