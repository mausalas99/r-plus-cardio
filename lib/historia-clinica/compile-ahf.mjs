import { ahfRelativeLabel } from './ahf-relatives.mjs';
import { trim } from './string-util.mjs';


function conditionLabel(conditionId, catalog, customConditions) {
  if (catalog && catalog[conditionId]) return catalog[conditionId];
  const custom = (customConditions || []).find(function (c) {
    return c && c.id === conditionId;
  });
  return (custom && custom.label) || conditionId;
}

function formatVitalStatus(entry) {
  const status = entry.vitalStatus || 'desconocido';
  if (status === 'vivo') return 'vivo/a';
  if (status === 'fallecido') {
    let line = 'fallecido/a';
    const age = entry.ageAtDeath != null ? Number(entry.ageAtDeath) : null;
    if (Number.isFinite(age)) line += ' a los ' + age + ' años';
    if (trim(entry.causeOfDeath)) line += ' (' + trim(entry.causeOfDeath) + ')';
    return line;
  }
  return 'estado vital no especificado';
}

function formatEntryLine(entry, _catalog, _customConditions) {
  const rel = ahfRelativeLabel(entry.relativeId);
  const parts = [];
  if (trim(entry.diagnosis)) parts.push('dx: ' + trim(entry.diagnosis));
  if (trim(entry.treatment)) parts.push('tto: ' + trim(entry.treatment));
  parts.push(formatVitalStatus(entry));
  return rel + ': ' + parts.join('; ');
}

/**
 * @param {object} ahf
 * @param {Record<string,string>} catalog
 */
export function formatAhfSection(ahf, catalog) {
  ahf = ahf || {};
  catalog = catalog || {};
  const lines = [];
  const entries = Array.isArray(ahf.entries) ? ahf.entries : [];
  const byCondition = new Map();

  entries.forEach(function (entry) {
    if (!entry || !entry.conditionId || !entry.relativeId) return;
    const cid = entry.conditionId;
    if (!byCondition.has(cid)) byCondition.set(cid, []);
    byCondition.get(cid).push(entry);
  });

  byCondition.forEach(function (condEntries, conditionId) {
    const title = conditionLabel(conditionId, catalog, ahf.customConditions);
    lines.push('• ' + title);
    condEntries.forEach(function (entry) {
      lines.push('  — ' + formatEntryLine(entry, catalog, ahf.customConditions));
    });
  });

  if (trim(ahf.descripcionDetallada)) {
    if (lines.length) lines.push('');
    lines.push(trim(ahf.descripcionDetallada));
  }

  return lines.join('\n');
}

/**
 * Sync conditions[] from entries for backward compatibility.
 * @param {object} ahf
 */
export function syncAhfConditionsFromEntries(ahf) {
  if (!ahf || typeof ahf !== 'object') return ahf;
  const ids = new Set();
  (ahf.entries || []).forEach(function (e) {
    if (e && e.conditionId) ids.add(e.conditionId);
  });
  ahf.conditions = Array.from(ids);
  return ahf;
}
