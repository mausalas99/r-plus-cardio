// Lab panel — historial dedupe y consolidación por día
import {
  sortLabHistoryChronological,
  parseFechaLabToMs,
} from '../tend-core.mjs';
import { patients, labHistory } from '../app-state.mjs';
import { bumpLabHistoryRevision } from '../lab-history-cache.mjs';
import { findExactDuplicateLabGroups, compareLabSetIdForDedupe } from '../lab-history-auto-store-core.mjs';
import { isGasometriaOnlyResLabs } from '../lab-history-format.mjs';
import { labTimestampMsFromFechaHora } from '../lab-consolidation-cluster.mjs';
import {
  buildLabConsolidationMergeJobs,
  countAutoLabConsolidationMerges,
  findOutlierLabConsolidationGroups,
} from '../lab-consolidation-plan.mjs';
import { finishLabConsolidateUi, wireLabConsolidateModal, buildLabConsolidateModalHtml } from './lab-panel-history-consolidate-modal.mjs';
import { syncLabHistoryConsolidationToLan } from '../lab-history-lan-sync.mjs';
import { rt } from './lab-panel-runtime-state.mjs';
import { labSetIdForHistory, clearLabHistoryDateSelectCache, dedupeConsolidatedRowsBySection, refreshSameDayAscitisForPatient } from './lab-panel-history.mjs';
import { buildLabDedupeModalHtml, wireLabDedupeModal } from './lab-panel-history-dedupe-modal.mjs';

function labDedupeSummaryLine(set) {
  if (!set) return '—';
  return rt.formatLabHistoryListMeta(set) + ' · id ' + String(set.id).slice(-12);
}

function labParsedFingerprintForDedupe(set) {
  var p = set && set.parsed;
  if (!p || !Object.keys(p).length) p = rt.extractParsedValues(set.resLabs || []);
  var keys = Object.keys(p).filter(function (k) {
    var v = p[k];
    return v != null && isFinite(Number(v));
  }).sort();
  if (!keys.length) return '';
  return keys.map(function (k) {
    return k + ':' + Number(p[k]);
  }).join('|');
}

function labLooseDupeKey(set) {
  if (!set) return '';
  var dk = rt.dayKeyFromLabSet(set);
  if (!dk || dk === 'unknown' || dk === 'Anterior') return '';
  var fp = labParsedFingerprintForDedupe(set);
  if (!fp) return '';
  return 'd:' + dk + '||' + fp;
}

function buildLabDedupeChecklistSections(patientId) {
  var sets = rt.ensureParsedLabHistory(patientId);
  var byId = {};
  sets.forEach(function (s) {
    if (s && s.id != null) byId[String(s.id)] = s;
  });
  var rows = [];
  var exactRemoveIds = new Set();

  findExactDuplicateLabGroups(sets).forEach(function (g) {
    g.removeIds.forEach(function (id) {
      exactRemoveIds.add(id);
      var s = byId[id];
      if (!s) return;
      rows.push({
        patientId: patientId,
        id: id,
        kind: 'exact',
        checked: true,
        summary: labDedupeSummaryLine(s),
      });
    });
  });

  var looseByKey = Object.create(null);
  sets.forEach(function (s) {
    if (!s || s.id == null) return;
    var k = labLooseDupeKey(s);
    if (!k) return;
    if (!looseByKey[k]) looseByKey[k] = [];
    looseByKey[k].push(s);
  });
  Object.keys(looseByKey).forEach(function (k) {
    var arr = looseByKey[k];
    if (arr.length < 2) return;
    arr.sort(compareLabSetIdForDedupe);
    arr.slice(1).forEach(function (s) {
      var sid = String(s.id);
      if (exactRemoveIds.has(sid)) return;
      rows.push({
        patientId: patientId,
        id: sid,
        kind: 'loose',
        checked: true,
        summary: labDedupeSummaryLine(s),
      });
    });
  });

  return rows;
}

function applyLabDedupeFromChecklist(mapByPatient) {
  var removedTotal = 0;
  Object.keys(mapByPatient).forEach(function (pid) {
    var ids = mapByPatient[pid];
    if (!ids || !ids.length || !labHistory[pid]) return;
    var idSet = new Set(ids.map(String));
    var before = labHistory[pid].length;
    labHistory[pid] = labHistory[pid].filter(function (s) {
      return !idSet.has(String(s.id));
    });
    if (!labHistory[pid].length) delete labHistory[pid];
    rt.rebuildEstudiosFromLabHistory(pid);
    removedTotal += before - (labHistory[pid] ? labHistory[pid].length : 0);
    if (before !== (labHistory[pid] ? labHistory[pid].length : 0)) bumpLabHistoryRevision(pid);
  });
  return removedTotal;
}

function showLabDedupeChecklistModal(sections) {
  var backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop';
  backdrop.id = 'lab-dedupe-backdrop';
  backdrop.innerHTML = buildLabDedupeModalHtml(sections);
  document.body.appendChild(backdrop);
  wireLabDedupeModal(backdrop, applyLabDedupeFromChecklist);
}

function openLabHistoryDedupeReview(scope) {
  scope = scope || 'active';
  if (scope === 'active') {
    if (!rt.getActiveId()) {
      rt.showToast('Selecciona un paciente primero', 'error');
      return;
    }
    var rows = buildLabDedupeChecklistSections(rt.getActiveId());
    if (!rows.length) {
      rt.showToast('No hay duplicados ni coincidencias por fecha/valores en este paciente', 'success');
      return;
    }
    var p = patients.find(function (x) {
      return x.id === rt.getActiveId();
    });
    showLabDedupeChecklistModal([
      {
        patientId: rt.getActiveId(),
        nombre: p ? p.nombre : '',
        registro: p ? p.registro : '',
        rows: rows,
      },
    ]);
    return;
  }
  if (scope === 'all') {
    rt.closeSettingsDropdown();
    runLabDedupeReviewAllPatients();
  }
}

function runLabDedupeReviewAllPatients() {
  var list = patients.filter(function (p) {
    return p && !p.isDemo;
  });
  if (!list.length) {
    rt.showToast('No hay pacientes para revisar', 'error');
    return;
  }
  rt.showToast('Buscando duplicados en ' + list.length + ' pacientes…', 'success');
  var sections = [];
  var index = 0;
  function step() {
    if (index >= list.length) {
      if (!sections.length) {
        rt.showToast('No se encontraron duplicados ni coincidencias por fecha/valores', 'success');
        return;
      }
      showLabDedupeChecklistModal(sections);
      return;
    }
    var batchEnd = Math.min(index + 4, list.length);
    while (index < batchEnd) {
      var p = list[index];
      index += 1;
      var r = buildLabDedupeChecklistSections(p.id);
      if (r.length) {
        sections.push({
          patientId: p.id,
          nombre: p.nombre || '—',
          registro: p.registro || '',
          rows: r,
        });
      }
    }
    setTimeout(step, 0);
  }
  setTimeout(step, 0);
}

function labSetDayKey(set) {
  return rt.dayKeyFromLabSet(set);
}

function labSetTipo(set) {
  return rt.primaryTipoForLabSet(set.resLabs);
}

function labSetIsGasoOnly(set) {
  return isGasometriaOnlyResLabs(set && set.resLabs);
}

function labSetTimestampMs(set) {
  return labTimestampMsFromFechaHora(set.fecha, set.hora);
}

function mergeLabHistorySetsCluster(patientId, setsToMerge, tipoGrupo) {
  var removedIds = [];
  if (!setsToMerge || setsToMerge.length < 2) return removedIds;

  var arr = setsToMerge.slice();
  arr.sort(compareLabSetIdForDedupe);
  var keeper = arr[0];
  var mergeOrder = arr.slice().sort(function (a, b) {
    var sa = rt.labSetIsFromSome(a) ? 1 : 0;
    var sb = rt.labSetIsFromSome(b) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return compareLabSetIdForDedupe(a, b);
  });
  var merged = [];
  var sourceParts = [];
  mergeOrder.forEach(function (set) {
    var other = set.resLabs || [];
    if (merged.length && other.length) merged.push('');
    merged = merged.concat(other);
    if (set.sourceText && String(set.sourceText).trim()) sourceParts.push(String(set.sourceText).trim());
  });
  var deduped = dedupeConsolidatedRowsBySection(merged, tipoGrupo);
  keeper.resLabs = deduped;
  keeper.parsed = rt.extractParsedValues(deduped);
  var mergedBhExtras = {};
  mergeOrder.forEach(function (sMerge) {
    if (sMerge && sMerge.bhExtras && typeof sMerge.bhExtras === 'object') {
      Object.keys(sMerge.bhExtras).forEach(function (bk) {
        mergedBhExtras[bk] = sMerge.bhExtras[bk];
      });
    }
  });
  keeper.bhExtras = mergedBhExtras;
  keeper.parsedBySection = rt.buildParsedBySectionFromResLabs(deduped, keeper.bhExtras);
  if (sourceParts.length) keeper.sourceText = sourceParts.join('\n\n---\n\n');
  refreshSameDayAscitisForPatient(patientId, keeper.id);
  keeper.hora = '';
  for (var j = 1; j < arr.length; j++) {
    removedIds.push(String(arr[j].id));
  }
  return removedIds;
}

function executeLabConsolidationMergeJobs(patientId, jobs) {
  var out = { merged: 0, removedIds: [], keeperIds: [] };
  if (!patientId || !jobs || !jobs.length || !labHistory[patientId]) return out;

  var todo = [];
  var keeperIds = [];
  jobs.forEach(function (job) {
    var tipoGrupo = job.sets.some(function (s) {
      return labSetTipo(s) === 'labs';
    })
      ? 'labs'
      : labSetTipo(job.sets[0]) || 'labs';
    var removed = mergeLabHistorySetsCluster(patientId, job.sets, tipoGrupo);
    if (!removed.length) return;
    removed.forEach(function (id) {
      todo.push(id);
    });
    keeperIds.push(String(job.sets[0].id));
  });

  if (!todo.length) return out;

  var idRemove = new Set(todo);
  labHistory[patientId] = labHistory[patientId].filter(function (s) {
    return !idRemove.has(String(s.id));
  });
  if (!labHistory[patientId].length) delete labHistory[patientId];
  bumpLabHistoryRevision(patientId);
  clearLabHistoryDateSelectCache();
  out.merged = todo.length;
  out.removedIds = todo;
  out.keeperIds = keeperIds;
  return out;
}

function analyzeLabConsolidation(patientId) {
  if (!patientId || !labHistory[patientId] || labHistory[patientId].length < 2) {
    return { autoJobs: [], outlierGroups: [], autoMergeCount: 0 };
  }
  rt.ensureParsedLabHistory(patientId);
  var sets = labHistory[patientId].slice();
  var outlierGroups = findOutlierLabConsolidationGroups(
    sets,
    labSetDayKey,
    labSetTipo,
    labSetTimestampMs,
    labSetIsGasoOnly
  );
  var autoJobs = buildLabConsolidationMergeJobs(
    sets,
    labSetDayKey,
    labSetTipo,
    labSetTimestampMs,
    null,
    labSetIsGasoOnly
  );
  return {
    autoJobs: autoJobs,
    outlierGroups: outlierGroups,
    autoMergeCount: countAutoLabConsolidationMerges(autoJobs),
  };
}

function dayLabelFromDayKey(dayKey) {
  if (!dayKey || dayKey === 'unknown') return '—';
  var parts = String(dayKey).split('-').map(function (x) {
    return parseInt(x, 10);
  });
  if (parts.length !== 3 || !isFinite(parts[0])) return dayKey;
  var dd = String(parts[2]).padStart(2, '0');
  var mm = String(parts[1]).padStart(2, '0');
  return dd + '/' + mm + '/' + parts[0];
}

function runLabConsolidationForPatient(patientId, outlierGroupKeys) {
  if (!patientId || !labHistory[patientId] || labHistory[patientId].length < 2) {
    return { merged: 0, removedIds: [], keeperIds: [] };
  }
  rt.ensureParsedLabHistory(patientId);
  var sets = labHistory[patientId].slice();
  var jobs = buildLabConsolidationMergeJobs(
    sets,
    labSetDayKey,
    labSetTipo,
    labSetTimestampMs,
    outlierGroupKeys,
    labSetIsGasoOnly
  );
  var result = executeLabConsolidationMergeJobs(patientId, jobs);
  if (result.merged) rt.rebuildEstudiosFromLabHistory(patientId);
  return result;
}

/**
 * Fusiona entradas del mismo día, tipo homogéneo y ventana horaria ≤2 h.
 * @returns {{ merged: number, removedIds: string[], keeperIds: string[] }}
 */
function runLabHistoryDayTipoConsolidation(patientId) {
  return runLabConsolidationForPatient(patientId, null);
}

function autoConsolidateLabHistoryForPatient(patientId) {
  return runLabHistoryDayTipoConsolidation(patientId);
}

function findDisplayLabHistorySetId(patientId, displayResult) {
  if (!patientId || !displayResult) return '';
  var hist = sortLabHistoryChronological(
    rt.ensureParsedLabHistoryCached
      ? rt.ensureParsedLabHistoryCached(patientId)
      : rt.ensureParsedLabHistory(patientId, { readOnly: true })
  );
  if (!hist.length) return '';

  var targetDay = rt.dayKeyFromLabSet({
    fecha: displayResult.patient && displayResult.patient.fecha,
    hora: displayResult.patient && displayResult.patient.hora,
  });
  var candidates = hist.filter(function (set) {
    return rt.dayKeyFromLabSet(set) === targetDay;
  });
  if (!candidates.length) candidates = [hist[0]];

  candidates.sort(function (a, b) {
    var la = (a.resLabs && a.resLabs.length) || 0;
    var lb = (b.resLabs && b.resLabs.length) || 0;
    if (lb !== la) return lb - la;
    var ta = parseFechaLabToMs(a.fecha, a.hora);
    var tb = parseFechaLabToMs(b.fecha, b.hora);
    if (typeof ta === 'number' && typeof tb === 'number' && isFinite(ta) && isFinite(tb) && tb !== ta) {
      return tb - ta;
    }
    return 0;
  });

  var pick = candidates[0];
  var idx = hist.indexOf(pick);
  return labSetIdForHistory(pick, idx >= 0 ? idx : 0);
}

/**
 * Fusiona entradas de labHistory del mismo día, tipo homogéneo y bloque horario ≤2 h.
 * Los conjuntos mixtos (laboratorio + cultivo en un mismo set) no se fusionan ni se agrupan con otros.
 */
function consolidateLabHistoryByDayAndTipo() {
  if (!rt.getActiveId()) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var patientId = rt.getActiveId();
  var list = labHistory[patientId];
  if (!list || list.length < 2) {
    rt.showToast('Se necesitan al menos 2 conjuntos en el historial', 'error');
    return;
  }

  var analysis = analyzeLabConsolidation(patientId);
  if (!analysis.autoMergeCount && !analysis.outlierGroups.length) {
    rt.showToast('No hay grupos del mismo día y tipo homogéneo para fusionar', 'success');
    return;
  }

  function applyConsolidation(outlierKeys) {
    if (typeof rt.pushUndoSnapshot === 'function') {
      rt.pushUndoSnapshot('Consolidar historial de labs por día y tipo');
    }
    var result = runLabConsolidationForPatient(patientId, outlierKeys);
    syncLabHistoryConsolidationToLan(patientId, result);
    finishLabConsolidateUi(patientId, result.merged);
  }

  if (!analysis.outlierGroups.length) {
    if (
      !confirm(
        '¿Consolidar el historial por día?\n\n' +
          'R+ fusionará envíos del mismo día y tipo (solo labs o solo cultivos) si están a ≤2 h entre sí.\n\n' +
          'Se conserva la entrada más antigua; las líneas idénticas se guardan una sola vez.'
      )
    ) {
      return;
    }
    applyConsolidation(null);
    return;
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop';
  backdrop.id = 'lab-consolidate-backdrop';
  backdrop.innerHTML = buildLabConsolidateModalHtml({
    autoMergeCount: analysis.autoMergeCount,
    outlierGroups: analysis.outlierGroups,
    dayLabelFromKey: dayLabelFromDayKey,
  });
  document.body.appendChild(backdrop);
  wireLabConsolidateModal(backdrop, applyConsolidation);
}
export {
  findDisplayLabHistorySetId,
  autoConsolidateLabHistoryForPatient,
  openLabHistoryDedupeReview,
  consolidateLabHistoryByDayAndTipo,
};
