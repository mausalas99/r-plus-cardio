import substances from './catalogs/toxicomanias-substances.json' with { type: 'json' };
import { trim } from './string-util.mjs';


export const TOXICOMANIAS_SUBSTANCES = substances;

export function newToxicomaniaEntryId() {
  return (
    'tox_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
  );
}

function substanceLabel(entry) {
  if (!entry) return '';
  if (entry.substanceId && TOXICOMANIAS_SUBSTANCES[entry.substanceId]) {
    return TOXICOMANIAS_SUBSTANCES[entry.substanceId];
  }
  return trim(entry.customLabel);
}

/**
 * @param {object | null | undefined} apnp
 */
export function normalizeToxicomaniasDetail(apnp) {
  apnp = apnp && typeof apnp === 'object' ? apnp : {};
  const legacy = trim(apnp.toxicomanias);
  let entries = Array.isArray(apnp.toxicomaniasEntries) ? apnp.toxicomaniasEntries.slice() : [];

  if (!entries.length && legacy && !/^negad/i.test(legacy)) {
    entries = [
      {
        id: newToxicomaniaEntryId(),
        substanceId: '',
        customLabel: legacy,
        frequency: '',
        years: '',
      },
    ];
  }

  entries = entries
    .filter(function (e) {
      return e && typeof e === 'object';
    })
    .map(function (e) {
      return {
        id: e.id || newToxicomaniaEntryId(),
        substanceId: trim(e.substanceId),
        customLabel: trim(e.customLabel),
        frequency: trim(e.frequency),
        years: trim(e.years),
      };
    })
    .filter(function (e) {
      return substanceLabel(e);
    });

  return { entries };
}

/**
 * @param {Array<object>} entries
 */
export function formatToxicomaniasEntries(entries) {
  entries = entries || [];
  if (!entries.length) return 'Negado';
  return entries
    .map(function (e) {
      const label = substanceLabel(e);
      if (!label) return '';
      const parts = [label];
      if (trim(e.frequency)) parts.push('frecuencia: ' + trim(e.frequency));
      if (trim(e.years)) parts.push(trim(e.years) + ' años de uso');
      return parts.join('; ');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} apnp
 */
export function summarizeToxicomanias(apnp) {
  const detail = normalizeToxicomaniasDetail(apnp);
  const summary = formatToxicomaniasEntries(detail.entries);
  return {
    entries: detail.entries,
    summary,
    copyLine: 'Toxicomanías: ' + summary,
  };
}
