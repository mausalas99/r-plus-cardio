import { deriveSnapshot, ensureMonitoreo } from './estado-actual-data.mjs';
import { findActivePatient } from './estado-actual-panel-core.mjs';
import {
  getVitalHistoryEntries,
  vitalHasHistory,
  renderVitalHistoryListHtml,
  vitalHistoryTitle,
} from './estado-actual-panel-snapshot-html.mjs';

/** @type {{ showToast(msg: string, type?: string): void }} */
let rt = {
  showToast() {},
};

var dismissWired = false;

export function registerEaVitalHistoryModalRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function getBackdrop() {
  return document.getElementById('ea-vital-history-backdrop');
}

function getBodyEl() {
  return document.getElementById('ea-vital-history-body');
}

function getTitleEl() {
  return document.getElementById('ea-vital-history-title');
}

export function closeEaVitalHistoryModal() {
  var backdrop = getBackdrop();
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

/**
 * @param {string} vitalKey
 */
export function openEaVitalHistoryModal(vitalKey) {
  var key = String(vitalKey || '').trim();
  if (!key) return;
  var backdrop = getBackdrop();
  var body = getBodyEl();
  var title = getTitleEl();
  if (!backdrop || !body || !title) {
    rt.showToast('Historial de signos no disponible', 'error');
    return;
  }
  var patient = findActivePatient();
  if (!patient) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  ensureMonitoreo(patient);
  var snapshot = deriveSnapshot(patient.monitoreo);
  if (!vitalHasHistory(key, snapshot)) return;
  var entries = getVitalHistoryEntries(key, snapshot);
  title.textContent = vitalHistoryTitle(key);
  body.innerHTML = renderVitalHistoryListHtml(entries);
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
}

function handleEaVitalHistoryEscape(ev) {
  if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
  var backdrop = getBackdrop();
  if (!backdrop || !backdrop.classList.contains('open')) return;
  closeEaVitalHistoryModal();
  ev.preventDefault();
  ev.stopPropagation();
}

export function wireEaVitalHistoryModalDismiss() {
  if (dismissWired) return;
  dismissWired = true;
  document.addEventListener('keydown', handleEaVitalHistoryEscape, true);
  var backdrop = getBackdrop();
  if (backdrop) {
    backdrop.addEventListener('click', function (ev) {
      if (!backdrop.classList.contains('open')) return;
      if (ev.target !== backdrop) return;
      closeEaVitalHistoryModal();
    });
  }
}

export const windowHandlers = {
  openEaVitalHistoryModal,
  closeEaVitalHistoryModal,
};
