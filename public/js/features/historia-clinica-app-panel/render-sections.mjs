import { esc } from './runtime.mjs';
import { allConditionIds } from './state.mjs';
import { conditionCardHtml } from './condition-card-html.mjs';

export function buildConditionsSectionHtml(app, catalog, options) {
  const selected = new Set(app.conditions || []);
  const positiveIds = allConditionIds(app, catalog).filter(function (row) {
    return selected.has(row.id) || row.custom;
  });

  let html = '<section class="hc-app-block">';
  html += '<h4 class="hc-app-block-title">Enfermedades y antecedentes</h4>';
  html += '<div class="hc-checklist-options hc-checklist-options--grid">';
  options.forEach(function (opt) {
    const checked = selected.has(opt.id) ? ' checked' : '';
    html +=
      '<label class="hc-check-chip">' +
      '<input type="checkbox" class="hc-check-chip-input" data-app-cond="' +
      esc(opt.id) +
      '"' +
      checked +
      '>' +
      '<span class="hc-check-chip-label">' +
      esc(opt.label) +
      '</span></label>';
  });
  html += '</div>';
  html +=
    '<div class="hc-app-custom-row">' +
    '<div class="field-group hc-app-custom-field">' +
    '<label>Otra enfermedad</label>' +
    '<input type="text" id="hc-app-custom-label" placeholder="Nombre de la enfermedad">' +
    '</div>' +
    '<button type="button" class="btn-med-secondary" id="hc-app-add-custom">Agregar</button>' +
    '</div>';

  if (positiveIds.length) {
    html += '<div class="hc-app-conditions-detail">';
    positiveIds.forEach(function (row) {
      html += conditionCardHtml(row, app);
    });
    html += '</div>';
  }
  html += '</section>';
  return html;
}

export function buildAllergiesSectionHtml(app) {
  let html = '<section class="hc-app-block">';
  html += '<h4 class="hc-app-block-title">Alergias, trauma y transfusiones</h4>';
  html +=
    '<details class="card hc-app-special" open><summary class="card-header">Alergias medicamentosas</summary>' +
    '<div class="card-body">' +
    '<label class="hc-inline-toggle">' +
    '<input type="checkbox" id="hc-app-alergias-negado"' +
    (app.alergiasNegado ? ' checked' : '') +
    '> Sin alergias medicamentosas conocidas</label>' +
    '<div id="hc-app-alergias-body" class="hc-app-special-body' +
    (app.alergiasNegado ? ' hc-app-special-body--hidden' : '') +
    '"></div>' +
    '<div class="hc-app-special-actions' +
    (app.alergiasNegado ? ' hc-app-special-body--hidden' : '') +
    '" id="hc-app-alergias-actions">' +
    '<button type="button" class="btn-add-row" id="hc-app-add-alergia">+ Agregar medicamento</button></div>' +
    '</div></details>';
  html +=
    '<details class="card hc-app-special" open><summary class="card-header">Antecedentes traumáticos / fracturas</summary>' +
    '<div class="card-body">' +
    '<div id="hc-app-trauma-body" class="hc-app-special-body"></div>' +
    '<button type="button" class="btn-add-row" id="hc-app-add-trauma">+ Agregar evento</button>' +
    '</div></details>';
  html +=
    '<details class="card hc-app-special" open><summary class="card-header">Transfusiones previas</summary>' +
    '<div class="card-body">' +
    '<div id="hc-app-transfusion-body" class="hc-app-special-body"></div>' +
    '<button type="button" class="btn-add-row" id="hc-app-add-transfusion">+ Agregar transfusión</button>' +
    '</div></details>';
  html += '</section>';
  return html;
}

export function buildProceduresSectionHtml() {
  let html = '<section class="hc-app-block">';
  html += '<h4 class="hc-app-block-title">Procedimientos e ingresos</h4>';
  html +=
    '<details class="card" open><summary class="card-header">Cirugías previas</summary>' +
    '<div class="card-body"><div id="hc-app-cirugias" class="hc-app-special-body"></div>' +
    '<button type="button" class="btn-add-row" id="hc-app-add-cirugia">+ Agregar cirugía</button></div></details>';
  html +=
    '<details class="card" open><summary class="card-header">Hospitalizaciones previas</summary>' +
    '<div class="card-body"><div id="hc-app-hospitalizaciones" class="hc-app-special-body"></div>' +
    '<button type="button" class="btn-add-row" id="hc-app-add-hosp">+ Agregar hospitalización</button></div></details>';
  html +=
    '<details class="card" open><summary class="card-header">Medicamentos actuales</summary>' +
    '<div class="card-body"><div id="hc-app-medicamentos" class="hc-app-special-body"></div>' +
    '<button type="button" class="btn-add-row" id="hc-app-add-medicamento">+ Agregar medicamento</button></div></details>';
  html += '</section>';
  return html;
}

export function buildFooterSectionHtml(app) {
  let html = '<section class="hc-app-block">';
  html +=
    '<div class="field-group"><label>Descripción adicional</label>' +
    '<textarea rows="3" data-app-field="descripcionDetallada" placeholder="Otros antecedentes relevantes">' +
    esc(app.descripcionDetallada) +
    '</textarea></div>';
  html +=
    '<div class="field-group"><label>Inmunizaciones</label>' +
    '<input type="text" data-app-field="inmunizaciones" value="' +
    esc(app.inmunizaciones || '') +
    '" placeholder="Esquema o pendientes"></div>';
  html += '</section>';
  return html;
}
