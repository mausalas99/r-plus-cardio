// Lab panel — finalizeBulkLabPaste helpers
import { rt } from './lab-panel-runtime-state.mjs';
import {
  loadLabHistorySetIntoOutput,
  setLabHistorySelectedSetId,
} from './lab-panel-history.mjs';
import { findDisplayLabHistorySetId } from './lab-panel-history-dedupe.mjs';
import { storeBulkLabBlocks, pickDisplayLabResult } from './lab-panel-workbench-store.mjs';

export function storeProcessableBulkBlocks(blocks, processable) {
  if (!processable.length) {
    return { storedSets: 0, skippedDupes: 0, skippedBlocks: blocks.length };
  }
  var storeSummary = storeBulkLabBlocks(blocks, processable);
  if (typeof rt.addAuditEntry === 'function') {
    rt.addAuditEntry(
      'lab-bulk-paste',
      storeSummary.storedSets ? 'ok' : 'skip',
      storeSummary.storedSets,
      processable.length + ' pacientes'
    );
  }
  return storeSummary;
}

export function toastNoMatchingPatients(blocks, quickOut) {
  if (quickOut) return;
  if (!blocks.some(function (b) { return b.status === 'no-patient'; })) return;
  rt.showToast('Ningún expediente del pegado coincide con pacientes en la lista', 'error');
}

export function resolveBulkDisplayPick(blocks, processable, _text) {
  var displayPick = pickDisplayLabResult(blocks, processable, rt.getActiveId());
  if (displayPick) return displayPick;
  return blocks.reduce(function (found, b) {
    if (found) return found;
    var ok = b.reports.find(function (r) { return r.ok && r.result; });
    if (!ok) return null;
    return { result: ok.result, reportText: ok.reportText, expediente: ok.expediente };
  }, null);
}

export function applyBulkLabPatientSwitch(displayPick, displayResult, processable, applyLabPastePatientResolution) {
  if (processable.length === 1 && processable[0].okReportCount === 1) {
    applyLabPastePatientResolution(displayResult);
    return;
  }
  if (!displayPick.expediente) return;
  var match = rt.findPatientByRegistro(displayPick.expediente);
  if (!match || match.id === rt.getActiveId()) return;
  rt.selectPatient(match.id);
  rt.showToast('Paciente: ' + (match.nombre || 'Sin nombre') + ' · Exp ' + displayPick.expediente, 'success');
}

export function syncBulkLabHistorySelection(activeId, displayResult, processable) {
  if (!activeId || !processable.length) return;
  var historySetId = findDisplayLabHistorySetId(activeId, displayResult);
  if (!historySetId) return;
  setLabHistorySelectedSetId(activeId, historySetId);
  loadLabHistorySetIntoOutput(historySetId, { silent: true });
}

function bulkStoreSummaryParts(storeSummary) {
  var parts = [];
  if (storeSummary.storedSets) {
    parts.push(
      storeSummary.storedSets +
        ' conjunto' +
        (storeSummary.storedSets === 1 ? '' : 's') +
        ' guardado' +
        (storeSummary.storedSets === 1 ? '' : 's')
    );
  }
  if (storeSummary.skippedDupes) {
    parts.push(
      storeSummary.skippedDupes +
        ' duplicado' +
        (storeSummary.skippedDupes === 1 ? '' : 's') +
        ' omitido' +
        (storeSummary.skippedDupes === 1 ? '' : 's')
    );
  }
  if (storeSummary.skippedBlocks) {
    parts.push(
      storeSummary.skippedBlocks +
        ' bloque' +
        (storeSummary.skippedBlocks === 1 ? '' : 's') +
        ' omitido' +
        (storeSummary.skippedBlocks === 1 ? '' : 's')
    );
  }
  return parts;
}

export function showBulkLabPasteSummaryToast(multi, storeSummary, processable, blocks, quickOut, displayResult) {
  if (multi) {
    var parts = bulkStoreSummaryParts(storeSummary);
    rt.showToast(parts.length ? parts.join(' · ') + ' ✓' : 'Laboratorio procesado ✓', 'success');
    return;
  }
  if (processable.length === 1 && storeSummary.storedSets === 0 && storeSummary.skippedDupes) {
    rt.showToast('Resultado ya registrado en historial', 'success');
    return;
  }
  if (
    processable.length === 0 &&
    blocks.length === 1 &&
    blocks[0].status === 'no-patient' &&
    quickOut &&
    displayResult
  ) {
    rt.showToast('Laboratorio formateado · salida rápida ✓', 'success');
  }
}

export function notifyTourAfterBulkLabStore(blocks, storedOrAttempted) {
  if (!storedOrAttempted) return;
  if (typeof rt.tourAfterBulkLabParse === 'function') {
    rt.tourAfterBulkLabParse(blocks);
  }
}

export function filterProcessableBulkBlocks(blocks) {
  return blocks.filter(function (b) {
    return b.canProcess && b.okReportCount > 0 && b.patient;
  });
}

export function isMultiBulkLabPaste(blocks, totalOkReports, processable) {
  return blocks.length > 1 || totalOkReports > 1 || processable.length > 1;
}
