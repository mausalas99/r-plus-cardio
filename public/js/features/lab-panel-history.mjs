import { esc } from '../dom-escape.mjs';
// Lab panel — historial, dedupe, consolidación
import {
  procesarLabs,
  reprocessLabResultLines_,
  refreshCitoquimicoInterpretacionInResLabs_,
  resLabsHasCitoquimFluid_,
} from '../labs.js';
import { dedupeConsolidatedLabRows } from '../lab-bulk-paste.mjs';
import { sortLabHistoryChronological } from '../tend-core.mjs';
import { normalizeLabHistoryPatientSets } from '../storage.js';
import { patients, labHistory, saveState } from '../app-state.mjs';
import { bumpLabHistoryRevision, getLabHistoryRevision } from '../lab-history-cache.mjs';
import { syncLabHistoryDeletesToLan } from '../lab-history-lan-sync.mjs';
import { isPaseMode } from './chrome.mjs';
import { rt } from './lab-panel-runtime-state.mjs';
import { labPanelBridge } from './lab-panel-bridge.mjs';




export function setLabHistoryPanelCollapsed() {}

export function syncLabHistoryCollapseUI() {}

function labHistoryPanelIsCollapsed() {
  return false;
}

function toggleLabHistoryPanel() {}

function findLabHistorySetByRef(sets, setId) {
  var sid = String(setId == null ? '' : setId);
  if (sid.indexOf('__idx_') === 0) {
    var idx = parseInt(sid.slice(6), 10);
    if (Number.isFinite(idx) && idx >= 0 && idx < sets.length) return sets[idx];
    return null;
  }
  return sets.find(function (s) { return String(s.id) === sid; }) || null;
}

export function dedupeConsolidatedRowsBySection(rows, tipo) {
  return dedupeConsolidatedLabRows(rows, tipo);
}

var _labHistorySelectedSetId = Object.create(null);
var _labHistoryDateSelectCacheKey = "";

export function expandLabHistoryList() {}

function labSetIdForHistory(set, idx) {
  return set.id != null && String(set.id).trim() !== '' ? String(set.id) : '__idx_' + idx;
}

function getActivePatientLabHistory() {
  var pid = rt.getActiveId();
  if (!pid) return [];
  return sortLabHistoryChronological(
    rt.ensureParsedLabHistoryCached
      ? rt.ensureParsedLabHistoryCached(pid)
      : rt.ensureParsedLabHistory(pid, { readOnly: true })
  );
}

function getLabHistorySelectedSetId(pid, hist) {
  if (!pid || !hist.length) return '';
  var sel = _labHistorySelectedSetId[pid];
  if (sel && hist.some(function (s, i) { return labSetIdForHistory(s, i) === sel; })) return sel;
  return labSetIdForHistory(hist[0], 0);
}

function syncLabHistoryDateSelect(opts) {
  var selectEl = document.getElementById('lab-history-date-select');
  var hintEl = document.getElementById('lab-output-history-hint');
  var moreMenu = document.querySelector('.lab-output-more');
  if (!selectEl) return '';
  var pid = rt.getActiveId();
  if (!pid) {
    _labHistoryDateSelectCacheKey = '';
    selectEl.hidden = true;
    selectEl.innerHTML = '';
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.textContent =
        'Selecciona un paciente en la columna izquierda para ver los estudios guardados.';
    }
    if (moreMenu) moreMenu.hidden = true;
    return '';
  }
  var hist = getActivePatientLabHistory();
  var cacheKey = String(pid) + '|L' + getLabHistoryRevision(pid) + '|N' + hist.length;
  if (!hist.length) {
    _labHistoryDateSelectCacheKey = cacheKey;
    selectEl.hidden = true;
    selectEl.innerHTML = '';
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.textContent =
        'Al procesar un reporte con paciente activo, cada conjunto queda guardado aquí (sirve para Tendencias y diagramas).';
    }
    if (moreMenu) moreMenu.hidden = true;
    return '';
  }
  if (hintEl) hintEl.style.display = 'none';
  if (moreMenu) moreMenu.hidden = false;
  var selectedId = getLabHistorySelectedSetId(pid, hist);
  if (opts && opts.preferSetId) selectedId = opts.preferSetId;
  _labHistorySelectedSetId[pid] = selectedId;
  if (_labHistoryDateSelectCacheKey !== cacheKey) {
    var labelCounts = Object.create(null);
    hist.forEach(function (set) {
      var lb = rt.formatLabHistoryDateSelectLabel(set);
      labelCounts[lb] = (labelCounts[lb] || 0) + 1;
    });
    var labelSeen = Object.create(null);
    var options = hist
      .map(function (set, idx) {
        var sid = labSetIdForHistory(set, idx);
        var label = rt.formatLabHistoryDateSelectLabel(set);
        if (labelCounts[label] > 1) {
          labelSeen[label] = (labelSeen[label] || 0) + 1;
          label += ' (' + labelSeen[label] + ')';
        }
        return { sid: sid, label: label, idx: idx };
      })
      .reverse();
    selectEl.innerHTML = options
      .map(function (row) {
        return (
          '<option value="' +
          esc(row.sid) +
          '"' +
          (row.sid === selectedId ? ' selected' : '') +
          '>' +
          esc(row.label) +
          '</option>'
        );
      })
      .join('');
    _labHistoryDateSelectCacheKey = cacheKey;
  } else if (selectEl.value !== selectedId) {
    selectEl.value = selectedId;
  }
  selectEl.hidden = false;
  return selectedId;
}

function buildLabHistoryReplayResult_(set) {
  const patient = patients.find(function (p) { return p.id === rt.getActiveId(); });
  const name = patient ? patient.nombre || '' : '';
  const reg = patient ? patient.registro || '' : '';
  return {
    patient: { name: name, expediente: reg, sexo: '', edad: '', fecha: set.fecha || '' },
    resLabs: set.resLabs,
    sourceText: set.sourceText || '',
    bhExtras: set.bhExtras,
    refsBySection: set.refsBySection,
  };
}

function announceLabHistoryReplay_(setId) {
  rt.addAuditEntry('lab-history-replay', 'ok', 1, String(setId));
  rt.showToast('Estudio cargado en Laboratorio', 'success');
  const outSec = document.getElementById('lab-output-section');
  if (!outSec || outSec.style.display === 'none') return;
  try {
    outSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch {
    outSec.scrollIntoView(true);
  }
}

function loadLabHistorySetIntoOutput(setId, opts) {
  if (!rt.getActiveId()) return false;
  const hist = getActivePatientLabHistory();
  const set = findLabHistorySetByRef(hist, setId);
  if (!set || !set.resLabs || !set.resLabs.length) return false;
  labPanelBridge.renderOutput(buildLabHistoryReplayResult_(set), {
    fromHistory: true,
    silent: !!(opts && opts.silent),
  });
  rt.renderDiagramas(set.resLabs);
  if (!(opts && opts.silent)) announceLabHistoryReplay_(setId);
  return true;
}

function maybeShowLabHistoryForActivePatient(opts) {
  var pid = rt.getActiveId();
  if (!pid) return;
  var selectedId = syncLabHistoryDateSelect(opts);
  if (!selectedId) {
    if (!labPanelBridge.getActiveLab()) {
      var sec = document.getElementById('lab-output-section');
      if (sec) sec.style.display = 'none';
      labPanelBridge.syncLabOutputChrome();
    }
    return;
  }
  if (labPanelBridge.getActiveLab() && !(opts && opts.forceReload)) return;
  loadLabHistorySetIntoOutput(selectedId, { silent: true });
}

export function renderLabHistoryPanel() {
  var selectedId = syncLabHistoryDateSelect();
  if (selectedId && !labPanelBridge.getActiveLab()) {
    loadLabHistorySetIntoOutput(selectedId, { silent: true });
  } else if (!selectedId && !labPanelBridge.getActiveLab()) {
    var sec = document.getElementById('lab-output-section');
    if (sec) sec.style.display = 'none';
    labPanelBridge.syncLabOutputChrome();
  }
  rt.renderRoundOverviewPanels();
  if (isPaseMode()) rt.renderPaseBoard();
}

function onLabHistoryDateChange(setId) {
  var pid = rt.getActiveId();
  if (pid && setId) _labHistorySelectedSetId[pid] = setId;
  loadLabHistorySetIntoOutput(setId, { silent: true });
}

function reprocessSelectedLabHistorySet() {
  var selectEl = document.getElementById('lab-history-date-select');
  if (!selectEl || selectEl.hidden || !selectEl.value) {
    rt.showToast('No hay estudio seleccionado', 'error');
    return;
  }
  reprocessLabHistorySet(selectEl.value);
}

function deleteSelectedLabHistorySet() {
  var selectEl = document.getElementById('lab-history-date-select');
  if (!selectEl || selectEl.hidden || !selectEl.value) {
    rt.showToast('No hay estudio seleccionado', 'error');
    return;
  }
  deleteLabHistorySet(selectEl.value);
}

function deleteAllLabHistorySets() {
  var pid = rt.getActiveId();
  if (!pid) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var sets = normalizeLabHistoryPatientSets(labHistory[pid]);
  if (!sets.length) {
    rt.showToast('No hay estudios en el historial', 'info');
    return;
  }
  var removedIds = sets.map(function (s) {
    return String(s.id);
  }).filter(Boolean);
  if (
    !confirm(
      '¿Eliminar todos los estudios de laboratorio de este paciente?\n\n' +
        'Se borrarán ' +
        sets.length +
        ' conjunto' +
        (sets.length === 1 ? '' : 's') +
        ' del historial. Las tendencias y diagramas se recalcularán.'
    )
  ) {
    return;
  }
  delete labHistory[pid];
  bumpLabHistoryRevision(pid);
  syncLabHistoryDeletesToLan(pid, removedIds);
  saveState({ immediate: true });
  rt.addAuditEntry('lab-history-delete-all', 'ok', sets.length, String(pid));
  labPanelBridge.setActiveLab(null);
  clearLabHistoryDateSelectCache();
  _labHistorySelectedSetId[pid] = '';
  rt.rebuildEstudiosFromLabHistory(pid);
  renderLabHistoryPanel();
  rt.refreshTendenciasOrCultivosPanel();
  rt.showToast('Historial de laboratorio borrado', 'success');
}

function replayLabHistorySet(setId) {
  if (!rt.getActiveId()) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  _labHistorySelectedSetId[rt.getActiveId()] = String(setId || '');
  var selectEl = document.getElementById('lab-history-date-select');
  if (selectEl && !selectEl.hidden) selectEl.value = String(setId || '');
  if (!loadLabHistorySetIntoOutput(setId)) {
    rt.showToast('No se encontró ese estudio', 'error');
    return;
  }
  rt.openPaseSectionInNormal('labs');
}

function collectReprocessSourceParts_(set, ctx) {
  const srcParts = [];
  if (set.sourceText && String(set.sourceText).trim()) srcParts.push(String(set.sourceText).trim());
  (ctx.extraSourceTexts || []).forEach(function (t) {
    if (t && srcParts.indexOf(t) === -1) srcParts.push(t);
  });
  return srcParts;
}

function chartPatientForActiveId_() {
  const patientId = rt.getActiveId();
  if (!patientId) return null;
  return patients.find(function (p) {
    return String(p.id) === String(patientId);
  }) || null;
}

function reprocessLabSetResLabs_(set, ctx) {
  const srcParts = collectReprocessSourceParts_(set, ctx);
  let repro;
  if (srcParts.length) {
    const mergedSrc = srcParts.join('\n\n---\n\n');
    const chartPatient = chartPatientForActiveId_();
    const parsed = procesarLabs(mergedSrc, chartPatient ? { patient: chartPatient } : undefined);
    repro = reprocessLabResultLines_(parsed.resLabs || [], {
      gasRefs: parsed.refsBySection && parsed.refsBySection.GASES,
    });
    if (parsed.bhExtras && typeof parsed.bhExtras === 'object') {
      set.bhExtras = Object.assign({}, set.bhExtras || {}, parsed.bhExtras);
    }
  } else {
    repro = reprocessLabResultLines_(set.resLabs, {
      gasRefs: set.refsBySection && set.refsBySection.GASES,
    });
  }
  return repro;
}

function finalizeReprocessedLabSet_(set, repro, setId) {
  set.resLabs = repro.slice();
  refreshSameDayAscitisForPatient(rt.getActiveId(), set.id);
  set.parsed = rt.extractParsedValues(set.resLabs);
  set.parsedBySection = rt.buildParsedBySectionFromResLabs(set.resLabs, set.bhExtras);
  delete set._parseFingerprint;
  bumpLabHistoryRevision(rt.getActiveId());
  rt.rebuildEstudiosFromLabHistory(rt.getActiveId());
  saveState({ immediate: true });
  renderLabHistoryPanel();
  rt.refreshTendenciasOrCultivosPanel();
  replayLabHistorySet(setId);
  rt.addAuditEntry('lab-history-reprocess', 'ok', 1, String(setId));
  rt.showToast('Estudio reprocesado desde resultados ✓', 'success');
}

function reprocessLabHistorySet(setId) {
  if (!rt.getActiveId()) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  const sets = normalizeLabHistoryPatientSets(labHistory[rt.getActiveId()]);
  const set = findLabHistorySetByRef(sets, setId);
  if (!set) {
    rt.showToast('No se encontró ese estudio', 'error');
    return;
  }
  if (!set.resLabs || !set.resLabs.length) {
    rt.showToast('Este estudio no tiene resultados para reprocesar', 'error');
    return;
  }
  try {
    const ctx = buildSameDaySerumContext(rt.getActiveId(), set);
    const rawRepro = reprocessLabSetResLabs_(set, ctx);
    if (!rawRepro || !rawRepro.length) {
      rt.showToast('No se pudieron regenerar resultados desde el bloque guardado', 'error');
      return;
    }
    const repro = refreshCitoquimicoInterpretacionInResLabs_(rawRepro, set.sourceText || '', ctx);
    finalizeReprocessedLabSet_(set, repro, setId);
  } catch {
    rt.showToast('Error al reprocesar este estudio', 'error');
  }
}

function deleteLabHistorySet(setId) {
  var pid = rt.getActiveId();
  if (!pid) return;
  var sets = normalizeLabHistoryPatientSets(labHistory[pid]);
  if (!sets.length) return;
  if (!confirm('¿Eliminar este conjunto del historial? Las tendencias se recalcularán.')) return;
  var sid = String(setId == null ? '' : setId);
  if (sid.indexOf('__idx_') === 0) {
    var idx = parseInt(sid.slice(6), 10);
    if (Number.isFinite(idx) && idx >= 0 && idx < sets.length) sets.splice(idx, 1);
  } else {
    sets = sets.filter(function (s) { return String(s.id) !== sid; });
  }
  if (sets.length) labHistory[pid] = sets;
  else delete labHistory[pid];
  bumpLabHistoryRevision(pid);
  if (sid.indexOf('__idx_') !== 0) {
    syncLabHistoryDeletesToLan(pid, [sid]);
  }
  saveState({ immediate: true });
  rt.addAuditEntry('lab-history-delete', 'ok', 1, String(setId));
  labPanelBridge.setActiveLab(null);
  renderLabHistoryPanel();
  rt.refreshTendenciasOrCultivosPanel();
  rt.showToast('Eliminado del historial', 'success');
}



function buildSameDaySerumContext(patientId, targetSet) {
  if (!patientId || !targetSet) return {};
  var dk = rt.dayKeyFromLabSet(targetSet);
  if (!dk || dk === 'unknown' || dk === 'Anterior') return {};
  var sets = labHistory[patientId] || [];
  var extraSourceTexts = [];
  var extraResLabs = [];
  sets.forEach(function (other) {
    if (!other || String(other.id) === String(targetSet.id)) return;
    if (rt.dayKeyFromLabSet(other) !== dk) return;
    if (rt.primaryTipoForLabSet(other.resLabs || []) === 'cultivo') return;
    var src = String(other.sourceText || '').trim();
    if (src) extraSourceTexts.push(src);
    if (other.resLabs && other.resLabs.length) extraResLabs.push(other.resLabs);
  });
  return { extraSourceTexts: extraSourceTexts, extraResLabs: extraResLabs };
}

export function refreshSameDayAscitisForPatient(patientId, triggerSetId) {
  if (!patientId) return false;
  var sets = labHistory[patientId];
  if (!Array.isArray(sets) || !sets.length) return false;
  var trigger =
    triggerSetId != null
      ? sets.find(function (s) {
          return s && String(s.id) === String(triggerSetId);
        })
      : null;
  var dayKeys = Object.create(null);
  if (trigger) {
    var tdk = rt.dayKeyFromLabSet(trigger);
    if (tdk && tdk !== 'unknown' && tdk !== 'Anterior') dayKeys[tdk] = true;
  } else {
    sets.forEach(function (s) {
      var dk = rt.dayKeyFromLabSet(s);
      if (dk && dk !== 'unknown' && dk !== 'Anterior') dayKeys[dk] = true;
    });
  }
  var changed = false;
  Object.keys(dayKeys).forEach(function (dk) {
    sets.forEach(function (set) {
      if (!set || rt.dayKeyFromLabSet(set) !== dk) return;
      var src = String(set.sourceText || '').trim();
      var hasCitoquim =
        resLabsHasCitoquimFluid_(set.resLabs) ||
        (src && /\bCITOQUIMICO\b/i.test(src));
      if (!hasCitoquim) return;
      var ctx = buildSameDaySerumContext(patientId, set);
      var next = refreshCitoquimicoInterpretacionInResLabs_(set.resLabs || [], src, ctx);
      var prevStr = '';
      var nextStr = '';
      try {
        prevStr = JSON.stringify(set.resLabs || []);
        nextStr = JSON.stringify(next);
      } catch {
        set.resLabs = next;
        changed = true;
        return;
      }
      if (prevStr !== nextStr) {
        set.resLabs = next;
        set.parsed = rt.extractParsedValues(next);
        set.parsedBySection = rt.buildParsedBySectionFromResLabs(next, set.bhExtras);
        delete set._parseFingerprint;
        changed = true;
      }
    });
  });
  return changed;
}

export function clearLabHistoryDateSelectCache() {
  _labHistoryDateSelectCacheKey = '';
}

export function setLabHistorySelectedSetId(pid, setId) {
  if (pid && setId) _labHistorySelectedSetId[pid] = setId;
}

export { labSetIdForHistory };

export {
  getActivePatientLabHistory,
  syncLabHistoryDateSelect,
  loadLabHistorySetIntoOutput,
  maybeShowLabHistoryForActivePatient,
  buildSameDaySerumContext,
  onLabHistoryDateChange,
  reprocessSelectedLabHistorySet,
  deleteSelectedLabHistorySet,
  deleteAllLabHistorySets,
  replayLabHistorySet,
  reprocessLabHistorySet,
  deleteLabHistorySet,
  labHistoryPanelIsCollapsed,
  toggleLabHistoryPanel,
};
