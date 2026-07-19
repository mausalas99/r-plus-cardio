import { esc } from './runtime.mjs';
import {
  buildAllergiesSectionHtml,
  buildConditionsSectionHtml,
  buildFooterSectionHtml,
  buildProceduresSectionHtml,
} from './render-sections.mjs';

export function emptyHint(text) {
  return '<p class="hc-empty-hint">' + esc(text) + '</p>';
}

/**
 * @param {object} app
 * @param {Record<string,string>} catalog
 * @param {{ id: string, label: string }[]} options
 */
export function buildPanelShellHtml(app, catalog, options) {
  return (
    '<div class="hc-app-panel">' +
    buildConditionsSectionHtml(app, catalog, options) +
    buildAllergiesSectionHtml(app) +
    buildProceduresSectionHtml() +
    buildFooterSectionHtml(app) +
    '</div>'
  );
}
