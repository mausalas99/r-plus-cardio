import { filterFichaDriveText } from './filter-ficha-patient-fields.mjs';
import { listDriveHcReviewSections } from './drive-hc-sections.mjs';
import {
  HC_SECTION_LABELS,
  hcPatchValueToEditText,
} from './drive-import-hc-edit.mjs';
import { buildHcStructuredSuggestions } from './hc-structured-extract.mjs';
import { filterNewEventualidades } from './merge-eventualidades.mjs';
import { isDuplicateDriveLabSet } from './merge-drive-labs.mjs';
import { summarizeLabPanels } from './format-drive-import-preview-sections.mjs';

/**
 * @param {string} sectionKey
 * @param {string} text
 */
function suggestionsForSection(sectionKey, text) {
  return buildHcStructuredSuggestions(sectionKey, String(text || '').trim());
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {'fill' | 'replace' | 'eventos'} mode
 * @param {boolean} createNew
 * @returns {import('./drive-import-review.mjs').DriveImportReviewStep[]}
 */
export function buildHcReviewSteps(parsed, mode, createNew) {
  /** @type {import('./drive-import-review.mjs').DriveImportReviewStep[]} */
  const steps = [];

  if (createNew && parsed.header && (parsed.header.nombre || parsed.header.registro)) {
    steps.push({
      kind: 'header',
      label: 'Datos del paciente (nuevo)',
      include: true,
      header: Object.assign({}, parsed.header),
    });
  }

  if (mode === 'eventos') return steps;

  const driveRows = listDriveHcReviewSections(parsed.driveSections || {});
  if (driveRows.length) {
    driveRows.forEach(function (row) {
      const editText =
        row.sectionKey === 'ficha' ? filterFichaDriveText(row.text) : row.text;
      steps.push({
        kind: 'hc',
        driveSectionKey: row.sectionKey,
        label: row.label,
        include: true,
        editText: editText,
        structuredSuggestions: suggestionsForSection(row.sectionKey, row.text),
      });
    });
    return steps;
  }

  Object.keys(parsed.hcPatch || {})
    .filter(function (key) {
      return !String(key).startsWith('_');
    })
    .forEach(function (key) {
      const value = parsed.hcPatch[key];
      if (value == null) return;
      steps.push({
        kind: 'hc',
        key: key,
        label: HC_SECTION_LABELS[key] || key,
        include: true,
        editText: hcPatchValueToEditText(key, value),
        originalValue: value,
        structuredSuggestions: suggestionsForSection(key, hcPatchValueToEditText(key, value)),
      });
    });
  return steps;
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {Array<{ at?: string, text?: string }>} existingEventualidades
 * @returns {import('./drive-import-review.mjs').DriveImportReviewStep | null}
 */
export function buildEventosReviewStep(parsed, existingEventualidades) {
  const allEv = parsed.eventualidades.entries || [];
  const evFiltered = filterNewEventualidades(existingEventualidades || [], allEv);
  const evNew = evFiltered.toAdd || [];
  if (!evNew.length) return null;
  return {
    kind: 'eventos',
    label: 'Eventualidades (' + evNew.length + ' nueva' + (evNew.length === 1 ? '' : 's') + ')',
    entries: evNew.map(function (entry) {
      return { at: entry.at, text: entry.text, include: true };
    }),
  };
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {Array<{ fecha?: string, hora?: string, resLabs?: string[] }>} existingLabs
 * @returns {import('./drive-import-review.mjs').DriveImportReviewStep | null}
 */
export function buildLabsReviewStep(parsed, existingLabs) {
  const allLabSets =
    (parsed.laboratorios.allSets && parsed.laboratorios.allSets.length
      ? parsed.laboratorios.allSets
      : parsed.laboratorios.sets) || [];
  if (!allLabSets.length) return null;

  let dupCount = 0;
  const sets = allLabSets.map(function (set) {
    const isDuplicate = (existingLabs || []).some(function (ex) {
      return isDuplicateDriveLabSet(ex, set);
    });
    if (isDuplicate) dupCount += 1;
    const panels = summarizeLabPanels(set.resLabs);
    return {
      fecha: set.fecha || '',
      hora: set.hora || '',
      resLabs: set.resLabs || [],
      sourceText: set.sourceText,
      bhExtras: set.bhExtras,
      include: !isDuplicate,
      isDuplicate: isDuplicate,
      summary: (set.fecha || '?') + ' — ' + panels,
    };
  });
  const newCount = sets.length - dupCount;
  let label = 'Laboratorios (' + sets.length + ' fecha' + (sets.length === 1 ? '' : 's') + ')';
  if (dupCount && newCount) {
    label += ' · ' + newCount + ' nueva' + (newCount === 1 ? '' : 's') + ', ' + dupCount + ' en historial';
  } else if (dupCount && !newCount) {
    label += ' · todas en historial';
  }
  return { kind: 'labs', label: label, sets: sets };
}
