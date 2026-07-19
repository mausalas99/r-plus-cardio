import {
  appendAppConditions,
  appendAppAllergies,
  appendAppTraumaTransf,
  appendAppSurgeriesHosps,
  appendAppMedsAndText,
} from './compile-app-sections.mjs';

/**
 * @param {object} app
 * @param {Record<string,string>} catalog
 */
export function formatAppSection(app, catalog) {
  app = app || {};
  catalog = catalog || {};
  const lines = [];

  appendAppConditions(app, catalog, lines);
  appendAppAllergies(app, lines);
  appendAppTraumaTransf(app, lines);
  appendAppSurgeriesHosps(app, lines);
  appendAppMedsAndText(app, app.hospitalizaciones || [], lines);

  return lines.join('\n');
}
