import { applyDriveImport } from '../drive-import-apply.mjs';
import { applyReviewStepsToParsed } from '../../../../lib/drive-import/drive-import-review.mjs';
import { enrichHcPatchWithStructuredSuggestions } from '../../../../lib/drive-import/hc-structured-extract.mjs';
import { getDriveImportRuntime } from './drive-import-state.mjs';
import { getApplyMode } from './drive-import-dom.mjs';
import { getParsed, hasApprovedReviewContent } from './drive-import-parse.mjs';
import { confirmDriveImportChoice } from './drive-import-modal-step.mjs';
import { closeDriveImportModal } from './drive-import-lifecycle.mjs';

function confirmRegistroMismatch(parsed, patient) {
  if (
    !patient ||
    !parsed.header ||
    !parsed.header.registro ||
    !patient.registro ||
    String(parsed.header.registro).trim() === String(patient.registro).trim()
  ) {
    return true;
  }
  return confirmDriveImportChoice(
    'El registro del documento (' +
      parsed.header.registro +
      ') no coincide con ' +
      patient.registro +
      '. ¿Continuar de todos modos?'
  );
}

function confirmReplaceMode(fromReview, mode) {
  if (fromReview || mode !== 'replace') return true;
  return confirmDriveImportChoice(
    'Se sobrescribirán las secciones de Historia clínica presentes en el documento. ¿Continuar?'
  );
}

function confirmCreateWithoutName(createNew, parsed) {
  if (!createNew || (parsed.header && parsed.header.nombre)) return true;
  return confirmDriveImportChoice('No se detectó nombre en el encabezado. ¿Crear paciente igualmente?');
}

async function confirmImportGuards(parsed, opts) {
  const rt = getDriveImportRuntime();
  const mode = getApplyMode();
  const patient = rt.getActivePatient();
  const createNew = !patient;
  if (!confirmRegistroMismatch(parsed, patient)) return false;
  if (!confirmReplaceMode(!!opts.fromReview, mode)) return false;
  if (!confirmCreateWithoutName(createNew, parsed)) return false;
  return true;
}

function enrichParsedForFastImport(parsed, fromReview) {
  if (fromReview) return parsed;
  return Object.assign({}, parsed, {
    hcPatch: enrichHcPatchWithStructuredSuggestions(parsed.hcPatch || {}, parsed.driveSections || {}),
  });
}

function pluralSuffix(count, singular, plural) {
  return count === 1 ? singular : plural;
}

function buildEventualidadParts(result) {
  const parts = [
    (result.evAdded || 0) +
      ' eventualidad' +
      pluralSuffix(result.evAdded, '', 'es') +
      ' nueva' +
      pluralSuffix(result.evAdded, '', 's'),
  ];
  if (result.evSkipped) {
    parts.push(
      result.evSkipped +
        ' duplicada' +
        pluralSuffix(result.evSkipped, '', 's') +
        ' omitida' +
        pluralSuffix(result.evSkipped, '', 's')
    );
  }
  return parts;
}

function buildLabParts(result) {
  const parts = [];
  if (result.labAdded) {
    parts.push(
      result.labAdded +
        ' fecha' +
        pluralSuffix(result.labAdded, '', 's') +
        ' de laboratorio nueva' +
        pluralSuffix(result.labAdded, '', 's')
    );
  }
  if (result.labSkipped) {
    parts.push(
      result.labSkipped +
        ' lab' +
        pluralSuffix(result.labSkipped, '', 's') +
        ' duplicado' +
        pluralSuffix(result.labSkipped, '', 's') +
        ' omitido' +
        pluralSuffix(result.labSkipped, '', 's')
    );
  }
  return parts;
}

function buildImportSuccessParts(result, mode) {
  const parts = [];
  if (mode !== 'eventos') parts.push('HC actualizada');
  parts.push(...buildEventualidadParts(result));
  parts.push(...buildLabParts(result));
  if (result.lanSyncDeferred) {
    parts.push('sincronización con la sala en segundo plano');
  }
  return parts;
}

function navigateAfterSuccessfulImport(result) {
  const rt = getDriveImportRuntime();
  if (result.navigateTo === 'lab') {
    if (typeof rt.switchAppTab === 'function') rt.switchAppTab('lab');
    return;
  }
  if (typeof rt.switchAppTab === 'function') rt.switchAppTab('clinico');
  if (typeof rt.switchInnerTab === 'function') {
    rt.switchInnerTab(result.navigateTo || 'historia', { forceRender: true });
  }
}

function recordImportAudit(result, mode, createNew, fromReview) {
  const rt = getDriveImportRuntime();
  if (typeof rt.addAuditEntry !== 'function') return;
  rt.addAuditEntry(
    'drive-import',
    'ok',
    result.evAdded || 0,
    JSON.stringify({
      mode: mode,
      skipped: result.evSkipped,
      labAdded: result.labAdded,
      labSkipped: result.labSkipped,
      createNew: createNew,
      reviewed: !!fromReview,
    })
  );
}

/**
 * @param {ReturnType<import('../../../../lib/drive-import/parse-drive-document.mjs').parseDriveDocument>} parsed
 * @param {{ fromReview?: boolean }} opts
 */
export async function runDriveImport(parsed, opts) {
  opts = opts || {};
  const rt = getDriveImportRuntime();
  const mode = getApplyMode();
  const patient = rt.getActivePatient();
  const createNew = !patient;

  if (!(await confirmImportGuards(parsed, opts))) return;

  if (typeof rt.pushUndoSnapshot === 'function') {
    rt.pushUndoSnapshot('Importar desde Drive');
  }

  parsed = enrichParsedForFastImport(parsed, !!opts.fromReview);

  const result = await applyDriveImport(parsed, {
    mode: mode,
    activePatient: patient,
    createNew: createNew,
    fromReview: !!opts.fromReview,
  });

  if (!result.ok) {
    if (result.error === 'hc-conflict') {
      rt.showToast('Conflicto al guardar Historia clínica en LAN. Recarga e intenta de nuevo.', 'error');
    } else {
      rt.showToast('No se pudo aplicar la importación', 'error');
    }
    return;
  }

  recordImportAudit(result, mode, createNew, !!opts.fromReview);
  closeDriveImportModal();
  rt.showToast(buildImportSuccessParts(result, mode).join(' · '), 'success');
  navigateAfterSuccessfulImport(result);
}

export async function finishReviewAndImport(deps) {
  const rt = getDriveImportRuntime();
  deps.syncCurrentReviewStepFromUi();

  let parsed;
  try {
    parsed = getParsed();
  } catch {
    rt.showToast('No se pudo analizar el texto', 'error');
    return;
  }

  parsed = applyReviewStepsToParsed(parsed, deps.reviewSteps, { createNew: !rt.getActivePatient() });
  if (!hasApprovedReviewContent(parsed)) {
    rt.showToast('No hay secciones marcadas para importar', 'info');
    return;
  }

  await Promise.race([
    runDriveImport(parsed, { fromReview: true }),
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('import-timeout'));
      }, 12000);
    }),
  ]);
}
