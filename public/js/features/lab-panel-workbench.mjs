import { esc } from '../dom-escape.mjs';
// Lab panel — workbench: limpiar, enviar, bulk paste storage
import { closeLabSomeTablesModal } from './lab-some-tables-modal.mjs';
import {
  LAB_BULK_PATIENT_SEPARATOR,
} from '../lab-bulk-paste.mjs';
import { sortLabHistoryChronological, normalizeFechaLabHistory } from '../tend-core.mjs';
import { patients, notes, saveState } from '../app-state.mjs';
import { rt } from './lab-panel-runtime-state.mjs';
import { labPanelBridge } from './lab-panel-bridge.mjs';
import {
  renderLabHistoryPanel,
  maybeShowLabHistoryForActivePatient,
} from './lab-panel-history.mjs';
import { pushLabHistory, finalizeLabHistoryImport } from './lab-panel-workbench-store.mjs';
import {
  filterProcessableBulkBlocks,
  storeProcessableBulkBlocks,
  toastNoMatchingPatients,
  resolveBulkDisplayPick,
  applyBulkLabPatientSwitch,
  syncBulkLabHistorySelection,
  showBulkLabPasteSummaryToast,
  notifyTourAfterBulkLabStore,
  isMultiBulkLabPaste,
} from './lab-panel-workbench-finalize.mjs';

function clearLabInputAfterSuccessfulParse() {
  var ta = document.getElementById('lab-input');
  if (!ta) return;
  ta.value = '';
  try {
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (_e) { void _e; }
}

export function limpiarReporte() {
  document.getElementById('lab-input').value = '';
  document.getElementById('lab-banner').style.display = 'none';
  document.getElementById('lab-diagrams-section').style.display = 'none';
  document.getElementById('diagrams-grid').innerHTML = '';
  document.getElementById('lab-output-box').innerHTML = '';
  labPanelBridge.setActiveLab(null);
  closeLabSomeTablesModal();
  maybeShowLabHistoryForActivePatient({ forceReload: true });
}

function openLabPatientPicker() {
  var overlay = document.createElement('div');
  overlay.id = 'lab-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
  var box = document.createElement('div');
  box.style.cssText = 'background:#1f2937;border-radius:10px;padding:20px;min-width:260px;max-width:360px;width:90%;';
  var title = document.createElement('div');
  title.textContent = '¿A qué paciente enviar los labs?';
  title.style.cssText = 'color:#f9fafb;font-size:14px;font-weight:600;margin-bottom:14px;';
  box.appendChild(title);
  patients.forEach(function(p) {
    var btn = document.createElement('button');
    btn.textContent = p.nombre + (p.registro ? '  •  ' + p.registro : '');
    btn.style.cssText = 'display:block;width:100%;text-align:left;background:#374151;color:#f3f4f6;border:none;border-radius:6px;padding:10px 12px;margin-bottom:8px;cursor:pointer;font-size:13px;';
    btn.onmouseenter = function(){ this.style.background='#4b5563'; };
    btn.onmouseleave = function(){ this.style.background='#374151'; };
    btn.onclick = function() {
      document.body.removeChild(overlay);
      rt.selectPatient(p.id);
      enviarLabsANota();
    };
    box.appendChild(btn);
  });
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'display:block;width:100%;background:transparent;color:#9ca3af;border:1px solid #374151;border-radius:6px;padding:8px;cursor:pointer;font-size:13px;margin-top:4px;';
  cancelBtn.onclick = function() { document.body.removeChild(overlay); };
  box.appendChild(cancelBtn);
  overlay.appendChild(box);
  overlay.onclick = function(e){ if(e.target===overlay) document.body.removeChild(overlay); };
  document.body.appendChild(overlay);
}

async function copiarLabsAlPortapapeles() {
  var activeLab = labPanelBridge.getActiveLab();
  if (!activeLab || !activeLab.resLabs || !activeLab.resLabs.length) {
    rt.showToast('No hay resultados procesados', 'error'); return;
  }
  var text = buildLabLines().join('\n');
  var ok = await rt.copyToClipboardSafe(text);
  rt.showToast(
    ok ? 'Labs copiados al portapapeles ✓' : 'Error al copiar al portapapeles',
    ok ? 'success' : 'error'
  );
}

export function enviarLabsANota() {
  var activeLab = labPanelBridge.getActiveLab();
  if (!activeLab || !activeLab.resLabs || !activeLab.resLabs.length) {
    rt.showToast('No hay resultados procesados', 'error'); return;
  }
  if (!rt.getActiveId()) {
    if (!patients.length) { rt.showToast('Agrega un paciente primero', 'error'); return; }
    if (patients.length === 1) { rt.selectPatient(patients[0].id); }
    else { openLabPatientPicker(); return; }
  }
  checkStudiosAndInsertLabs();
}

// ── Multilab ──────────────────────────────────────────────────────
function buildLabLines() {
  var lines = [];
  var prefs = rt.getLabOutputPrefs();
  var activeLab = labPanelBridge.getActiveLab();
  if (activeLab && activeLab.patient) {
    var raw = activeLab.patient.fecha || '';
    var fechaDm = normalizeFechaLabHistory(raw) || String(raw).trim();
    if (fechaDm === 'Anterior') fechaDm = '';
    if (!fechaDm && raw) {
      var mesesMap = {ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12',jan:'01',apr:'04',aug:'08',dec:'12'};
      var mFechaLab = raw.trim().match(/([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
      var monNum = mFechaLab && mesesMap[mFechaLab[1].toLowerCase().slice(0, 3)];
      if (monNum) fechaDm = mFechaLab[2].padStart(2, '0') + '/' + monNum + '/' + mFechaLab[3];
    }
    if (fechaDm) {
      lines.push(fechaDm.length >= 5 && fechaDm.indexOf('/') !== -1 ? fechaDm.slice(0, 5) : fechaDm);
    }
  }
  var bhExtDone = false;
  activeLab.resLabs.forEach(function(entry) {
    if (prefs.hideGasoAdvInterp && rt.isGasoInterpretacionResLabChunk(entry)) return;
    if (rt.isCitoquimInterpretacionResLabChunk && rt.isCitoquimInterpretacionResLabChunk(entry)) return;
    if (rt.isAscitisInterpretacionResLabChunk(entry)) return;
    entry.split(/\r?\n/).forEach(function(subline) {
      var cleaned = subline.replace(/\t/g, ' ').replace(/  +/g, ' ').trim();
      if (cleaned) lines.push(cleaned);
    });
    if (prefs.showBhExtendedLine && !bhExtDone && activeLab.bhExtras && rt.isBhMainResLabChunk(entry)) {
      var extPlain = rt.formatBhExtendedTabLine(activeLab.bhExtras, activeLab.sourceText);
      if (extPlain) {
        extPlain.split(/\r?\n/).forEach(function(subline) {
          var cleanedExt = subline.replace(/\t/g, ' ').replace(/  +/g, ' ').trim();
          if (cleanedExt) lines.push(cleanedExt);
        });
        bhExtDone = true;
      }
    }
  });
  return lines;
}


function checkStudiosAndInsertLabs() {
  var lines = buildLabLines();
  var history = sortLabHistoryChronological(rt.ensureParsedLabHistory(rt.getActiveId()));
  var recentDate = history.length ? rt.buildLabSetDateLine(history[0]) : '';
  if (!history.length) {
    insertLabsAsRecent(lines);
  } else {
    showLabConflictModal(lines, recentDate);
  }
}


export function insertLabPatientSeparator() {
  var ta = document.getElementById('lab-input');
  if (!ta) return;
  var val = ta.value;
  var start = typeof ta.selectionStart === 'number' ? ta.selectionStart : val.length;
  var end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : start;
  var before = val.slice(0, start);
  var after = val.slice(end);
  var insert = LAB_BULK_PATIENT_SEPARATOR;
  if (before && !before.endsWith('\n')) insert = '\n' + insert;
  insert += '\n';
  ta.value = before + insert + after;
  var pos = before.length + insert.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
}


/**
 * Alinea el paciente activo con el expediente del reporte pegado.
 * @see docs/superpowers/specs/2026-05-03-lab-auto-switch-active-patient-design.md
 * @returns {{ shouldAutoStore: boolean }}
 */
function applyLabPastePatientResolution(result) {
  if (!result || !result.patient) return { shouldAutoStore: true };
  var reg = String(result.patient.expediente || '').trim();
  if (!reg) return { shouldAutoStore: true };
  var match = rt.findPatientByRegistro(reg);
  if (!match) {
    if (!rt.getLabOutputPrefs().quickLabOutput) {
      rt.showToast(
        'Registro ' + reg + ' no está en la lista. No se guardó en el historial.',
        'error'
      );
    }
    return { shouldAutoStore: false };
  }
  if (match.id !== rt.getActiveId()) {
    rt.selectPatient(match.id);
    rt.showToast('Paciente: ' + (match.nombre || 'Sin nombre') + ' · Exp ' + reg, 'success');
    rt.addAuditEntry('lab-patient-auto-switch', 'ok', 1, reg);
  }
  return { shouldAutoStore: true };
}


function insertLabsAsRecent(_lines) {
  var activeLab = labPanelBridge.getActiveLab();
  if (!notes[rt.getActiveId()]) notes[rt.getActiveId()] = {};
  pushLabHistory(
    rt.getActiveId(),
    activeLab.resLabs,
    activeLab.patient && activeLab.patient.fecha ? activeLab.patient.fecha : '',
    activeLab.patient && activeLab.patient.hora ? activeLab.patient.hora : '',
    activeLab.sourceText || '',
    activeLab.bhExtras,
    activeLab.refsBySection
  );
  finalizeLabHistoryImport(rt.getActiveId());
  saveState({ immediate: true });
  rt.refreshTendenciasOrCultivosPanel();
  renderLabHistoryPanel();
  var el = document.querySelector('#note-form textarea[oninput*="estudios"]');
  if (el) el.value = notes[rt.getActiveId()].estudios;
  rt.onboardingAdvanceAfterSend();
  rt.showToast('Labs enviados a la nota ✓', 'success');
  rt.setMedTabAttention(true);
  rt.openPaseSectionInNormal('expediente');
}

function insertLabsAsAnteriorThenRecent(_newLines) {
  var activeLab = labPanelBridge.getActiveLab();
  if (!notes[rt.getActiveId()]) notes[rt.getActiveId()] = {};
  pushLabHistory(
    rt.getActiveId(),
    activeLab.resLabs,
    activeLab.patient && activeLab.patient.fecha ? activeLab.patient.fecha : '',
    activeLab.patient && activeLab.patient.hora ? activeLab.patient.hora : '',
    activeLab.sourceText || '',
    activeLab.bhExtras,
    activeLab.refsBySection
  );
  finalizeLabHistoryImport(rt.getActiveId());
  saveState({ immediate: true });
  rt.refreshTendenciasOrCultivosPanel();
  renderLabHistoryPanel();
  var el = document.querySelector('#note-form textarea[oninput*="estudios"]');
  if (el) el.value = notes[rt.getActiveId()].estudios;
  rt.onboardingAdvanceAfterSend();
  rt.showToast('Fecha anterior guardada + nuevos labs agregados ✓', 'success');
  rt.setMedTabAttention(true);
  rt.openPaseSectionInNormal('expediente');
}

function showLabConflictModal(newLines, existingDate) {
  var backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop';
  backdrop.id = 'lab-conflict-backdrop';
  backdrop.innerHTML = (
    '<div class="lab-conflict-modal">' +
    '<h3>Los estudios ya tienen datos</h3>' +
    '<p>El bloque reciente ya tiene labs del <strong>' + esc(existingDate) + '</strong>. ¿Qué hago con los nuevos labs?</p>' +
    '<div class="lab-conflict-actions">' +
    '<button class="btn-conflict-primary" id="btn-conflict-move">📋 Mover anterior + agregar reciente<br><span style="font-size:11px;font-weight:400;opacity:0.8;">Los labs actuales pasan al bloque anterior y los nuevos quedan como recientes</span></button>' +
    '<button class="btn-conflict-secondary" id="btn-conflict-replace">🔄 Reemplazar fecha reciente<br><span style="font-size:11px;font-weight:400;opacity:0.7;">Los labs actuales se borran, se escriben los nuevos</span></button>' +
    '<button class="btn-conflict-cancel" id="btn-conflict-cancel">Cancelar</button>' +
    '</div></div>'
  );
  document.body.appendChild(backdrop);
  document.getElementById('btn-conflict-move').onclick = function() {
    document.body.removeChild(backdrop);
    insertLabsAsAnteriorThenRecent(newLines);
  };
  document.getElementById('btn-conflict-replace').onclick = function() {
    document.body.removeChild(backdrop);
    var activeLab = labPanelBridge.getActiveLab();
    if (!notes[rt.getActiveId()]) notes[rt.getActiveId()] = {};
    pushLabHistory(
      rt.getActiveId(),
      activeLab.resLabs,
      activeLab.patient && activeLab.patient.fecha ? activeLab.patient.fecha : '',
      activeLab.patient && activeLab.patient.hora ? activeLab.patient.hora : '',
      activeLab.sourceText || '',
      activeLab.bhExtras,
      activeLab.refsBySection
    );
    finalizeLabHistoryImport(rt.getActiveId());
    saveState({ immediate: true });
    rt.refreshTendenciasOrCultivosPanel();
    renderLabHistoryPanel();
    var el = document.querySelector('#note-form textarea[oninput*="estudios"]');
    if (el) el.value = notes[rt.getActiveId()].estudios;
    rt.onboardingAdvanceAfterSend();
    rt.showToast('Fecha reciente reemplazada ✓', 'success');
    rt.setMedTabAttention(true);
    rt.openPaseSectionInNormal('expediente');
  };
  document.getElementById('btn-conflict-cancel').onclick = function() {
    document.body.removeChild(backdrop);
  };
}

function toastCitoquimInterpFromResult(result) {
  if (!result || !result.resLabs || !result.resLabs.length) return;
  result.resLabs.forEach(function (chunk) {
    var isInterp =
      (rt.isCitoquimInterpretacionResLabChunk && rt.isCitoquimInterpretacionResLabChunk(chunk)) ||
      rt.isAscitisInterpretacionResLabChunk(chunk);
    if (!isInterp) return;
    var msg = rt.citoquimInterpretacionBody_
      ? rt.citoquimInterpretacionBody_(chunk)
      : rt.ascitisInterpretacionBody_(chunk);
    if (msg) rt.showToast(msg, 'warn');
  });
}

function finalizeBulkLabPaste(text, blocks, totalOkReports) {
  var quickOut = rt.getLabOutputPrefs().quickLabOutput;
  var processable = filterProcessableBulkBlocks(blocks);
  var storeSummary = processable.length
    ? storeProcessableBulkBlocks(blocks, processable)
    : { storedSets: 0, skippedDupes: 0, skippedBlocks: blocks.length - processable.length };

  if (!processable.length) toastNoMatchingPatients(blocks, quickOut);

  var displayPick = resolveBulkDisplayPick(blocks, processable, text);
  if (!displayPick || !displayPick.result) {
    rt.showToast('No se pudo interpretar el laboratorio pegado', 'error');
    notifyTourAfterBulkLabStore(blocks, processable.length > 0);
    return;
  }

  var displayResult = displayPick.result;
  displayResult.sourceText = displayPick.reportText || text;
  applyBulkLabPatientSwitch(displayPick, displayResult, processable, applyLabPastePatientResolution);

  labPanelBridge.renderOutput(displayResult);
  toastCitoquimInterpFromResult(displayResult);
  rt.renderDiagramas(displayResult.resLabs);
  syncBulkLabHistorySelection(rt.getActiveId(), displayResult, processable);

  showBulkLabPasteSummaryToast(
    isMultiBulkLabPaste(blocks, totalOkReports, processable),
    storeSummary,
    processable,
    blocks,
    quickOut,
    displayResult
  );

  clearLabInputAfterSuccessfulParse();
  notifyTourAfterBulkLabStore(blocks, true);
}

export { finalizeBulkLabPaste, clearLabInputAfterSuccessfulParse, openLabPatientPicker, copiarLabsAlPortapapeles };
