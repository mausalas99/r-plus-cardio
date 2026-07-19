/** SOME table HTML rendering. */
import { formatSomeResultado } from './labs-some-table-helpers.mjs';
import { normalizeSomeGroup } from './labs-some-table-normalize.mjs';

function renderSomeTableToolbarHtml(options, exportLabel, deptIndex, groupIndex) {
  if (options.hideToolbar) return '';
  var deptAttr = deptIndex != null ? ' data-dept-index="' + escHtml(String(deptIndex)) + '"' : '';
  var groupAttr = groupIndex != null ? ' data-group-index="' + escHtml(String(groupIndex)) + '"' : '';
  return (
    '<div class="lab-some-table-toolbar">' +
    '<button type="button" class="lab-some-export-btn" data-export="tsv"' +
    deptAttr +
    groupAttr +
    ' data-label="' +
    escHtml(exportLabel) +
    '" title="Copiar tabla como texto">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
    'TSV</button>' +
    '<button type="button" class="lab-some-export-btn" data-export="png"' +
    deptAttr +
    groupAttr +
    ' data-label="' +
    escHtml(exportLabel) +
    '" title="Copiar tabla como imagen">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
    'PNG</button>' +
    '</div>'
  );
}

function renderSomeTableBodyRowsHtml(rows, isCito) {
  var html = '';
  rows.forEach(function (r) {
    var resClass = r.abnormal ? ' lab-some-abnormal' : '';
    var flagHtml =
      r.flag && r.flag !== '*' ? '<span class="lab-some-flag">' + escHtml(r.flag) + '</span> ' : '';
    var resDisplay = formatSomeResultado(r);
    html += '<tr>';
    html += '<td class="lab-some-estudio">' + escHtml(r.estudio) + '</td>';
    html +=
      '<td class="lab-some-resultado' +
      resClass +
      '" data-unidades="' +
      escHtml(r.unidades || '') +
      '" data-ref="' +
      escHtml(r.ref || '') +
      '">' +
      flagHtml +
      escHtml(resDisplay) +
      '</td>';
    if (!isCito) html += '<td class="lab-some-ref">' + escHtml(r.ref || '') + '</td>';
    html += '</tr>';
  });
  return html;
}

function renderSomeGroupOpenTag_(options, isCito, tableId, deptIndex, groupIndex) {
  return (
    '<div class="lab-some-group' +
    (isCito ? ' lab-some-group--cito' : '') +
    '"' +
    (tableId ? ' data-table-id="' + escHtml(tableId) + '"' : '') +
    (deptIndex != null ? ' data-dept-index="' + escHtml(String(deptIndex)) + '"' : '') +
    (groupIndex != null ? ' data-group-index="' + escHtml(String(groupIndex)) + '"' : '') +
    ' data-variant="' +
    (isCito ? 'cito' : 'standard') +
    '">'
  );
}

function renderSomeGroupHeaderHtml_(g, options, title, isCito) {
  var html = '';
  if (title && !options.hideGroupTitles) {
    html += '<div class="lab-some-group-title">' + escHtml(title) + '</div>';
  }
  if (isCito && g.fluidSource) {
    html +=
      '<div class="lab-some-fluid-source"><span class="lab-some-fluid-label">Origen del líquido:</span> ' +
      escHtml(g.fluidSource) +
      '</div>';
  }
  return html;
}

export function renderSomeTableGroupHtml(group, opts) {
  var options = opts || {};
  var g = normalizeSomeGroup(group || { rows: [] });
  var rows = g.rows || [];
  if (!rows.length) return '';

  var isCito = g.tableVariant === 'cito';
  var title = g.title ? String(g.title) : '';
  var tableId = options.tableId || '';
  var exportLabel = options.exportLabel || title || 'Tabla';
  if (!options.exportLabel && isCito && g.fluidSource) {
    exportLabel = (exportLabel + ' — ' + g.fluidSource).trim();
  }

  var deptIndex = options.deptIndex;
  var groupIndex = options.groupIndex;
  var html = renderSomeGroupOpenTag_(options, isCito, tableId, deptIndex, groupIndex);
  html += renderSomeGroupHeaderHtml_(g, options, title, isCito);
  html += renderSomeTableToolbarHtml(options, exportLabel, deptIndex, groupIndex);
  html +=
    '<div class="lab-some-table-wrap"><table class="lab-some-table lab-some-table--cols-' +
    (isCito ? '2' : '3') +
    '"><thead><tr><th>Estudio</th><th>Resultado</th>' +
    (isCito ? '' : '<th>Valor de Referencia</th>') +
    '</tr></thead><tbody>';
  html += renderSomeTableBodyRowsHtml(rows, isCito);
  html += '</tbody></table></div></div>';
  return html;
}

function renderSomeDeptExportActions(deptLabel, deptIndex) {
  var label = escHtml(deptLabel);
  return (
    '<span class="lab-some-dept-summary-actions" onclick="event.stopPropagation()">' +
    '<button type="button" class="lab-some-export-btn lab-some-dept-export-btn" data-export="tsv" data-dept-index="' +
    deptIndex +
    '" data-label="' +
    label +
    '" title="Copiar sección como texto">TSV</button>' +
    '<button type="button" class="lab-some-export-btn lab-some-dept-export-btn" data-export="png" data-dept-index="' +
    deptIndex +
    '" data-label="' +
    label +
    '" title="Copiar sección como imagen">PNG</button>' +
    '</span>'
  );
}

export function renderSomeReportTablesHtml(parsed, opts) {
  var options = opts || {};
  if (!parsed || !parsed.departments || !parsed.departments.length) return '';

  var modalLayout = !!options.modalLayout;
  var html = '<div class="lab-some-tables' + (modalLayout ? ' lab-some-tables--modal' : '') + '">';
  parsed.departments.forEach(function (dept, di) {
    html +=
      '<section class="lab-some-dept" data-dept="' +
      escHtml(dept.key) +
      '" data-dept-index="' +
      di +
      '">';
    if (modalLayout) {
      html +=
        '<details class="lab-some-dept-details" open><summary class="lab-some-dept-summary">' +
        '<span class="lab-some-dept-summary-label">' +
        escHtml(dept.label) +
        '</span>' +
        renderSomeDeptExportActions(dept.label, di) +
        '</summary><div class="lab-some-dept-body">';
    } else {
      html += '<header class="lab-some-dept-header">' + escHtml(dept.label) + '</header>';
    }
    dept.groups.forEach(function (group, gi) {
      var tableId = 'some-' + di + '-' + gi;
      var g = normalizeSomeGroup(group);
      var exportLabel = (dept.label + (g.title ? ' — ' + g.title : '')).trim();
      if (g.tableVariant === 'cito' && g.fluidSource) {
        exportLabel += ' — ' + g.fluidSource;
      }
      html += renderSomeTableGroupHtml(g, {
        tableId: tableId,
        exportLabel: exportLabel,
        hideGroupTitles: !!options.hideGroupTitles,
        hideToolbar: modalLayout,
        deptIndex: di,
        groupIndex: gi,
      });
    });
    html += modalLayout ? '</div></details>' : '';
    html += '</section>';
  });
  html += '</div>';
  return html;
}

import { escHtml } from './dom-escape.mjs';