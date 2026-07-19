import { patients, recetaHuByPatient, saveState } from '../app-state.mjs';
import {
  formatRecetaHuFecha,
  normalizeRecetaHuConsultServices,
  normalizeRecetaHuDraft,
} from '../receta-hu-core.mjs';

import { esc } from '../dom-escape.mjs';
export var rt = {
  getActiveId() {
    return null;
  },
  getActiveAppTab() {
    return 'lab';
  },
  getActiveInner() {
    return 'todo';
  },
  getSettings() {
    return {};
  },
  switchAppTab() {},
  switchInnerTab() {},
  requestDocumentJson() {
    return Promise.resolve(null);
  },
  handleDocumentGenerateResponse(opts) {
    return Promise.resolve(opts && opts.response);
  },
  showToast() {},
  guardMobileDocExport() {
    return false;
  },
  isRpcOffline() {
    return false;
  },
  incrementPendingJobs() {},
  decrementPendingJobs() {},
  syncOfflineButtonStates() {},
};

export function registerRecetaHuRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function aid() {
  return rt.getActiveId();
}

function getDraft(pid) {
  if (!pid) return normalizeRecetaHuDraft(null);
  if (!recetaHuByPatient[pid]) {
    recetaHuByPatient[pid] = normalizeRecetaHuDraft({
      fecha: formatRecetaHuFecha(new Date()),
      meds: [],
      labs: [],
    });
  }
  return normalizeRecetaHuDraft(recetaHuByPatient[pid]);
}

function persistDraft(pid, draft) {
  if (!pid || pid.indexOf('demo-') === 0) return;
  recetaHuByPatient[pid] = normalizeRecetaHuDraft(draft);
  saveState();
}

function readStaticFieldsFromDom(draft) {
  var fechaEl = document.getElementById('receta-hu-fecha');
  if (fechaEl) draft.fecha = fechaEl.value;
  var cuidadosEl = document.getElementById('receta-hu-cuidados');
  if (cuidadosEl) draft.cuidados = cuidadosEl.value;
  return draft;
}

export function readDraftFromDom() {
  var pid = aid();
  var draft = getDraft(pid);
  readStaticFieldsFromDom(draft);
  return draft;
}

/** Si el panel HU está montado para ese paciente, persiste fecha/cuidados antes de cambiar de paciente. */
export function flushRecetaHuDraftIfMountedFor(patientId) {
  if (!patientId || String(patientId).indexOf('demo-') === 0) return;
  var root = document.getElementById('receta-hu-container');
  if (!root || root.dataset.mounted !== '1') return;
  if (String(root.dataset.patientId || '') !== String(patientId)) return;
  var draft = getDraft(patientId);
  readStaticFieldsFromDom(draft);
  persistDraft(patientId, draft);
}

function consultServices() {
  return normalizeRecetaHuConsultServices(rt.getSettings().recetaHuConsultServices);
}

function saveConsultServices(list) {
  var st = rt.getSettings();
  st.recetaHuConsultServices = normalizeRecetaHuConsultServices(list);
  try {
    localStorage.setItem('rpc-settings', JSON.stringify(st));
  } catch (_e) { void _e; }
}

function activePatient() {
  var pid = aid();
  if (!pid) return null;
  return patients.find(function (p) {
    return p.id === pid;
  }) || null;
}

function recetaHuPanelVisible() {
  var root = document.getElementById('receta-hu-container');
  if (!root) return false;
  var r = root.getBoundingClientRect();
  return r.width > 4 && r.height > 4;
}

function ensureRecetaHuPanelVisible() {
  if (recetaHuPanelVisible()) return;
  if (typeof rt.switchInnerTab === 'function') {
    rt.switchInnerTab('recetaHu');
    return;
  }
  if (
    typeof rt.getActiveAppTab === 'function' &&
    rt.getActiveAppTab() !== 'nota' &&
    typeof rt.switchAppTab === 'function'
  ) {
    rt.switchAppTab('nota');
  }
}

export {
  aid,
  esc,
  getDraft,
  persistDraft,
  consultServices,
  saveConsultServices,
  activePatient,
  recetaHuPanelVisible,
  ensureRecetaHuPanelVisible,
  readStaticFieldsFromDom,
};
