import { escHtml, escAttr } from '../../dom-escape.mjs';
import {
  normalizeFantasticosRows,
  buildSegmentRows,
  catalogTipoOptions,
} from './manejo-panel-rows.mjs';

/**
 * @param {string[]} options
 * @param {string} listId
 */
function datalistHtml(options, listId) {
  return (
    '<datalist id="' +
    escAttr(listId) +
    '">' +
    options
      .map(function (opt) {
        return '<option value="' + escAttr(opt) + '"></option>';
      })
      .join('') +
    '</datalist>'
  );
}

/**
 * @param {Array<{ className: string, drug: string, inicio: string, dosis: string, tolerancia: string }>} rows
 * @param {unknown} catalog
 */
export function buildFantasticosTableHtml(rows, catalog) {
  var list = normalizeFantasticosRows(rows);
  var drugOpts = catalogTipoOptions(catalog);
  var listId = 'manejo-fant-drugs';
  var body = list
    .map(function (row, idx) {
      return (
        '<tr data-manejo-fant-row="' +
        escAttr(row.className) +
        '">' +
        '<td class="manejo-td-class">' +
        escHtml(row.className) +
        '</td>' +
        '<td><input type="text" class="ea-input" list="' +
        escAttr(listId) +
        '" data-manejo-fant="drug" data-manejo-fant-idx="' +
        idx +
        '" value="' +
        escAttr(row.drug) +
        '" placeholder="Fármaco"></td>' +
        '<td><input type="date" class="ea-input rpc-date-input" data-manejo-fant="inicio" data-manejo-fant-idx="' +
        idx +
        '" value="' +
        escAttr(row.inicio) +
        '"></td>' +
        '<td><input type="text" class="ea-input" data-manejo-fant="dosis" data-manejo-fant-idx="' +
        idx +
        '" value="' +
        escAttr(row.dosis) +
        '" placeholder="Dosis"></td>' +
        '<td><input type="text" class="ea-input" data-manejo-fant="tolerancia" data-manejo-fant-idx="' +
        idx +
        '" value="' +
        escAttr(row.tolerancia) +
        '" placeholder="Tolerancia"></td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<section class="ea-section ea-card manejo-section" data-manejo-fantasticos="1">' +
    '<h3 class="ea-section-title">Fantásticos</h3>' +
    datalistHtml(drugOpts, listId) +
    '<div class="manejo-table-wrap">' +
    '<table class="manejo-table">' +
    '<thead><tr>' +
    '<th>Clase</th><th>Fármaco</th><th>Inicio</th><th>Dosis</th><th>Tolerancia</th>' +
    '</tr></thead>' +
    '<tbody>' +
    body +
    '</tbody></table></div></section>'
  );
}

/**
 * @param {{
 *   title: string,
 *   kind: 'med' | 'diuretic',
 *   segments: unknown,
 *   catalog: unknown,
 * }} opts
 */
export function buildSegmentTableHtml(opts) {
  var kind = opts.kind === 'diuretic' ? 'diuretic' : 'med';
  var showMg = kind === 'diuretic';
  var rows = buildSegmentRows(opts.segments);
  var catalog = opts.catalog;
  var draftListId = 'manejo-seg-tipos-' + kind;
  var tipoOpts = catalogTipoOptions(catalog);

  var history = rows
    .map(function (row) {
      var endedClass = row.active ? '' : ' manejo-row--ended';
      var mgCell = showMg
        ? '<td><input type="number" class="ea-input" min="0" step="1" data-manejo-seg-field="mgTotal" data-manejo-seg-id="' +
          escAttr(row.id) +
          '" value="' +
          escAttr(row.mgTotal == null ? '' : String(row.mgTotal)) +
          '"' +
          (row.active ? '' : ' disabled') +
          '></td>'
        : '';
      var actions = row.active
        ? '<button type="button" class="ea-btn ea-btn--ghost" data-manejo-seg-end="' +
          escAttr(row.id) +
          '">Suspender</button> ' +
          '<button type="button" class="ea-btn ea-btn--ghost" data-manejo-seg-repo="' +
          escAttr(row.id) +
          '">Guardar tipo en repo</button>'
        : '<span class="ea-muted">Hasta ' + escHtml(row.endedAt || '') + '</span>';
      return (
        '<tr class="manejo-seg-row' +
        endedClass +
        '" data-manejo-seg-id="' +
        escAttr(row.id) +
        '">' +
        '<td><input type="text" class="ea-input" list="' +
        escAttr(draftListId) +
        '" data-manejo-seg-field="tipo" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.tipo) +
        '"' +
        (row.active ? '' : ' disabled') +
        '></td>' +
        '<td><input type="date" class="ea-input rpc-date-input" data-manejo-seg-field="inicio" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.inicio) +
        '"' +
        (row.active ? '' : ' disabled') +
        '></td>' +
        '<td><input type="text" class="ea-input" data-manejo-seg-field="dosis" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.dosis) +
        '"' +
        (row.active ? '' : ' disabled') +
        '></td>' +
        '<td><input type="text" class="ea-input" data-manejo-seg-field="indicacion" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.indicacion) +
        '"' +
        (row.active ? '' : ' disabled') +
        '></td>' +
        mgCell +
        '<td class="manejo-td-actions">' +
        actions +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  var mgHead = showMg ? '<th>mg total</th>' : '';
  var draftMg = showMg
    ? '<td><input type="number" class="ea-input" min="0" step="1" data-manejo-seg-draft="mgTotal" placeholder="mg"></td>'
    : '';

  var draftRow =
    '<tr class="manejo-seg-draft" data-manejo-seg-draft-row="' +
    escAttr(kind) +
    '">' +
    '<td><input type="text" class="ea-input" list="' +
    escAttr(draftListId) +
    '" data-manejo-seg-draft="tipo" placeholder="Tipo"></td>' +
    '<td><input type="date" class="ea-input rpc-date-input" data-manejo-seg-draft="inicio"></td>' +
    '<td><input type="text" class="ea-input" data-manejo-seg-draft="dosis" placeholder="Dosis"></td>' +
    '<td><input type="text" class="ea-input" data-manejo-seg-draft="indicacion" placeholder="Indicación"></td>' +
    draftMg +
    '<td class="manejo-td-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" data-manejo-seg-add="' +
    escAttr(kind) +
    '">Agregar</button> ' +
    '<button type="button" class="ea-btn ea-btn--ghost" data-manejo-seg-draft-repo="' +
    escAttr(kind) +
    '">Guardar tipo en repo</button>' +
    '</td>' +
    '</tr>';

  return (
    '<section class="ea-section ea-card manejo-section" data-manejo-segments="' +
    escAttr(kind) +
    '">' +
    '<h3 class="ea-section-title">' +
    escHtml(opts.title) +
    '</h3>' +
    datalistHtml(tipoOpts, draftListId) +
    '<div class="manejo-table-wrap">' +
    '<table class="manejo-table">' +
    '<thead><tr>' +
    '<th>Tipo</th><th>Inicio</th><th>Dosis</th><th>Indicación</th>' +
    mgHead +
    '<th></th>' +
    '</tr></thead>' +
    '<tbody>' +
    history +
    draftRow +
    '</tbody></table></div></section>'
  );
}

/**
 * @param {Record<string, unknown>} cardio
 */
export function buildManejoPanelHtml(cardio) {
  var c = cardio && typeof cardio === 'object' ? cardio : {};
  var catalog = c.medCatalog;
  return (
    '<div class="manejo-panel" data-manejo-panel="1">' +
    datalistHtml(catalogTipoOptions(catalog), 'manejo-catalog-tipos') +
    buildFantasticosTableHtml(c.fantasticos, catalog) +
    buildSegmentTableHtml({
      title: 'Otros medicamentos',
      kind: 'med',
      segments: c.medSegments,
      catalog: catalog,
    }) +
    buildSegmentTableHtml({
      title: 'Diuréticos',
      kind: 'diuretic',
      segments: c.diureticSegments,
      catalog: catalog,
    }) +
    '</div>'
  );
}
