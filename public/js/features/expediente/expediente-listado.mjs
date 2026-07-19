// Listado de problemas UI + docx export
import {
  listadoProblemas,
  patients,
  saveState,
} from '../../app-state.mjs';
import { setAsyncButtonLoading } from '../../ui-motion.mjs';
import {
  exportWithOutputDirFallback,
  guardDocExportBlocked,
  syncApprovedOutputDir,
} from '../../document-export-client.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';
import {
  emptyListado,
  addProblema as listadoAddProblema,
  removeProblema as listadoRemoveProblema,
} from '../../listado-problemas-core.mjs';
import { LISTADO_PROBLEMAS_AI_PROMPT } from '../../listado-problemas-ai-prompt.mjs';
import { isHideListadoProblemasAiPromptEnabled } from '../profile.mjs';
import { rt, aid, esc } from './expediente-runtime.mjs';

var _listadoSortables = [];

function getMedicosForListado(lst) {
  var tpl = (rt.getSettings() || {}).medicosPlantilla || {};
  var override = (lst && lst.medicos) || {};
  function pick(k) { return (override[k] && override[k].trim()) ? override[k] : (tpl[k] || ''); }
  return {
    profesor: pick('profesor'),
    r4:       pick('r4'),
    r2:       pick('r2'),
    r1a:      pick('r1a'),
    r1b:      pick('r1b'),
  };
}

function updateListadoMedico(field, value) {
  var lst = ensureListadoForActive(); if (!lst) return;
  if (!lst.medicos) lst.medicos = {};
  lst.medicos[field] = value;
  saveState();
}

// ── Listado sala ─────────────────────────────────────────────────────-
// Listado de Problemas (Task 8) — UI completa con drag-and-drop y autosave.
function _todayDDMMYYYY() {
  var d = new Date();
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function _nowHHMM() {
  var d = new Date();
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function ensureListadoForActive() {
  if (!aid()) return null;
  if (!listadoProblemas[aid()]) {
    listadoProblemas[aid()] = emptyListado(_todayDDMMYYYY(), _nowHHMM());
  }
  // Defensive: ensure arrays exist (en caso de datos corruptos).
  var l = listadoProblemas[aid()];
  if (!Array.isArray(l.activos)) l.activos = [];
  if (!Array.isArray(l.inactivos)) l.inactivos = [];
  return l;
}
function _autoGrowTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 240) + 'px';
}

function bindListadoTextareaPointerIsolation(root) {
  var scope = root || document;
  scope.querySelectorAll('.listado-row textarea').forEach(function (ta) {
    if (ta.dataset.listadoPointerBound === '1') return;
    ta.dataset.listadoPointerBound = '1';
    ['mousedown', 'touchstart', 'pointerdown'].forEach(function (type) {
      ta.addEventListener(type, function (e) {
        e.stopPropagation();
      });
    });
  });
}
function _renderListadoRow(seccion, p, idx) {
  return (
    '<div class="listado-row" data-id="' + esc(p.id) + '" data-seccion="' + seccion + '">' +
      '<div class="listado-num listado-drag-handle" title="Arrastra para reordenar" aria-label="Arrastrar para reordenar">' + (idx + 1) + '</div>' +
      '<input type="date" class="rpc-date-input" value="' + esc(p.fecha || '') + '" oninput="updateProblemaField(\'' + seccion + '\',\'' + esc(p.id) + '\',\'fecha\',this.value)" aria-label="Fecha del problema">' +
      '<textarea rows="1" placeholder="Descripción del problema" oninput="updateProblemaField(\'' + seccion + '\',\'' + esc(p.id) + '\',\'descripcion\',this.value); _autoGrowTextarea(this)" aria-label="Descripción">' + esc(p.descripcion || '') + '</textarea>' +
      '<button class="btn-remove-listado" onclick="removeProblemaUI(\'' + seccion + '\',\'' + esc(p.id) + '\')" aria-label="Quitar problema" title="Quitar">×</button>' +
    '</div>'
  );
}
function _renderListadoSeccion(seccion, label, lst) {
  var arr = lst[seccion] || [];
  var rows = arr.length
    ? arr.map(function(p, i){ return _renderListadoRow(seccion, p, i); }).join('')
    : '<div class="listado-empty">Sin problemas ' + label.toLowerCase() + '.</div>';
  return (
    '<div class="listado-section">' +
      '<div class="listado-section-header ' + seccion + '">' +
        '<span>' + label + ' (' + arr.length + ')</span>' +
      '</div>' +
      '<div class="listado-section-body listado-sort-zone" data-seccion-rows="' + seccion + '">' +
        rows +
      '</div>' +
      '<div class="listado-section-body" style="padding-top:0;">' +
        '<button class="listado-add-row" onclick="addProblemaUI(\'' + seccion + '\')">+ Agregar problema ' + label.toLowerCase() + '</button>' +
      '</div>' +
    '</div>'
  );
}
function destroyListadoSortables() {
  _listadoSortables.forEach(function (s) {
    try {
      if (s && typeof s.destroy === 'function') s.destroy();
    } catch (_e) { void _e; }
  });
  _listadoSortables = [];
}

function syncListadoOrderFromDom(seccion) {
  var lst = ensureListadoForActive();
  if (!lst || !seccion) return;
  var zone = document.querySelector(
    '#listado-form [data-seccion-rows="' + seccion + '"]'
  );
  if (!zone) return;
  var arr = (lst[seccion] || []).slice();
  var byId = Object.create(null);
  for (var i = 0; i < arr.length; i++) byId[arr[i].id] = arr[i];
  var newArr = [];
  zone.querySelectorAll('.listado-row[data-id]').forEach(function (row) {
    var id = row.getAttribute('data-id');
    if (id && byId[id]) newArr.push(byId[id]);
  });
  if (!newArr.length || newArr.length !== arr.length) return;
  listadoProblemas[aid()] = Object.assign({}, lst, { [seccion]: newArr });
}

function refreshListadoRowNumbers(seccion) {
  var zone = document.querySelector(
    '#listado-form [data-seccion-rows="' + seccion + '"]'
  );
  if (!zone) return;
  zone.querySelectorAll('.listado-row').forEach(function (row, idx) {
    var num = row.querySelector('.listado-num');
    if (num) num.textContent = String(idx + 1);
  });
}

function mountListadoSortables() {
  destroyListadoSortables();
  var SortableCtor = typeof globalThis !== 'undefined' ? globalThis.Sortable : null;
  if (!SortableCtor || typeof SortableCtor.create !== 'function') return;
  var scrollRoot = document.getElementById('listado-form');
  document.querySelectorAll('#listado-form [data-seccion-rows]').forEach(function (zone) {
    var seccion = zone.getAttribute('data-seccion-rows');
    if (!seccion || !zone.querySelector('.listado-row')) return;
    var sortable = SortableCtor.create(zone, {
      animation: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      draggable: '.listado-row',
      handle: '.listado-drag-handle',
      filter: 'textarea, input, button, a[href], select',
      preventOnFilter: true,
      delay: 0,
      delayOnTouchOnly: true,
      direction: 'vertical',
      forceFallback: true,
      fallbackClass: 'listado-drag-hovercard',
      fallbackOnBody: true,
      fallbackTolerance: 4,
      swapThreshold: 0.65,
      invertedSwapThreshold: 0.58,
      scroll: scrollRoot || true,
      bubbleScroll: true,
      scrollSensitivity: 54,
      scrollSpeed: 9,
      onEnd: function (evt) {
        if (evt.oldIndex === evt.newIndex && evt.from === evt.to) return;
        syncListadoOrderFromDom(seccion);
        refreshListadoRowNumbers(seccion);
        saveState();
      }
    });
    _listadoSortables.push(sortable);
  });
}

function renderListadoForm() {
  var c = document.getElementById('listado-form');
  if (!c) return;
  destroyListadoSortables();
  if (!aid()) { c.innerHTML = ''; return; }
  var patient = patients.find(function(p){ return p.id === aid(); });
  if (!patient) { c.innerHTML = ''; return; }
  var lst = ensureListadoForActive();
  c.innerHTML = (
    '<div class="card"><div class="card-header"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Datos del Paciente</div><div class="card-body"><div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:10px;align-items:end;">' +
      '<div class="field-group"><label>Nombre</label><input type="text" value="' + esc(patient.nombre) + '" class="field-readonly" readonly></div>' +
      '<div class="field-group"><label>Registro</label><input type="text" value="' + esc(patient.registro) + '" class="field-readonly" readonly></div>' +
      '<div class="field-group"><label>Edad/Sexo</label><input type="text" value="' + esc(patient.edad) + ' / ' + esc(patient.sexo) + '" class="field-readonly" readonly></div>' +
      '<div class="field-group"><label>Cuarto</label><input type="text" value="' + esc(patient.cuarto) + '" class="field-readonly" readonly></div>' +
      '<div class="field-group"><label>Cama</label><input type="text" value="' + esc(patient.cama) + '" class="field-readonly" readonly></div>' +
    '</div></div></div>' +

    '<div class="card"><div class="card-header card-header--tone-slate"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Fecha y Hora del Listado</div><div class="card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div class="field-group"><label>Fecha</label><input type="text" value="' + esc(lst.fecha) + '" placeholder="DD/MM/AAAA" oninput="updateListadoMeta(\'fecha\',this.value)"></div>' +
      '<div class="field-group"><label>Hora</label><input type="text" value="' + esc(lst.hora) + '" placeholder="HH:MM" oninput="updateListadoMeta(\'hora\',this.value)"></div>' +
    '</div></div></div>' +

    _renderListadoSeccion('activos', 'Activos', lst) +
    _renderListadoSeccion('inactivos', 'Inactivos', lst) +

    _renderListadoMedicosCard(lst) +

    '<div class="action-bar"><button type="button" class="btn-med-secondary rpc-doc-export" onclick="quickExportCurrentPatient()" id="btn-quick-export-listado"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l4-4m-4 4l-4-4"/><path d="M5 21h14"/></svg>Salida rápida</button>' +
    (isHideListadoProblemasAiPromptEnabled()
      ? ''
      : '<button type="button" class="btn-med-secondary" onclick="copyListadoProblemasAiPrompt()" title="Copia el prompt para usar en un chat de IA"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copiar prompt IA</button>') +
    '<button type="button" class="btn-generate rpc-doc-export" onclick="generateListado()" id="btn-gen-listado"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Generar Listado de Problemas (.docx)</button></div>'
  );
  refreshRpcDateFields(c);
  c.querySelectorAll('.listado-row textarea').forEach(_autoGrowTextarea);
  bindListadoTextareaPointerIsolation(c);
  mountListadoSortables();
}
function updateListadoMeta(field, value) {
  var lst = ensureListadoForActive(); if (!lst) return;
  lst[field] = value;
  saveState();
}
function updateProblemaField(seccion, id, field, value) {
  var lst = ensureListadoForActive(); if (!lst) return;
  var arr = lst[seccion] || [];
  var p = arr.find(function(x){ return x.id === id; });
  if (!p) return;
  p[field] = value;
  saveState();
}
function addProblemaUI(seccion) {
  var lst = ensureListadoForActive(); if (!lst) return;
  listadoProblemas[aid()] = listadoAddProblema(lst, seccion, { fecha: '', descripcion: '' });
  saveState();
  renderListadoForm();
  setTimeout(function(){
    var rows = document.querySelectorAll('[data-seccion-rows="' + seccion + '"] .listado-row textarea');
    if (rows.length) rows[rows.length - 1].focus();
  }, 0);
}
function removeProblemaUI(seccion, id) {
  var lst = ensureListadoForActive(); if (!lst) return;
  listadoProblemas[aid()] = listadoRemoveProblema(lst, seccion, id);
  saveState();
  renderListadoForm();
}
function _renderListadoMedicosCard(lst) {
  var meds = getMedicosForListado(lst);
  function row(key, label) {
    return (
      '<div class="field-group"><label>' + label + '</label>' +
      '<input type="text" value="' + esc(meds[key] || '') + '" oninput="updateListadoMedico(\'' + key + '\', this.value)">' +
      '</div>'
    );
  }
  return (
    '<div class="card"><div class="card-header card-header--tone-teal-md card-header-row">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
      'Médicos (firma)' +
      '<span class="card-header-subhint">Pre-llena desde Mi Perfil. Edita aquí para este paciente.</span>' +
    '</div><div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      row('profesor', 'Profesor') +
      row('r4',       'R4') +
      row('r2',       'R2') +
      row('r1a',      'R1 (1)') +
      row('r1b',      'R1 (2)') +
    '</div></div>'
  );
}

async function copyListadoProblemasAiPrompt() {
  var ok = await rt.copyToClipboardSafe(LISTADO_PROBLEMAS_AI_PROMPT);
  rt.showToast(ok ? 'Prompt copiado al portapapeles ✓' : 'No se pudo copiar el prompt', ok ? 'success' : 'error');
}
function generateListado() {
  if (rt.guardMobileDocExport()) return;
  if (guardDocExportBlocked({ isRpcOffline: rt.isRpcOffline, showToast: rt.showToast })) return;
  if (!aid()) { rt.showToast('Selecciona un paciente primero', 'error'); return; }
  var patient = patients.find(function(p){ return p.id === aid(); });
  if (!patient) return;
  var lst = ensureListadoForActive(); if (!lst) return;
  var hasProblems = (lst.activos && lst.activos.length) || (lst.inactivos && lst.inactivos.length);
  if (!hasProblems) {
    rt.showToast('Agrega al menos un problema antes de generar.', 'error');
    return;
  }
  var medicos = getMedicosForListado(lst);
  var btn = document.getElementById('btn-gen-listado');
  setAsyncButtonLoading(btn, true, { loadingText: 'Generando…' });
  rt.incrementPendingJobs();
  function buildPayload() {
    return { patient: patient, listado: lst, medicos: medicos };
  }
  function selectOutputDir() {
    if (!window.electronAPI || !window.electronAPI.selectOutputDir) return Promise.resolve(undefined);
    return window.electronAPI.selectOutputDir();
  }
  function saveOutputDir(dir) {
    if (!dir) return;
    var st = rt.getSettings() || {};
    st.outputDir = dir;
    localStorage.setItem('rpc-settings', JSON.stringify(st));
    syncApprovedOutputDir(dir);
  }
  exportWithOutputDirFallback({
    url: '/generate-listado',
    buildPayload: buildPayload,
    defaultFileName: 'listado.docx',
    selectOutputDir: selectOutputDir,
    saveOutputDir: saveOutputDir,
    onSuccess: function(data) {
      var name = (data && (data.fileName || data.path)) ? (data.fileName || String(data.path).split(/[/\\]/).pop()) : 'listado.docx';
      rt.showToast('Listado guardado: ' + name, 'success');
    },
    onPrompt: function() { rt.showToast('Selecciona una carpeta para guardar el documento.', 'error'); },
    onCancel: function() { rt.showToast('No se guardó el documento: no se eligió carpeta.', 'error'); },
    onError: function(msg) { rt.showToast('Error: ' + msg, 'error'); },
  })
  .catch(function(){ rt.showToast('Error de conexión', 'error'); })
  .finally(function(){
    setAsyncButtonLoading(document.getElementById('btn-gen-listado'), false);
    rt.decrementPendingJobs();
    rt.syncOfflineButtonStates();
  });
}

export {
  renderListadoForm,
  generateListado,
  updateListadoMeta,
  updateProblemaField,
  addProblemaUI,
  removeProblemaUI,
  copyListadoProblemasAiPrompt,
  _autoGrowTextarea,
  updateListadoMedico,
};
