import { parseDriveDocument } from '../../../../lib/drive-import/parse-drive-document.mjs';
import { listHcPatchSectionKeys } from '../../../../lib/drive-import/map-universal-hc.mjs';
import { labHistory } from '../../app-state.mjs';
import { getDriveImportRuntime } from './drive-import-state.mjs';
import { getApplyMode, getTextarea } from './drive-import-dom.mjs';

export function getParsed() {
  const ta = getTextarea();
  const rt = getDriveImportRuntime();
  const patient = rt.getActivePatient();
  const existing =
    patient && patient.eventualidades && Array.isArray(patient.eventualidades.entries)
      ? patient.eventualidades.entries
      : [];
  const existingLabs =
    patient && patient.id && labHistory[patient.id] ? labHistory[patient.id] : [];
  return parseDriveDocument(ta ? ta.value : '', {
    existingEventualidades: existing,
    existingLabHistory: existingLabs,
    applyMode: getApplyMode(),
  });
}

export function hasImportableContent(parsed, mode) {
  const hcKeys = listHcPatchSectionKeys(parsed.hcPatch || {});
  const evTotal = (parsed.eventualidades.entries || []).length;
  const evSkipped = parsed.eventualidades.skippedEstimate || 0;
  const evWillAdd = Math.max(0, evTotal - evSkipped);
  const labsWillAdd = (parsed.laboratorios.sets || []).length;
  const willTouchHc = mode !== 'eventos' && hcKeys.length > 0;
  return willTouchHc || evWillAdd > 0 || labsWillAdd > 0;
}

export function hasApprovedReviewContent(parsed) {
  const hcKeys = listHcPatchSectionKeys(parsed.hcPatch || {});
  const evCount = (parsed.eventualidades.entries || []).length;
  const labCount = (parsed.laboratorios.sets || []).length;
  return hcKeys.length > 0 || evCount > 0 || labCount > 0;
}

export function getReviewBuildOpts(_parsed) {
  const rt = getDriveImportRuntime();
  const patient = rt.getActivePatient();
  return {
    applyMode: getApplyMode(),
    existingEventualidades:
      patient && patient.eventualidades && Array.isArray(patient.eventualidades.entries)
        ? patient.eventualidades.entries
        : [],
    existingLabHistory:
      patient && patient.id && labHistory[patient.id] ? labHistory[patient.id] : [],
    createNew: !patient,
  };
}
