// Lab panel — persistencia de historial (push, bulk store, drive import)
import { buildRefsBySectionFromReport } from '../labs.js';
import { areDuplicateLabSets } from '../lab-history-auto-store-core.mjs';
import { mergeBulkParseResults, mergeBulkParseResultsForStorage, pickLatestDayMergedLabDisplay } from '../lab-bulk-paste.mjs';
import { normalizeFechaLabHistory, normalizeHoraLabHistory } from '../tend-core.mjs';
import { notes, labHistory, saveState } from '../app-state.mjs';
import { bumpLabHistoryRevision } from '../lab-history-cache.mjs';
import { syncLabHistoryConsolidationToLan, syncLabHistoryDeletesToLan } from '../lab-history-lan-sync.mjs';
import { rt } from './lab-panel-runtime-state.mjs';
import { renderLabHistoryPanel, refreshSameDayAscitisForPatient } from './lab-panel-history.mjs';
import { autoConsolidateLabHistoryForPatient } from './lab-panel-history-dedupe.mjs';

function resolveLabHistoryFechaNorm(patientId, fecha) {
  var fechaNorm = normalizeFechaLabHistory(fecha) || String(fecha || '').trim();
  if (!fechaNorm && notes[patientId] && notes[patientId].fecha) {
    fechaNorm = normalizeFechaLabHistory(notes[patientId].fecha) || '';
  }
  if (fechaNorm) return fechaNorm;
  var nd = new Date();
  return (
    String(nd.getDate()).padStart(2, '0') +
    '/' +
    String(nd.getMonth() + 1).padStart(2, '0') +
    '/' +
    nd.getFullYear()
  );
}

function buildLabHistorySet(patientId, resLabs, fecha, hora, sourceText, bhExtras, refsBySection, idSeed) {
  var extras = bhExtras && typeof bhExtras === 'object' ? bhExtras : {};
  var refs = refsBySection && typeof refsBySection === 'object' ? refsBySection : {};
  if (!Object.keys(refs).length && sourceText) {
    refs = buildRefsBySectionFromReport(sourceText);
  }
  var fechaNorm = resolveLabHistoryFechaNorm(patientId, fecha);
  var horaNorm = normalizeHoraLabHistory(hora);
  var set = {
    id:
      idSeed != null && String(idSeed).trim() !== ''
        ? String(Date.now()) + '-' + String(idSeed)
        : Date.now().toString(),
    fecha: fechaNorm,
    hora: horaNorm,
    resLabs: resLabs,
    bhExtras: extras,
    parsed: rt.extractParsedValues(resLabs),
    parsedBySection: rt.buildParsedBySectionFromResLabs(resLabs, extras),
    refsBySection: refs,
    updatedAt: new Date().toISOString(),
  };
  var raw = String(sourceText || '').trim();
  if (raw) set.sourceText = raw;
  return set;
}

function pushLabHistory(patientId, resLabs, fecha, hora, sourceText, bhExtras, refsBySection, idSeed) {
  if (!patientId || !resLabs || !resLabs.length) return;
  if (!labHistory[patientId]) labHistory[patientId] = [];
  var set = buildLabHistorySet(
    patientId,
    resLabs,
    fecha,
    hora,
    sourceText,
    bhExtras,
    refsBySection,
    idSeed
  );
  labHistory[patientId].push(set);
  refreshSameDayAscitisForPatient(patientId, set.id);
  bumpLabHistoryRevision(patientId);
}

function pushLabHistoryFromBulkPayload(patientId, payload, idSeed) {
  if (!payload || !payload.resLabs || !payload.resLabs.length) return;
  pushLabHistory(
    patientId,
    payload.resLabs,
    payload.fecha,
    payload.hora,
    payload.sourceText,
    payload.bhExtras,
    payload.refsBySection,
    idSeed
  );
}

function isDuplicateInPatientHistory(patientId, payload) {
  var list = labHistory[patientId] || [];
  var incoming = {
    fecha: normalizeFechaLabHistory(payload.fecha) || String(payload.fecha || '').trim(),
    hora: normalizeHoraLabHistory(payload.hora),
    resLabs: payload.resLabs || [],
  };
  return list.some(function (existing) {
    return areDuplicateLabSets(existing, incoming);
  });
}

/**
 * @param {{ id: string }} patient
 * @param {Array<{ fecha?: string, hora?: string, resLabs?: string[], sourceText?: string, bhExtras?: object }>} labSets
 */
export async function applyDriveImportLabSets(patient, labSets) {
  if (!patient || !patient.id || !labSets || !labSets.length) {
    return { added: 0, skipped: 0 };
  }
  var patientId = patient.id;
  var added = 0;
  var skipped = 0;
  labSets.forEach(function (set, idx) {
    var payload = {
      fecha: set.fecha,
      hora: set.hora || '',
      resLabs: set.resLabs || [],
      sourceText: set.sourceText || '',
    };
    if (!payload.resLabs.length) return;
    if (isDuplicateInPatientHistory(patientId, payload)) {
      skipped += 1;
      return;
    }
    pushLabHistory(
      patientId,
      payload.resLabs,
      payload.fecha,
      payload.hora,
      payload.sourceText,
      set.bhExtras || {},
      {},
      'drive-import-' + idx
    );
    added += 1;
  });
  if (!added) return { added: 0, skipped: skipped };

  rt.rebuildEstudiosFromLabHistory(patientId);
  rt.ensureParsedLabHistory(patientId);
  renderLabHistoryPanel();
  rt.refreshTendenciasOrCultivosPanel();
  return { added: added, skipped: skipped };
}

function finalizeLabHistoryImport(patientId) {
  var consolidation = autoConsolidateLabHistoryForPatient(patientId);
  if (consolidation.merged > 0) {
    syncLabHistoryConsolidationToLan(patientId, consolidation);
    if (typeof rt.addAuditEntry === 'function') {
      rt.addAuditEntry('lab-history-auto-consolidate', 'ok', consolidation.merged, String(patientId));
    }
  }
  rt.rebuildEstudiosFromLabHistory(patientId);
}

function storeBulkLabBlocks(blocks, processable) {
  if (processable.length > 1 && typeof rt.pushUndoSnapshot === 'function') {
    rt.pushUndoSnapshot('Procesar laboratorios (' + processable.length + ' pacientes)');
  }
  var storedSets = 0;
  var skippedDupes = 0;
  processable.forEach(function (block) {
    var patientId = block.patient.id;
    var patientReg = String(block.patient.registro || '').trim();
    var okItems = block.reports
      .filter(function (r) {
        return r.ok && r.result && (!patientReg || r.expediente === patientReg);
      })
      .map(function (r) {
        return { result: r.result, reportText: r.reportText };
      });
    var mergedSets = mergeBulkParseResultsForStorage(okItems);
    mergedSets.forEach(function (payload, idx) {
      if (isDuplicateInPatientHistory(patientId, payload)) {
        skippedDupes += 1;
        return;
      }
      pushLabHistoryFromBulkPayload(patientId, payload, block.blockIndex + '-' + idx);
      storedSets += 1;
    });
    finalizeLabHistoryImport(patientId);
  });
  if (storedSets || skippedDupes) {
    saveState({ immediate: true });
    renderLabHistoryPanel();
    rt.refreshTendenciasOrCultivosPanel();
  }
  return { storedSets: storedSets, skippedDupes: skippedDupes, skippedBlocks: blocks.length - processable.length };
}

function pickDisplayLabResult(blocks, processable, activeId) {
  var activeBlock = null;
  if (activeId) {
    activeBlock = processable.find(function (b) {
      return b.patient && String(b.patient.id) === String(activeId);
    });
  }
  var block = activeBlock || processable[0] || blocks.find(function (b) {
    return b.okReportCount > 0;
  });
  if (!block) return null;

  var patientReg = block.patient ? String(block.patient.registro || '').trim() : '';
  var okItems = block.reports
    .filter(function (r) {
      return r.ok && r.result && (!patientReg || r.expediente === patientReg);
    })
    .map(function (r) {
      return { result: r.result, reportText: r.reportText };
    });
  if (!okItems.length) return null;

  var display = pickLatestDayMergedLabDisplay(okItems);
  if (!display) return null;
  return {
    result: {
      patient: display.patient,
      resLabs: display.resLabs,
      bhExtras: display.bhExtras,
      refsBySection: display.refsBySection,
    },
    reportText: display.sourceText,
    expediente: display.expediente || (display.patient && display.patient.expediente),
  };
}
export {
  pushLabHistory,
  pushLabHistoryFromBulkPayload,
  finalizeLabHistoryImport,
  isDuplicateInPatientHistory,
  storeBulkLabBlocks,
  pickDisplayLabResult,
};
