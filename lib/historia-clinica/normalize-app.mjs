import {
  normalizeAppLegacyLists,
  migrateAppLegacyStrings,
  finalizeAppAllergiesAndErc,
} from './normalize-app-legacy.mjs';

/** Catalog ids handled by dedicated APP sections (not disease chips). */
export const APP_DEDICATED_IDS = new Set([
  'cirugias',
  'transfusiones',
  'traumaticos',
  'alergias',
]);

/**
 * @param {object} app
 * @param {object} [defaults]
 */
export function normalizeAppData(app, defaults) {
  app = Object.assign({}, defaults || {}, app || {});
  if (!Array.isArray(app.customConditions)) app.customConditions = [];
  if (!app.conditionDetails || typeof app.conditionDetails !== 'object') {
    app.conditionDetails = {};
  }
  if (!Array.isArray(app.cirugias)) app.cirugias = [];
  if (!Array.isArray(app.hospitalizaciones)) app.hospitalizaciones = [];
  if (!Array.isArray(app.conditions)) app.conditions = [];

  app.conditions = app.conditions.filter(function (id) {
    return id && !APP_DEDICATED_IDS.has(id);
  });

  normalizeAppLegacyLists(app);
  migrateAppLegacyStrings(app);

  Object.keys(app.conditionDetails).forEach(function (id) {
    if (APP_DEDICATED_IDS.has(id)) delete app.conditionDetails[id];
  });

  return finalizeAppAllergiesAndErc(app);
}
