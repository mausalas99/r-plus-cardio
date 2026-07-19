import { filterFichaDriveText } from './filter-ficha-patient-fields.mjs';
import { mapUniversalHc } from './map-universal-hc.mjs';
import {
  editTextToHcPatchValue,
} from './drive-import-hc-edit.mjs';
import { applyStructuredSuggestionsToHcPatch } from './hc-structured-extract.mjs';

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportHeaderReviewStep} step
 * @param {boolean} createNew
 */
export function applyHeaderReviewStep(out, step, createNew) {
  if (createNew && step.include) out.header = Object.assign({}, step.header);
}

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportHcReviewStep} step
 */
export function applyHcReviewStep(out, step) {
  if (step.driveSectionKey) {
    if (step.include) {
      const raw = String(step.editText || '').trim();
      out.driveSections[step.driveSectionKey] =
        step.driveSectionKey === 'ficha' ? filterFichaDriveText(raw) : raw;
    } else {
      delete out.driveSections[step.driveSectionKey];
    }
    return;
  }
  if (!step.include) {
    if (step.key) delete out.hcPatch[step.key];
    return;
  }
  if (step.key) {
    out.hcPatch[step.key] = editTextToHcPatchValue(step.key, step.editText, step.originalValue);
  }
}

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportEventosReviewStep} step
 */
export function applyEventosReviewStep(out, step) {
  out.eventualidades.entries = step.entries
    .filter(function (e) {
      return e.include && String(e.text || '').trim();
    })
    .map(function (e) {
      return { at: e.at, text: String(e.text).trim() };
    });
}

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportLabsReviewStep} step
 */
export function applyLabsReviewStep(out, step) {
  out.laboratorios.sets = step.sets
    .filter(function (s) {
      return s.include && s.resLabs && s.resLabs.length;
    })
    .map(function (s) {
      return {
        fecha: s.fecha,
        hora: s.hora,
        resLabs: s.resLabs,
        sourceText: s.sourceText,
        bhExtras: s.bhExtras,
      };
    });
}

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportReviewStep[]} steps
 */
export function finalizeHcPatchFromDriveSections(out, steps) {
  const usedDriveSections = steps.some(function (step) {
    return step.kind === 'hc' && step.driveSectionKey;
  });
  if (!usedDriveSections) return;

  out.hcPatch = mapUniversalHc({ sections: out.driveSections }) || {};
  const sexo = out.hcPatch._sexo;
  if (sexo) delete out.hcPatch._sexo;
  if (sexo && out.header) out.header.sexo = out.header.sexo || sexo;
}

/**
 * @param {object} out
 * @param {import('./drive-import-review.mjs').DriveImportReviewStep[]} steps
 */
export function applyAcceptedStructuredSuggestions(out, steps) {
  /** @type {import('./hc-structured-extract.mjs').HcStructuredSuggestion[]} */
  const acceptedSuggestions = [];
  steps.forEach(function (step) {
    if (step.kind !== 'hc' || !step.include || !step.structuredSuggestions) return;
    step.structuredSuggestions.forEach(function (s) {
      if (s.include) acceptedSuggestions.push(s);
    });
  });
  if (acceptedSuggestions.length) {
    out.hcPatch = applyStructuredSuggestionsToHcPatch(out.hcPatch || {}, acceptedSuggestions);
  }
}
