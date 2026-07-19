/**
 * Utilidades de conjuntos de laboratorio en historial: parseo, fusión por tipo, estudios en nota.
 */
import { procesarLabs, buildRefsBySectionFromReport, extractLabReportHora, reprocessLabResultLines_ } from './labs.js';
export { isLabSectionHeaderLine, isCultivoBlockStartLine, splitResLabsByTipo } from './cultivo-block-core.mjs';
import { findExactDuplicateLabGroups, findNormalizedSourceDuplicateGroups, findConflictingSameDateTimeGroups, areLabSetsEquivalent } from './lab-history-auto-store-core.mjs';
import { normalizeFechaLabHistory, normalizeHoraLabHistory, sortLabHistoryChronological } from './tend-core.mjs';
import { extractParsedValues, buildParsedBySectionFromResLabs } from './features/diagrams.mjs';
import { inferFechaLabSetFromId } from './features/tendencias.mjs';
import { normalizeLabHistoryPatientSets } from './storage.js';
import { bumpLabHistoryRevision } from './lab-history-cache.mjs';
import { maintRt } from './lab-history-runtime.mjs';
import {
  extractLabDataLines,
  labSetParseFingerprint,
  buildEstudiosCopyLinesFromLabSets,
  resolveEstudiosCopyOptions,
} from './lab-history-format.mjs';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  listadoProblemas,
  recetaHuByPatient,
  vpoByPatient,
  medPharmProfileByPatient,
  saveState,
} from './app-state.mjs';
import { storage } from './storage.js';

export function registerLabHistoryMaintRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(maintRt, ctx);
}

function applyMigratedResLabs(set, noteLines) {
  if (set.resLabs && set.resLabs.length) return false;
  if (set.id === 'migrated-anterior') {
    set.resLabs = extractLabDataLines(noteLines.slice(0, 3));
    return true;
  }
  if (set.id === 'migrated-recent') {
    set.resLabs = extractLabDataLines(noteLines.slice(3));
    return true;
  }
  return false;
}

function ensureSetBhExtras(set) {
  if (set.bhExtras || !set.sourceText) return false;
  try {
    var reParse = procesarLabs(set.sourceText);
    set.bhExtras = reParse && reParse.bhExtras ? reParse.bhExtras : {};
  } catch {
    set.bhExtras = {};
  }
  return true;
}

function setParsedBySectionIfChanged(set, pbNext) {
  var pbStr = '';
  try {
    pbStr = JSON.stringify(pbNext);
  } catch {
    set.parsedBySection = pbNext;
    return true;
  }
  if (pbStr != null && JSON.stringify(set.parsedBySection || null) !== pbStr) {
    set.parsedBySection = pbNext;
    return true;
  }
  return false;
}

function syncSetParsedFields(set) {
  var changed = false;
  var fp = labSetParseFingerprint(set);
  if (
    set._parseFingerprint === fp &&
    set.parsedBySection &&
    Object.keys(set.parsedBySection).length
  ) {
    return { changed: false, rebuildNota: false };
  }
  var needsParse = !set.parsed || !Object.keys(set.parsed).length;
  if (needsParse) {
    if (!set.resLabs || !set.resLabs.length) {
      set.parsed = {};
    } else {
      set.parsed = extractParsedValues(set.resLabs);
    }
    changed = true;
  }
  if (set.resLabs && set.resLabs.length) {
    if (setParsedBySectionIfChanged(set, buildParsedBySectionFromResLabs(set.resLabs, set.bhExtras))) {
      changed = true;
    }
  } else if (set.parsedBySection && Object.keys(set.parsedBySection).length) {
    set.parsedBySection = {};
    changed = true;
  }
  set._parseFingerprint = labSetParseFingerprint(set);
  return { changed, rebuildNota: false };
}

function normalizeSetFechaHora(set) {
  var changed = false;
  var nf = normalizeFechaLabHistory(set.fecha);
  if (nf && nf !== set.fecha && set.fecha !== 'Anterior') {
    set.fecha = nf;
    changed = true;
  }
  var nh = normalizeHoraLabHistory(set.hora);
  if (nh !== (set.hora || '')) {
    set.hora = nh;
    changed = true;
  }
  return changed;
}

function syncSetRefsAndHora(set) {
  if (!set.sourceText) return { changed: false, rebuildNota: false };
  var changed = false;
  var rebuildNota = false;
  if (!set.refsBySection || !Object.keys(set.refsBySection).length) {
    var refsNext = buildRefsBySectionFromReport(set.sourceText);
    if (refsNext && Object.keys(refsNext).length) {
      set.refsBySection = refsNext;
      changed = true;
    }
  }
  var horaFromSrc = normalizeHoraLabHistory(extractLabReportHora(set.sourceText));
  var normStoredHora = normalizeHoraLabHistory(set.hora);
  if (horaFromSrc && horaFromSrc !== normStoredHora) {
    set.hora = horaFromSrc;
    changed = true;
    rebuildNota = true;
  }
  return { changed, rebuildNota };
}

function inferSetFechaIfMissing(set) {
  if (set.fecha && String(set.fecha).trim()) return false;
  if (set.fecha === 'Anterior') return false;
  var inferred = inferFechaLabSetFromId(set);
  if (!inferred) return false;
  set.fecha = inferred;
  return true;
}

function processLabHistorySet(set, noteLines) {
  if (!set) return { changed: false, rebuildNota: false };
  var changed = false;
  var rebuildNota = false;
  if (applyMigratedResLabs(set, noteLines)) changed = true;
  if (ensureSetBhExtras(set)) changed = true;
  var parsed = syncSetParsedFields(set);
  if (parsed.changed) changed = true;
  if (normalizeSetFechaHora(set)) changed = true;
  var refs = syncSetRefsAndHora(set);
  if (refs.changed) changed = true;
  if (refs.rebuildNota) rebuildNota = true;
  if (inferSetFechaIfMissing(set)) changed = true;
  return { changed, rebuildNota };
}

function persistLabHistoryPatient(patientId, history) {
  if (history.length) labHistory[patientId] = history;
  else delete labHistory[patientId];
}

export function rebuildEstudiosFromLabHistory(patientId) {
  if (!patientId) return;
  if (!notes[patientId]) notes[patientId] = {};
  var ordered = sortLabHistoryChronological(
    ensureParsedLabHistory(patientId, { skipRebuildNota: true })
  );
  if (!ordered.length) {
    notes[patientId].estudios = '';
    return;
  }
  var settings =
    typeof maintRt.getSettings === 'function' ? maintRt.getSettings() : null;
  notes[patientId].estudios = buildEstudiosCopyLinesFromLabSets(
    ordered,
    resolveEstudiosCopyOptions(ordered, settings)
  ).join('\n');
}

export function ensureParsedLabHistory(patientId, options) {
  var skipRebuildNota = !!(options && options.skipRebuildNota);
  var readOnly = !!(options && options.readOnly);
  var raw = labHistory[patientId];
  var history = normalizeLabHistoryPatientSets(raw);
  var changed = !Array.isArray(raw) || raw !== history;
  var rebuildNota = false;
  var noteLines = notes[patientId] && notes[patientId].estudios ? notes[patientId].estudios.split('\n') : [];

  history.forEach(function (set) {
    var result = processLabHistorySet(set, noteLines);
    if (result.changed) changed = true;
    if (result.rebuildNota) rebuildNota = true;
  });

  if (rebuildNota && patientId && notes[patientId] && !skipRebuildNota) {
    persistLabHistoryPatient(patientId, history);
    rebuildEstudiosFromLabHistory(patientId);
    changed = true;
  }
  if (!Array.isArray(raw) || raw !== history) {
    persistLabHistoryPatient(patientId, history);
    changed = true;
  }
  if (changed && !readOnly) saveState();
  return history;
}

export function ensureParsedLabHistoryCached(patientId, options) {
  var opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
  if (opts.readOnly == null) opts.readOnly = true;
  return ensureParsedLabHistory(patientId, opts);
}

var _labMaintTimer = null;
var _labMaintRunning = false;
var LAB_MAINT_DEBOUNCE_MS = 550;

function refreshLabHistoryUiAfterMaint() {
  var aid = maintRt.getActiveId();
  if (aid) {
    try {
      maintRt.renderLabHistoryPanel();
    } catch (_e) { void _e; }
  }
  try {
    maintRt.refreshTendenciasOrCultivosPanel();
  } catch (_e) { void _e; }
}

export function runLabHistoryPostSaveMaintenance() {
  var report = {
    at: new Date().toISOString(),
    reprocessedSetCount: 0,
    patientsReprocessed: [],
    exactDuplicates: [],
    sourceDuplicates: [],
    sameDateTimeConflicts: [],
  };
  var changed = false;
  Object.keys(labHistory || {}).forEach(function (pid) {
    if (pid.indexOf('demo-') === 0) return;
    var sets = labHistory[pid];
    if (!Array.isArray(sets) || !sets.length) return;
    sets.forEach(function (set) {
      if (!set.resLabs || !set.resLabs.length) return;
      var repro = reprocessLabResultLines_(set.resLabs, {
        gasRefs: set.refsBySection && set.refsBySection.GASES,
      });
      if (!repro || !repro.length) return;
      if (!areLabSetsEquivalent(set.resLabs, repro)) {
        set.resLabs = repro.slice();
        set.parsed = extractParsedValues(repro);
        set.parsedBySection = buildParsedBySectionFromResLabs(repro, set.bhExtras);
        delete set._parseFingerprint;
        changed = true;
        report.reprocessedSetCount++;
        if (report.patientsReprocessed.indexOf(pid) === -1) report.patientsReprocessed.push(pid);
      }
    });
    var ex = findExactDuplicateLabGroups(sets);
    if (ex.length) {
      report.exactDuplicates.push({ patientId: pid, groups: ex });
    }
    var src = findNormalizedSourceDuplicateGroups(sets);
    if (src.length) {
      report.sourceDuplicates.push({ patientId: pid, groups: src });
    }
    var ct = findConflictingSameDateTimeGroups(sets);
    if (ct.length) {
      report.sameDateTimeConflicts.push({ patientId: pid, groups: ct });
    }
  });
  try {
    window.__rpcLabAudit = report;
  } catch (_e) { void _e; }
  var noise =
    report.reprocessedSetCount > 0 ||
    report.exactDuplicates.length > 0 ||
    report.sourceDuplicates.length > 0 ||
    report.sameDateTimeConflicts.length > 0;
  if (noise) {
    try {
      if (localStorage.getItem('rplus.debug-labs') === '1') {
        console.info('[R+ Laboratorio] Auditoría tras guardado — revisa window.__rpcLabAudit:', report);
      }
    } catch (_dbg) {
      void _dbg;
    }
  }
  if (changed && report.patientsReprocessed.length) {
    report.patientsReprocessed.forEach(function (pid) {
      bumpLabHistoryRevision(pid);
    });
  }
  return changed;
}

function persistAllLabStateAfterMaint() {
  storage.saveAll(
    patients,
    notes,
    indicaciones,
    labHistory,
    medRecetaByPatient,
    listadoProblemas,
    recetaHuByPatient,
    vpoByPatient,
    medPharmProfileByPatient
  );
}

export function scheduleLabHistoryPostSaveMaintenance() {
  clearTimeout(_labMaintTimer);
  _labMaintTimer = setTimeout(function () {
    _labMaintTimer = null;
    if (_labMaintRunning) return;
    _labMaintRunning = true;
    try {
      var changed = runLabHistoryPostSaveMaintenance();
      if (changed) {
        persistAllLabStateAfterMaint();
        refreshLabHistoryUiAfterMaint();
      }
    } catch (err) {
      console.warn('[R+ Laboratorio] Falló mantenimiento post-guardado:', err);
    } finally {
      _labMaintRunning = false;
    }
  }, LAB_MAINT_DEBOUNCE_MS);
}

export function installLabHistoryAuditHook() {
  try {
    window.runRpcLabAuditNow = function () {
      var ch = runLabHistoryPostSaveMaintenance();
      if (ch) {
        persistAllLabStateAfterMaint();
        refreshLabHistoryUiAfterMaint();
      }
      return window.__rpcLabAudit;
    };
  } catch (_e) { void _e; }
}

// ── Lab History Migration ─────────────────────────────────────────
(function migrateLabHistory() {
  try {
    if (localStorage.getItem('rpc-labHistory')) return;
  } catch {
    return;
  }
  patients.forEach(function (p) {
    try {
      if (!notes[p.id] || !notes[p.id].estudios) return;
      var lines = notes[p.id].estudios.split('\n');
      var anteriorLines = lines.slice(0, 3).filter(function (l) {
        return l.trim();
      });
      var recentLines = lines.slice(3).filter(function (l) {
        return l.trim();
      });
      var sets = [];
      if (anteriorLines.length) {
        var migratedAnteriorLabs = extractLabDataLines(anteriorLines);
        sets.push({
          id: 'migrated-anterior',
          fecha: 'Anterior',
          hora: '',
          resLabs: migratedAnteriorLabs,
          parsed: extractParsedValues(migratedAnteriorLabs),
        });
      }
      if (recentLines.length) {
        var migratedRecentLabs = extractLabDataLines(recentLines);
        sets.push({
          id: 'migrated-recent',
          fecha: normalizeFechaLabHistory(recentLines[0] || notes[p.id].fecha || ''),
          hora: notes[p.id].hora || '',
          resLabs: migratedRecentLabs,
          parsed: extractParsedValues(migratedRecentLabs),
        });
      }
      if (sets.length) labHistory[p.id] = sets;
    } catch (e) {
      console.error('migrateLabHistory patient error:', p && p.id, e && e.message);
    }
  });
  try {
    localStorage.setItem('rpc-labHistory', JSON.stringify(labHistory));
  } catch (e) {
    console.error('migrateLabHistory write error:', e && e.message);
  }
})();
