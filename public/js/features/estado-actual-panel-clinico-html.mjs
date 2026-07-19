/** Estado clínico section HTML fragments — extracted from estado-actual-panel-clinico.mjs */
import {
  renderDietCaloricFieldsHtml,
  renderDietWeightHintHtml,
} from './estado-actual-panel-diet.mjs';
import { escHtml, escAttr, escAttrNumeric } from './estado-actual-panel-format.mjs';
import { SOPORTE_OPTIONS } from './estado-actual-panel-constants.mjs';

/**
 * @param {Record<string, unknown>} ec
 */
function renderSoporteOptions(ec) {
  return SOPORTE_OPTIONS.map(function (opt) {
    var sel = ec.soporte === opt ? ' selected' : '';
    return '<option value="' + escAttr(opt) + '"' + sel + '>' + escHtml(opt) + '</option>';
  }).join('');
}

/**
 * @param {Record<string, unknown>} ec
 */
function renderVitalsRowHtml(ec) {
  return (
    '<div class="ea-clinico-vitals-row">' +
    '<label class="ea-field">' +
    '<span class="ea-label">FOUR (/16)</span>' +
    '<input type="number" class="ea-input" data-ea-ec="four" min="0" max="16" step="1" value="' +
    escAttrNumeric(ec.four) +
    '">' +
    '</label>' +
    '<label class="ea-field">' +
    '<span class="ea-label">Esferas</span>' +
    '<input type="number" class="ea-input" data-ea-ec="esferas" min="0" step="1" value="' +
    escAttrNumeric(ec.esferas) +
    '">' +
    '</label>' +
    '<label class="ea-field">' +
    '<span class="ea-label">Soporte respiratorio</span>' +
    '<select class="ea-input" data-ea-ec="soporte">' +
    renderSoporteOptions(ec) +
    '</select>' +
    '</label>' +
    '</div>'
  );
}

/**
 * @param {Record<string, unknown>} ec
 * @param {boolean} dietPending
 * @param {boolean} dietaSuplemento
 * @param {string} kcalDisplay
 */
function renderNutritionRowHtml(ec, dietPending, dietaSuplemento, kcalDisplay) {
  return (
    '<div class="ea-clinico-nutrition-row">' +
    '<label class="ea-field ea-field--dieta">' +
    '<span class="ea-label">Dieta' +
    (dietPending ? ' <span class="ea-pendiente-badge">Propuesta</span>' : '') +
    '</span>' +
    '<input type="text" class="ea-input" data-ea-ec="dieta" value="' +
    escAttr(ec.dieta) +
    '">' +
    '</label>' +
    (dietaSuplemento ? '' : renderDietCaloricFieldsHtml(ec, kcalDisplay, escAttr)) +
    '</div>'
  );
}

function renderDietProposalBarHtml() {
  return (
    '<div class="ea-diet-proposal-bar">' +
    '<span class="ea-diet-proposal-lead">Dieta importada desde SOME — revisa los valores y confirma o descarta.</span>' +
    '<div class="ea-diet-proposal-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" onclick="confirmEaDietProposal()">Confirmar dieta</button>' +
    '<button type="button" class="ea-btn" onclick="discardEaDietProposal()">Descartar</button>' +
    '</div></div>'
  );
}

/**
 * @param {Record<string, unknown>} ec
 * @param {boolean} dietPending
 * @param {boolean} dietaSuplemento
 * @param {string} kcalDisplay
 * @param {string} dietWeightHint
 * @param {string} medFieldsHtml
 * @param {boolean} anyPending
 */
export function renderEstadoClinicoBodyHtml(ec, dietPending, dietaSuplemento, kcalDisplay, dietWeightHint, medFieldsHtml, anyPending) {
  return (
    '<div class="ea-clinico-body">' +
    '<div class="ea-clinico-grid">' +
    renderVitalsRowHtml(ec) +
    renderNutritionRowHtml(ec, dietPending, dietaSuplemento, kcalDisplay) +
    (dietPending ? renderDietProposalBarHtml() : '') +
    '</div>' +
    (dietaSuplemento ? '' : renderDietWeightHintHtml(dietWeightHint, escHtml)) +
    '<div class="ea-clinico-med-grid">' +
    medFieldsHtml +
    '</div>' +
    (anyPending
      ? '<div class="ea-clinico-actions">' +
        '<button type="button" class="ea-btn ea-btn--success" onclick="confirmAllEaMedProposals()">Confirmar todas las propuestas</button>' +
        '</div>'
      : '') +
    '</div>'
  );
}
