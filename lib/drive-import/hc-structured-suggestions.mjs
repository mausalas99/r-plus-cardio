import { syncAhfConditionsFromEntries } from '../historia-clinica/compile-ahf.mjs';
import {
  buildAhfSectionSuggestions,
  buildApnpSectionSuggestions,
  buildAppSectionSuggestions,
  appendFallbackSectionSuggestions,
} from './hc-structured-build-sections.mjs';
import { applyStructuredSuggestionToPatch } from './hc-structured-apply-field.mjs';
import {
  stripIntegratedAppDescription,
  stripIntegratedAhfDescription,
} from './hc-structured-strip.mjs';

export function buildHcStructuredSuggestions(sectionKey, text, _sections) {
  /** @type {HcStructuredSuggestion[]} */
  const suggestions = [];
  const key = String(sectionKey || '');

  buildAppSectionSuggestions(key, text, suggestions);
  if (key === 'apnp') buildApnpSectionSuggestions(text, suggestions);
  if (key === 'ahf') buildAhfSectionSuggestions(text, suggestions);
  appendFallbackSectionSuggestions(key, text, suggestions);

  return suggestions;
}

/**
 * @param {Record<string, unknown>} hcPatch
 * @param {HcStructuredSuggestion[]} suggestions
 * @returns {Record<string, unknown>}
 */
export function applyStructuredSuggestionsToHcPatch(hcPatch, suggestions) {
  const accepted = (suggestions || []).filter(function (s) {
    return s.include !== false;
  });
  let out = Object.assign({}, hcPatch || {});
  accepted.forEach(function (s) {
    out = applyStructuredSuggestionToPatch(out, s);
  });

  if (out.app && typeof out.app === 'object') {
    const app = /** @type {Record<string, unknown>} */ (Object.assign({}, out.app));
    if (typeof app.descripcionDetallada === 'string') {
      app.descripcionDetallada = stripIntegratedAppDescription(app.descripcionDetallada, accepted);
    }
    out.app = app;
  }

  if (out.ahf && typeof out.ahf === 'object') {
    const ahf = /** @type {Record<string, unknown>} */ (
      syncAhfConditionsFromEntries(Object.assign({}, out.ahf))
    );
    if (typeof ahf.descripcionDetallada === 'string') {
      ahf.descripcionDetallada = stripIntegratedAhfDescription(ahf.descripcionDetallada, accepted);
    }
    out.ahf = ahf;
  }

  return out;
}

const STRUCTURED_SECTION_KEYS = ['app', 'apnp', 'ahf', 'ecd', 'medicamentos'];

/**
 * @param {Record<string, string>} sections
 * @returns {HcStructuredSuggestion[]}
 */
export function collectStructuredSuggestionsFromDriveSections(sections) {
  /** @type {HcStructuredSuggestion[]} */
  const all = [];
  STRUCTURED_SECTION_KEYS.forEach(function (key) {
    const text = String((sections || {})[key] || '').trim();
    if (!text) return;
    buildHcStructuredSuggestions(key, text, sections).forEach(function (s) {
      all.push(s);
    });
  });
  return all;
}

/**
 * @param {Record<string, unknown>} hcPatch
 * @param {Record<string, string>} sections
 * @returns {Record<string, unknown>}
 */
export function enrichHcPatchWithStructuredSuggestions(hcPatch, sections) {
  const suggestions = collectStructuredSuggestionsFromDriveSections(sections || {});
  if (!suggestions.length) return hcPatch || {};
  return applyStructuredSuggestionsToHcPatch(hcPatch || {}, suggestions);
}
