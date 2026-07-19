import appConditions from '../historia-clinica/catalogs/app-conditions.json' with { type: 'json' };
import { isNegatedDriveText, matchCatalogConditions, appSubsectionShouldStrip, APP_SUBSECTION_HEADERS, AHF_RELATIVE_LABEL_MAP } from './hc-structured-patterns.mjs';

export function stripIntegratedAppDescription(text, suggestions) {
  const lines = String(text || '').split('\n');
  /** @type {string[]} */
  const kept = [];
  let currentKey = '_body';
  /** @type {string[]} */
  let buffer = [];

  function flush() {
    const body = buffer.join('\n').trim();
    if (!body) {
      buffer = [];
      return;
    }
    if (currentKey === '_body') {
      let remainder = body;
      if (
        (suggestions || []).some(function (s) {
          return s.include !== false && s.target === 'app.conditions';
        })
      ) {
        const condHits = matchCatalogConditions(body, appConditions);
        if (
          condHits.length &&
          condHits.every(function (cond) {
            return (suggestions || []).some(function (s) {
              return s.include !== false && s.target === 'app.conditions' && s.value === cond.id;
            });
          })
        ) {
          remainder = '';
        }
      }
      if (remainder && !appSubsectionShouldStrip('_body', remainder, suggestions)) {
        kept.push(remainder);
      }
    } else if (!appSubsectionShouldStrip(currentKey, body, suggestions)) {
      kept.push(...buffer);
    }
    buffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    let matched = false;
    for (const header of APP_SUBSECTION_HEADERS) {
      const hit = header.re.exec(line);
      if (hit) {
        flush();
        currentKey = header.key;
        matched = true;
        if (hit[1] && hit[1].trim()) buffer.push(raw);
        break;
      }
    }
    if (!matched) {
      if (currentKey === '_body' || buffer.length === 0) {
        buffer.push(raw);
      } else {
        flush();
        currentKey = '_body';
        buffer.push(raw);
      }
    }
  }
  flush();

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * @param {string} text
 * @param {HcStructuredSuggestion[]} suggestions
 * @returns {string}
 */
export function stripIntegratedAhfDescription(text, suggestions) {
  const acceptedEntries = (suggestions || []).filter(function (s) {
    return s.include !== false && s.target === 'ahf.entries';
  });

  return String(text || '')
    .split('\n')
    .filter(function (raw) {
      const line = raw.trim();
      if (!line) return true;
      const m = /^([A-ZÁÉÍÓÚÑ\s]+)\s*[:;]\s*(.+)$/i.exec(line);
      if (!m) return true;
      const label = m[1].trim().toUpperCase();
      const value = m[2].trim();
      if (!AHF_RELATIVE_LABEL_MAP[label]) return true;
      if (isNegatedDriveText(value)) return false;
      if (!acceptedEntries.length) return true;
      const relativeId = AHF_RELATIVE_LABEL_MAP[label];
      return !acceptedEntries.some(function (s) {
        const row = /** @type {{ relativeId?: string, diagnosis?: string }} */ (s.value || {});
        return row.relativeId === relativeId &&
          String(row.diagnosis || '').toUpperCase() === value.toUpperCase();
      });
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @typedef {object} HcStructuredSuggestion
 * @property {string} id
 * @property {string} label
 * @property {string} target
 * @property {boolean} include
 * @property {unknown} value
 * @property {string} [sourceText]
 */

/**
 * @param {string} sectionKey
 * @param {string} text
 * @param {Record<string, string>} [sections]
 * @returns {HcStructuredSuggestion[]}
 */
