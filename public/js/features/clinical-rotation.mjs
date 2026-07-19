/**
 * Rotation cycle preview window, Incoming strip, and Nueva rotación controls.
 */
import {
  clinicalSessionContext,
  fetchActiveRotationCycleFromDb,
  fetchIncomingAssignmentsFromDb,
} from '../clinical-access-runtime.mjs';

import { canConfigureRotation as userCanConfigureRotation } from '../clinical-privileges.mjs';
import { submitRotationConfigForm } from './clinical-rotation-config-submit.mjs';

/** @param {string|Date|undefined} value */
function toMillis(value) {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  return new Date(String(value)).getTime();
}

/**
 * @param {{ preview_start_at?: string, effective_at?: string }|null|undefined} cycle
 * @param {Date} nowDate
 */

import { escapeHtml, escapeAttr } from '../dom-escape.mjs';
export function isIncomingPreviewWindow(cycle, nowDate) {
  if (!cycle?.preview_start_at || !cycle?.effective_at) return false;
  const now = toMillis(nowDate);
  const start = toMillis(cycle.preview_start_at);
  const end = toMillis(cycle.effective_at);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start && now < end;
}

/**
 * @param {{ effective_at?: string }|null|undefined} assignment
 * @param {Date} nowDate
 */
export function isChartLockedForPatient(assignment, nowDate) {
  if (!assignment?.effective_at) return false;
  const now = toMillis(nowDate);
  const effective = toMillis(assignment.effective_at);
  if (!Number.isFinite(now) || !Number.isFinite(effective)) return false;
  return now < effective;
}

/** @param {string} iso */
function formatEffectiveLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

function canConfigureRotation() {
  return userCanConfigureRotation(clinicalSessionContext.user);
}

/** @param {Record<string, unknown>} row */
function assignmentChipLabel(row) {
  const bed = String(row.bed_label || '').trim() || '—';
  const dx =
    String(row.prognosis_classification || row.dxText || '').trim() || 'Sin dx';
  return { bed, dx };
}

/**
 * @param {Array<Record<string, unknown>>} assignments
 * @param {{ onLockedClick?: (assignment: Record<string, unknown>) => void }} [opts]
 */
export function renderIncomingStrip(assignments, opts = {}) {
  const host = document.getElementById('guardia-incoming-strip');
  if (!host) return;

  const rows = Array.isArray(assignments) ? assignments : [];
  if (!rows.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  const now = new Date();
  const chips = rows
    .map((row) => {
      const id = String(row.patient_id || row.id || '');
      const { bed, dx } = assignmentChipLabel(row);
      const locked = isChartLockedForPatient(row, now);
      return `<button type="button" class="guardia-incoming-chip" data-patient-id="${escapeAttr(id)}" data-effective-at="${escapeAttr(String(row.effective_at || ''))}" aria-label="Paciente entrante ${escapeAttr(bed)}, ${escapeAttr(dx)}${locked ? ', bloqueado hasta vigencia' : ''}">
        <span class="guardia-incoming-chip-bed">${escapeHtml(bed)}</span>
        <span class="guardia-incoming-chip-dx">${escapeHtml(dx)}</span>
      </button>`;
    })
    .join('');

  host.hidden = false;
  host.innerHTML = `
    <details class="guardia-incoming-details" open>
      <summary class="guardia-incoming-summary">Incoming <span class="guardia-incoming-count">${rows.length}</span></summary>
      <p class="guardia-incoming-hint">Vista previa de entregas — el expediente se abre al llegar la fecha de vigencia.</p>
      <div class="guardia-incoming-chips" role="list">${chips}</div>
    </details>`;

  const onLockedClick = opts.onLockedClick;
  host.querySelectorAll('.guardia-incoming-chip').forEach((btn, idx) => {
    const row = rows[idx];
    if (!btn || !row) return;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (isChartLockedForPatient(row, new Date())) {
        if (typeof onLockedClick === 'function') onLockedClick(row);
        else toast(`Disponible el ${formatEffectiveLabel(String(row.effective_at || ''))}`, 'info');
        return;
      }
    });
  });
}

function rotationModalEl() {
  return document.getElementById('guardia-rotation-config-backdrop');
}

export function openRotationConfigModal() {
  if (!canConfigureRotation()) {
    toast('Solo R4 o Admin pueden configurar la rotación.', 'error');
    return;
  }
  const bd = rotationModalEl();
  if (!bd) return;
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  const monthEnd = document.getElementById('rotation-config-month-end');
  if (monthEnd) monthEnd.focus();
}

export function closeRotationConfigModal() {
  const bd = rotationModalEl();
  if (!bd) return;
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
}

function wireRotationConfigFormOnce() {
  const form = document.getElementById('guardia-rotation-config-form');
  if (!form || form._rpcRotationConfigWired) return;
  form._rpcRotationConfigWired = true;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!canConfigureRotation()) {
      toast('Solo R4 o Admin pueden configurar la rotación.', 'error');
      return;
    }
    const res = await submitRotationConfigForm(toast);
    if (!res.ok) return;
    closeRotationConfigModal();
    toast('Configuración de rotación guardada.', 'success');
    document.dispatchEvent(new CustomEvent('rpc-guardia-rotation-changed'));
  });
}

export async function confirmNuevaRotacion() {
  const ok = window.confirm(
    '¿Iniciar nueva rotación?\n\n' +
      '• Se archivan todos los equipos activos\n' +
      '• Se limpian las guardias del día\n' +
      '• Los residentes deben volver a crear equipos\n\n' +
      'Esta acción no se puede deshacer.'
  );
  if (!ok) return { ok: false, cancelled: true };

  const api = dbApi();
  const nuevaFn = api && (api.dbRotationNueva || api.rotationNueva);
  if (typeof nuevaFn !== 'function') {
    toast('Base de datos no disponible.', 'error');
    return { ok: false };
  }
  const res = await nuevaFn.call(api, { userId: clinicalSessionContext.user?.user_id });
  if (!res || res.ok === false) {
    toast(res?.error || 'No se aplicó la nueva rotación.', 'error');
    return { ok: false };
  }
  toast('Nueva rotación aplicada.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-guardia-rotation-changed'));
  return { ok: true };
}

let rotationControlsWired = false;

export function syncRotationConfigButton() {
  const configBtn = document.getElementById('btn-rotation-config-open');
  if (!configBtn) return;
  const allowed = canConfigureRotation();
  configBtn.hidden = !allowed;
  configBtn.disabled = false;
  configBtn.title = allowed
    ? 'Calendario de rotación del servicio (fin de mes, vigencia, vista previa)'
    : '';
}

/** @deprecated — config lives in Mi rotación; kept for entry chrome callers. */
export function syncGuardiaRotationToolbar() {
  syncRotationConfigButton();
}

/** @param {ParentNode} [root] */
export function wireRotationConfigOpenControl(root = document) {
  const btn = root.querySelector('#btn-rotation-config-open');
  if (!btn || btn._rpcRotationConfigOpenWired) return;
  btn._rpcRotationConfigOpenWired = true;
  btn.addEventListener('click', () => openRotationConfigModal());
}

export function wireGuardiaRotationControls() {
  if (rotationControlsWired) return;
  rotationControlsWired = true;
  wireRotationConfigFormOnce();
  syncRotationConfigButton();
  wireRotationConfigOpenControl();

  const bd = rotationModalEl();
  if (bd) {
    bd.addEventListener('click', (ev) => {
      if (ev.target === bd) closeRotationConfigModal();
    });
  }
  const cancelBtn = document.getElementById('btn-rotation-config-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeRotationConfigModal());
}

/** @param {ParentNode} [root] */
export function wireNuevaRotacionControl(root = document) {
  const btn = root.querySelector('#btn-nueva-rotacion');
  if (!btn || btn._rpcNuevaRotacionWired) return;
  btn._rpcNuevaRotacionWired = true;
  btn.addEventListener('click', () => void confirmNuevaRotacion());
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export async function syncGuardiaIncomingStrip(settings) {
  void settings;
  wireGuardiaRotationControls();

  const host = document.getElementById('guardia-incoming-strip');
  if (!host) return;

  const cycle = await fetchActiveRotationCycleFromDb();
  if (!cycle || !isIncomingPreviewWindow(cycle, new Date())) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  const assignments = await fetchIncomingAssignmentsFromDb();
  renderIncomingStrip(assignments, {
    onLockedClick: (row) => {
      toast(`Disponible el ${formatEffectiveLabel(String(row.effective_at || ''))}`, 'info');
    },
  });
}
