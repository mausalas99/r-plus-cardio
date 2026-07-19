/**
 * Guardia census — patient chip action sheet (expediente vs eventualidad).
 */
import { patients } from '../app-state.mjs';
import { toClinicalHistoryText } from '../../../lib/historia-clinica/clinical-text.mjs';
import { getUiDensity, setUiDensity } from './chrome.mjs';
import {
  normalizeEventualidadText,
  savePatientEventualidad,
} from './eventualidades-panel.mjs';

import { escapeHtml } from '../dom-escape.mjs';
let dismissWired = false;

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

function backdropEl() {
  return document.getElementById('guardia-patient-action-backdrop');
}

function bodyEl() {
  return document.getElementById('guardia-patient-action-body');
}

/** @param {string} patientId */
function findPatient(patientId) {
  const id = String(patientId || '');
  return (
    patients.find(function (p) {
      return p && String(p.id) === id;
    }) || null
  );
}

/**
 * @param {{
 *   turnoActivo?: boolean,
 *   entregaActive?: boolean,
 *   onCallGuardiaReceiver?: boolean,
 *   gridViewContext?: 'GUARDIA'|'HANDOFF',
 * }} ctx
 */
export function shouldShowGuardiaPatientActionMenu(ctx) {
  const turnoActivo = !!ctx?.turnoActivo;
  const entregaActive = !!ctx?.entregaActive;
  if (entregaActive && !turnoActivo) return false;
  return turnoActivo;
}

function closeGuardiaPatientActionSheet() {
  const bd = backdropEl();
  if (!bd) return;
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('guardia-patient-action-open');
  const body = bodyEl();
  if (body) body.innerHTML = '';
}

function openBackdrop() {
  const bd = backdropEl();
  if (!bd) return false;
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('guardia-patient-action-open');
  return true;
}

function wireUppercaseTextarea(textarea) {
  if (!textarea || textarea.dataset.guardiaEvUpperWired === '1') return;
  textarea.dataset.guardiaEvUpperWired = '1';
  textarea.style.textTransform = 'uppercase';
  textarea.addEventListener('input', function () {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const upper = toClinicalHistoryText(textarea.value);
    if (upper !== textarea.value) {
      textarea.value = upper;
      if (start != null && end != null) textarea.setSelectionRange(start, end);
    }
  });
}

function resolveGlobalFn(name) {
  if (typeof window !== 'undefined' && typeof window[name] === 'function') {
    return window[name];
  }
  if (typeof globalThis[name] === 'function') return globalThis[name];
  return null;
}

function openPatientChart(patientId) {
  const selectFn = resolveGlobalFn('selectPatient');
  if (selectFn) selectFn(patientId);
  const openSectionFn = resolveGlobalFn('openPaseSectionInNormal');
  if (openSectionFn) {
    openSectionFn('expediente');
    return;
  }
  if (getUiDensity() === 'guardia') setUiDensity('normal');
}

function renderMenuStep(patientId, patientLabel) {
  const body = bodyEl();
  if (!body) return;
  body.innerHTML =
    '<p class="guardia-patient-action-lead">Elige una acción para este paciente.</p>' +
    '<div class="guardia-patient-action-list" role="menu">' +
    '<button type="button" class="guardia-patient-action-item" data-action="chart">' +
    '<span class="guardia-patient-action-item__title">Abrir expediente</span>' +
    '<span class="guardia-patient-action-item__hint">Ver historia, estado actual y más</span>' +
    '</button>' +
    '<button type="button" class="guardia-patient-action-item" data-action="eventualidad">' +
    '<span class="guardia-patient-action-item__title">Registrar eventualidad</span>' +
    '<span class="guardia-patient-action-item__hint">Nota breve visible para el equipo en LAN</span>' +
    '</button>' +
    '</div>';

  body.querySelector('[data-action="chart"]')?.addEventListener('click', function () {
    closeGuardiaPatientActionSheet();
    openPatientChart(patientId);
  });
  body.querySelector('[data-action="eventualidad"]')?.addEventListener('click', function () {
    renderEventualidadStep(patientId, patientLabel);
  });
}

function renderEventualidadStep(patientId, patientLabel) {
  const body = bodyEl();
  const title = document.getElementById('guardia-patient-action-title');
  if (!body) return;
  if (title) title.textContent = 'Registrar eventualidad';
  body.innerHTML =
    '<p class="guardia-patient-action-lead">' +
    escapeHtml(patientLabel || 'Paciente') +
    '</p>' +
    '<div class="field-group guardia-patient-action-field">' +
    '<label for="guardia-patient-action-ev-input">¿Qué ocurrió?</label>' +
    '<textarea id="guardia-patient-action-ev-input" class="profile-input guardia-patient-action-textarea" rows="3" maxlength="480" placeholder="Describe lo ocurrido en el turno…"></textarea>' +
    '</div>' +
    '<div class="modal-actions guardia-patient-action-actions">' +
    '<button type="button" class="btn-cancel" id="guardia-patient-action-back">Volver</button>' +
    '<button type="button" class="btn-save" id="guardia-patient-action-save">Guardar</button>' +
    '</div>';

  const input = body.querySelector('#guardia-patient-action-ev-input');
  wireUppercaseTextarea(input);
  input?.focus();

  body.querySelector('#guardia-patient-action-back')?.addEventListener('click', function () {
    const titleEl = document.getElementById('guardia-patient-action-title');
    if (titleEl) titleEl.textContent = patientLabel;
    renderMenuStep(patientId, patientLabel);
  });

  body.querySelector('#guardia-patient-action-save')?.addEventListener('click', function () {
    void submitEventualidad(patientId, patientLabel, input?.value || '');
  });

  input?.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) {
      ev.preventDefault();
      void submitEventualidad(patientId, patientLabel, input.value || '');
    }
  });
}

function wireCancelButton() {
  const cancelBtn = document.getElementById('guardia-patient-action-cancel');
  if (!cancelBtn || cancelBtn.dataset.guardiaActionWired === '1') return;
  cancelBtn.dataset.guardiaActionWired = '1';
  cancelBtn.addEventListener('click', closeGuardiaPatientActionSheet);
}

async function submitEventualidad(patientId, patientLabel, rawText) {
  const text = normalizeEventualidadText(rawText);
  if (!text) {
    toast('Escribe la eventualidad antes de guardar.', 'error');
    return;
  }
  const patient = findPatient(patientId);
  if (!patient) {
    toast('Paciente no encontrado.', 'error');
    closeGuardiaPatientActionSheet();
    return;
  }
  const saveBtn = document.getElementById('guardia-patient-action-save');
  if (saveBtn) saveBtn.disabled = true;
  try {
    const out = await savePatientEventualidad(patient, text);
    if (!out?.ok) {
      toast('No se pudo guardar la eventualidad.', 'error');
      return;
    }
    toast('Eventualidad guardada.', 'success');
    closeGuardiaPatientActionSheet();
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * @param {{ patientId: string, patientLabel?: string }} opts
 */
export function openGuardiaPatientActionSheet(opts) {
  const patientId = String(opts?.patientId || '');
  if (!patientId) return;
  if (!openBackdrop()) {
    openPatientChart(patientId);
    return;
  }
  wireCancelButton();

  const patient = findPatient(patientId);
  const patientLabel =
    String(opts?.patientLabel || '').trim() ||
    String(patient?.name || '').trim() ||
    'Paciente';

  const title = document.getElementById('guardia-patient-action-title');
  if (title) title.textContent = patientLabel;

  renderMenuStep(patientId, patientLabel);
}

export { openPatientChart };

export function wireGuardiaPatientActionSheetDismiss() {
  if (dismissWired || typeof document === 'undefined') return;
  dismissWired = true;
  wireCancelButton();
  const bd = backdropEl();
  if (bd) {
    bd.addEventListener('click', function (ev) {
      if (!bd.classList.contains('open')) return;
      if (ev.target !== bd) return;
      closeGuardiaPatientActionSheet();
    });
  }
  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      const el = backdropEl();
      if (!el || !el.classList.contains('open')) return;
      closeGuardiaPatientActionSheet();
      ev.preventDefault();
      ev.stopPropagation();
    },
    true
  );
}
