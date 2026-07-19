import { isDietaSuplemento, isDietaAyuno } from './estado-actual-data.mjs';

/**
 * @param {unknown} v
 * @returns {string}
 */
function upperVal(v) {
  return v ? String(v).toUpperCase() : '___';
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function numPlaceholder(v) {
  return v !== '' && v != null ? String(v) : '___';
}

/**
 * Cláusula NM de dieta (EA panel + plantilla SOAP legacy).
 * @param {{ dieta?: unknown, kcalKg?: unknown, proteinG?: unknown }} fields
 * @param {string} [kcalDisplay]
 * @param {{ includeProtein?: boolean }} [opts]
 * @returns {string}
 */
export function formatNmDietClause(fields, kcalDisplay, opts) {
  opts = opts || {};
  fields = fields || {};
  if (isDietaAyuno(fields.dieta)) return 'DIETA AYUNO';
  if (isDietaSuplemento(fields.dieta)) return 'DIETA SUPLEMENTO';
  var proteinClause = '';
  if (
    opts.includeProtein !== false &&
    fields.proteinG != null &&
    String(fields.proteinG).trim() !== ''
  ) {
    proteinClause = ' + ' + numPlaceholder(fields.proteinG) + ' GR PROTEINA';
  }
  return (
    'DIETA ' +
    upperVal(fields.dieta) +
    ' CALCULADA A ' +
    numPlaceholder(fields.kcalKg) +
    ' KCAL/KG (' +
    numPlaceholder(kcalDisplay) +
    ' KCAL)' +
    proteinClause
  );
}
