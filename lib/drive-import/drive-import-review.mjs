import {
  buildHcReviewSteps,
  buildEventosReviewStep,
  buildLabsReviewStep,
} from './drive-import-review-build.mjs';
import {
  applyHeaderReviewStep,
  applyHcReviewStep,
  applyEventosReviewStep,
  applyLabsReviewStep,
  finalizeHcPatchFromDriveSections,
  applyAcceptedStructuredSuggestions,
} from './drive-import-review-apply.mjs';

/**
 * @typedef {'hc' | 'eventos' | 'labs' | 'header'} DriveImportReviewStepKind
 */

/**
 * @typedef {object} DriveImportHcReviewStep
 * @property {'hc'} kind
 * @property {string} [key]
 * @property {string} [driveSectionKey]
 * @property {string} label
 * @property {boolean} include
 * @property {string} editText
 * @property {unknown} [originalValue]
 * @property {import('./hc-structured-extract.mjs').HcStructuredSuggestion[]} [structuredSuggestions]
 */

/**
 * @typedef {object} DriveImportEventosReviewStep
 * @property {'eventos'} kind
 * @property {string} label
 * @property {Array<{ at: string, text: string, include: boolean }>} entries
 */

/**
 * @typedef {object} DriveImportLabsReviewStep
 * @property {'labs'} kind
 * @property {string} label
 * @property {Array<{ fecha: string, hora: string, resLabs: string[], sourceText?: string, bhExtras?: object, include: boolean, summary: string, isDuplicate?: boolean }>} sets
 */

/**
 * @typedef {object} DriveImportHeaderReviewStep
 * @property {'header'} kind
 * @property {string} label
 * @property {boolean} include
 * @property {{ nombre?: string, registro?: string, edad?: string, cama?: string, sexo?: string }} header
 */

/**
 * @typedef {DriveImportHcReviewStep | DriveImportEventosReviewStep | DriveImportLabsReviewStep | DriveImportHeaderReviewStep} DriveImportReviewStep
 */

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {{
 *   applyMode?: 'fill' | 'replace' | 'eventos',
 *   existingEventualidades?: Array<{ at?: string, text?: string }>,
 *   existingLabHistory?: Array<{ fecha?: string, hora?: string, resLabs?: string[] }>,
 *   createNew?: boolean,
 * }} opts
 * @returns {DriveImportReviewStep[]}
 */
export function buildDriveImportReviewSteps(parsed, opts) {
  opts = opts || {};
  const mode = opts.applyMode || 'fill';
  const steps = buildHcReviewSteps(parsed, mode, !!opts.createNew);

  const eventosStep = buildEventosReviewStep(parsed, opts.existingEventualidades || []);
  if (eventosStep) steps.push(eventosStep);

  const labsStep = buildLabsReviewStep(parsed, opts.existingLabHistory || []);
  if (labsStep) steps.push(labsStep);

  return steps;
}

/**
 * @param {DriveImportReviewStep} step
 * @param {{ include?: boolean, editText?: string, entries?: Array<{ include?: boolean, text?: string }>, sets?: Array<{ include?: boolean }>, structuredSuggestions?: Array<{ include?: boolean }> }} patch
 */
export function patchReviewStep(step, patch) {
  if (step.kind === 'hc') {
    if (patch.include != null) step.include = !!patch.include;
    if (patch.editText != null) step.editText = patch.editText;
    if (patch.structuredSuggestions && step.structuredSuggestions) {
      patch.structuredSuggestions.forEach(function (row, idx) {
        if (!step.structuredSuggestions[idx]) return;
        if (row.include != null) step.structuredSuggestions[idx].include = !!row.include;
      });
    }
    return;
  }
  if (step.kind === 'header' && patch.include != null) {
    step.include = !!patch.include;
    return;
  }
  if (step.kind === 'eventos' && patch.entries) {
    patch.entries.forEach(function (row, idx) {
      if (!step.entries[idx]) return;
      if (row.include != null) step.entries[idx].include = !!row.include;
      if (row.text != null) step.entries[idx].text = row.text;
    });
    return;
  }
  if (step.kind === 'labs' && patch.sets) {
    patch.sets.forEach(function (row, idx) {
      if (!step.sets[idx]) return;
      if (row.include != null) step.sets[idx].include = !!row.include;
    });
  }
}

/**
 * @param {import('./parse-drive-document.mjs').parseDriveDocument extends (...args: any) => infer R ? R : never} parsed
 * @param {DriveImportReviewStep[]} steps
 * @param {{ createNew?: boolean }} [opts]
 * @returns {typeof parsed}
 */
export function applyReviewStepsToParsed(parsed, steps, opts) {
  opts = opts || {};
  const out = Object.assign({}, parsed, {
    driveSections: Object.assign({}, parsed.driveSections || {}),
    hcPatch: Object.assign({}, parsed.hcPatch || {}),
    eventualidades: {
      entries: (parsed.eventualidades.entries || []).slice(),
      skippedEstimate: parsed.eventualidades.skippedEstimate,
    },
    laboratorios: Object.assign({}, parsed.laboratorios, {
      sets: (parsed.laboratorios.sets || []).slice(),
    }),
    header: Object.assign({}, parsed.header || {}),
  });

  steps.forEach(function (step) {
    if (step.kind === 'header') {
      applyHeaderReviewStep(out, step, !!opts.createNew);
      return;
    }
    if (step.kind === 'hc') {
      applyHcReviewStep(out, step);
      return;
    }
    if (step.kind === 'eventos') {
      applyEventosReviewStep(out, step);
      return;
    }
    if (step.kind === 'labs') {
      applyLabsReviewStep(out, step);
    }
  });

  finalizeHcPatchFromDriveSections(out, steps);
  applyAcceptedStructuredSuggestions(out, steps);
  return out;
}

/**
 * @param {DriveImportReviewStep} step
 * @returns {string}
 */
export function reviewStepHint(step) {
  if (step.kind === 'hc') {
    if (step.driveSectionKey === 'ficha' || step.key === 'identificacion') {
      return 'Registro, diagnósticos y otros datos del expediente se omiten; ya están en Datos del paciente. Edita el resto si hace falta.';
    }
    if (step.structuredSuggestions && step.structuredSuggestions.length) {
      return 'Marca los campos estructurados que quieras completar (casillas, medicamentos, alergias, etc.). El texto libre se importa abajo.';
    }
    return 'Edita el texto si hace falta. Desmarca «Incluir» para omitir esta sección en la importación.';
  }
  if (step.kind === 'header') {
    return 'Estos datos se usarán al crear el paciente nuevo.';
  }
  if (step.kind === 'eventos') {
    return 'Marca o desmarca cada nota. Puedes corregir el texto antes de importar.';
  }
  if (step.kind === 'labs') {
    return 'Marca las fechas que quieras agregar. Las que ya están en el historial vienen desmarcadas.';
  }
  return '';
}
