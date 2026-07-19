/**
 * Diet caloric field HTML for EA estado clínico panel (display-only; policy lives in estado-actual-data).
 */

/**
 * @param {Record<string, unknown>} ec
 * @param {string} kcalDisplay
 * @param {(s: unknown) => string} escAttr
 * @returns {string}
 */
export function renderDietCaloricFieldsHtml(ec, kcalDisplay, escAttr) {
  return (
    '<label class="ea-field">' +
    '<span class="ea-label">Kcal/kg</span>' +
    '<input type="number" class="ea-input" data-ea-ec="kcalKg" step="any" value="' +
    escAttr(ec.kcalKg) +
    '">' +
    '</label>' +
    '<label class="ea-field">' +
    '<span class="ea-label">Kcal total</span>' +
    '<input type="number" class="ea-input" data-ea-ec="kcal" step="any" min="0" value="' +
    escAttr(kcalDisplay) +
    '" placeholder="Total">' +
    '</label>' +
    '<label class="ea-field">' +
    '<span class="ea-label">Proteína (g/día)</span>' +
    '<input type="number" class="ea-input" data-ea-ec="proteinG" step="any" min="0" value="' +
    escAttr(ec.proteinG) +
    '" placeholder="Gramos">' +
    '</label>'
  );
}

/**
 * @param {string} dietWeightHint
 * @param {(s: unknown) => string} escHtml
 * @returns {string}
 */
export function renderDietWeightHintHtml(dietWeightHint, escHtml) {
  return '<p class="ea-diet-weight-hint">' + escHtml(dietWeightHint) + '</p>';
}
