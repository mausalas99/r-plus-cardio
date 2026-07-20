import { escHtml, escAttr } from '../../dom-escape.mjs';
import { fantasticoDrugOptions } from '../../../../lib/cardio/med-segments.mjs';
import {
  normalizeFantasticosRows,
  buildSegmentRows,
  catalogTipoOptions,
} from './manejo-panel-rows.mjs';
import { buildManejoComboHtml, mergeTipoOptions } from './manejo-combo.mjs';

/**
 * @param {Array<{ className: string, drug: string, inicio: string, dosis: string, tolerancia: string }>} rows
 * @param {unknown} [_catalog] unused — Fantásticos use per-class drug lists
 */
export function buildFantasticosTableHtml(rows, _catalog) {
  var list = normalizeFantasticosRows(rows);
  var body = list
    .map(function (row, idx) {
      var drugOpts = fantasticoDrugOptions(row.className, row.drug);
      return (
        '<tr data-manejo-fant-row="' +
        escAttr(row.className) +
        '">' +
        '<td class="manejo-td-class">' +
        escHtml(row.className) +
        '</td>' +
        '<td class="manejo-td-tipo">' +
        buildManejoComboHtml(drugOpts, {
          value: row.drug,
          placeholder: 'Fármaco',
          attrs:
            'data-manejo-fant="drug" data-manejo-fant-idx="' + idx + '"',
        }) +
        '</td>' +
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
  var tipoOpts = mergeTipoOptions(catalogTipoOptions(catalog), kind);

  var history = rows
    .map(function (row) {
      var endedClass = row.active ? '' : ' manejo-row--ended';
      var mgCell = showMg
        ? '<td class="manejo-td-mg"><input type="number" class="ea-input" min="0" step="1" data-manejo-seg-field="mgTotal" data-manejo-seg-id="' +
          escAttr(row.id) +
          '" value="' +
          escAttr(row.mgTotal == null ? '' : String(row.mgTotal)) +
          '" placeholder="auto" title="Vacío = calcular por dosis × días del rango"></td>'
        : '';
      var actions = row.active
        ? '<button type="button" class="ea-btn ea-btn--ghost manejo-btn-compact" data-manejo-seg-end="' +
          escAttr(row.id) +
          '" title="Cerrar esquema hoy">Cerrar</button>'
        : '<span class="ea-muted manejo-ended-label">Cerrado</span>';
      return (
        '<tr class="manejo-seg-row' +
        endedClass +
        '" data-manejo-seg-id="' +
        escAttr(row.id) +
        '">' +
        '<td class="manejo-td-tipo">' +
        buildManejoComboHtml(tipoOpts, {
          value: row.tipo,
          attrs:
            'data-manejo-seg-field="tipo" data-manejo-seg-id="' +
            escAttr(row.id) +
            '"',
        }) +
        '</td>' +
        '<td class="manejo-td-date"><input type="date" class="ea-input rpc-date-input" data-manejo-seg-field="inicio" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.inicio) +
        '"></td>' +
        '<td class="manejo-td-date"><input type="date" class="ea-input rpc-date-input" data-manejo-seg-field="endedAt" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.endedAt || '') +
        '" title="Último día del esquema (inclusive). Vacío = vigente."></td>' +
        '<td class="manejo-td-dosis"><input type="text" class="ea-input" data-manejo-seg-field="dosis" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.dosis) +
        '"></td>' +
        '<td class="manejo-td-indicacion"><input type="text" class="ea-input" data-manejo-seg-field="indicacion" data-manejo-seg-id="' +
        escAttr(row.id) +
        '" value="' +
        escAttr(row.indicacion) +
        '"></td>' +
        mgCell +
        '<td class="manejo-td-actions">' +
        actions +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  var mgHead = showMg ? '<th class="manejo-th-mg">mg</th>' : '';
  var draftMg = showMg
    ? '<td class="manejo-td-mg"><input type="number" class="ea-input" min="0" step="1" data-manejo-seg-draft="mgTotal" placeholder="auto" title="Vacío = calcular por dosis × días"></td>'
    : '';

  var draftRow =
    '<tr class="manejo-seg-draft" data-manejo-seg-draft-row="' +
    escAttr(kind) +
    '">' +
    '<td class="manejo-td-tipo">' +
    buildManejoComboHtml(tipoOpts, {
      placeholder: 'Tipo',
      attrs: 'data-manejo-seg-draft="tipo"',
    }) +
    '</td>' +
    '<td class="manejo-td-date"><input type="date" class="ea-input rpc-date-input" data-manejo-seg-draft="inicio" title="Inicio del rango"></td>' +
    '<td class="manejo-td-date"><input type="date" class="ea-input rpc-date-input" data-manejo-seg-draft="endedAt" title="Fin del rango (inclusive). Vacío = vigente."></td>' +
    '<td class="manejo-td-dosis"><input type="text" class="ea-input" data-manejo-seg-draft="dosis" placeholder="Dosis"></td>' +
    '<td class="manejo-td-indicacion"><input type="text" class="ea-input" data-manejo-seg-draft="indicacion" placeholder="Indicación"></td>' +
    draftMg +
    '<td class="manejo-td-actions">' +
    '<div class="manejo-actions-stack">' +
    '<button type="button" class="ea-btn ea-btn--success manejo-btn-compact" data-manejo-seg-add="' +
    escAttr(kind) +
    '">Agregar</button>' +
    '<button type="button" class="ea-btn ea-btn--ghost manejo-btn-compact" data-manejo-seg-draft-repo="' +
    escAttr(kind) +
    '" title="Guardar tipo en el catálogo del paciente">Repo</button>' +
    '</div></td></tr>';

  var hint =
    kind === 'diuretic'
      ? '<p class="ea-muted manejo-range-hint">Rangos inclusive (ej. 18/07–18/07 a 80 c/12; 19/07 sin fin a 40 c/12).</p>'
      : '';

  var tableClass = 'manejo-table manejo-table--segments' + (showMg ? ' manejo-table--diuretic' : '');

  return (
    '<section class="ea-section ea-card manejo-section" data-manejo-segments="' +
    escAttr(kind) +
    '">' +
    '<h3 class="ea-section-title">' +
    escHtml(opts.title) +
    '</h3>' +
    hint +
    '<div class="manejo-table-wrap">' +
    '<table class="' +
    tableClass +
    '">' +
    '<thead><tr>' +
    '<th class="manejo-th-tipo">Tipo</th><th class="manejo-th-date">Inicio</th><th class="manejo-th-date">Fin</th><th class="manejo-th-dosis">Dosis</th><th>Indicación</th>' +
    mgHead +
    '<th class="manejo-th-actions"></th>' +
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
