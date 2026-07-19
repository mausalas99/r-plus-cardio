// Shared helpers — toast, patient row, modal element
import { patients } from '../../app-state.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';

/** @param {object[]} users */
function normalizeUsers(users) {
  return (users || [])
    .map((u) => ({
      user_id: String(u.user_id || u.userId || ''),
      username: String(u.username || ''),
      rank: String(u.rank || ''),
      clinical_name: String(u.clinical_name || ''),
    }))
    .filter((u) => u.user_id);
}

/** @param {{ username?: string, clinical_name?: string, rank?: string, user_id?: string }} u */
function userOptionLabel(u) {
  const handle = String(u.username || u.user_id || '');
  const name = String(u.clinical_name || '').trim();
  const rank = String(u.rank || '');
  return name ? `${handle} · ${name} (${rank})` : `${handle} (${rank})`;
}

/** @param {object[]} list */
function uniqueByUserId(list) {
  const seen = new Set();
  return list.filter((u) => {
    if (seen.has(u.user_id)) return false;
    seen.add(u.user_id);
    return true;
  });
}

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function setEntregaToolbarStatus(msg, isError = false) {
  const status = document.getElementById('guardia-entrega-phase-status');
  if (!status) return;
  if (!msg) {
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('guardia-entrega-phase-status--error');
    return;
  }
  status.hidden = false;
  status.textContent = msg;
  status.classList.toggle('guardia-entrega-phase-status--error', isError);
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
    return;
  }
  setEntregaToolbarStatus(msg, type === 'error');
}

/** @param {object} row @param {string} id */
function normalizeEntregaPatientRow(row, id) {
  return {
    ...row,
    id: String(row.id || row.patient_id || id),
    name: row.name || row.nombre,
    nombre: row.nombre || row.name,
    servicio: row.servicio || row.service,
    service: row.service || row.servicio,
    area: row.area || row.sub_area,
    sub_area: row.sub_area || row.area,
  };
}

/** @param {string} patientId */
function resolveEntregaPatientRow(patientId) {
  const id = String(patientId || '');
  if (!id) return null;
  const row =
    (patients || []).find((p) => String(p.id) === id) ||
    (clinicalSessionContext.scopeContext?.patients || []).find(
      (p) => String(p.id || p.patient_id) === id
    ) ||
    null;
  if (!row) return null;
  return normalizeEntregaPatientRow(row, id);
}

/** @returns {ReturnType<typeof window.electronAPI>|null} */
function clinicalDbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function entregaModalEl() {
  return document.getElementById('entrega-modal-backdrop');
}

export {
  normalizeUsers,
  userOptionLabel,
  uniqueByUserId,
  dbApi,
  toast,
  setEntregaToolbarStatus,
  resolveEntregaPatientRow,
  clinicalDbApi,
  entregaModalEl,
};
