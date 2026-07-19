/** Modal to pick multiple patients for JSON export (Ajustes → Exportar pacientes…). */
import { patients, saveState } from '../../../app-state.mjs';
import { esc } from '../../../dom-escape.mjs';
import { isTourDemoPatientId } from '../../../tour-demo-patient.mjs';
import { patientsVisibleInSidebar } from '../../patients-scope.mjs';
import { formatDateSlug, downloadJsonPayload } from '../shared.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import {
  buildPatientsSelectionExportPayload,
  sortPatientsForExportPicker,
} from './export-patients-selection.mjs';

const rt = getPlatformRuntime();

function exportablePatientsForPicker() {
  var visible = patientsVisibleInSidebar();
  var source = visible.length ? visible : patients;
  return sortPatientsForExportPicker(
    source.filter(function (p) {
      return p && p.id && !isTourDemoPatientId(p.id, patients);
    })
  );
}

function patientPickerLabel(p) {
  var bed = [p.cuarto, p.cama].filter(Boolean).join('-');
  var reg = p.registro ? ' • ' + p.registro : '';
  var archived = p.archived ? ' (archivado)' : '';
  return (bed ? bed + ' — ' : '') + (p.nombre || 'Sin nombre') + reg + archived;
}

function selectedPatientIdsFromBackdrop(backdrop) {
  var ids = [];
  backdrop.querySelectorAll('.export-patients-cb:checked').forEach(function (cb) {
    var pid = cb.getAttribute('data-patient-id');
    if (pid) ids.push(pid);
  });
  return ids;
}

function syncExportPatientsActions(backdrop) {
  var countEl = backdrop.querySelector('#export-patients-count');
  var exportBtn = backdrop.querySelector('#export-patients-ok');
  var ids = selectedPatientIdsFromBackdrop(backdrop);
  var n = ids.length;
  if (countEl) {
    countEl.textContent =
      n === 0
        ? 'Ningún paciente seleccionado'
        : n + ' paciente' + (n === 1 ? '' : 's') + ' seleccionado' + (n === 1 ? '' : 's');
  }
  if (exportBtn) {
    exportBtn.disabled = n === 0;
    exportBtn.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
    exportBtn.style.opacity = n === 0 ? '0.55' : '';
    exportBtn.style.cursor = n === 0 ? 'not-allowed' : 'pointer';
  }
}

function closeExportPatientsModal(backdrop) {
  if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
}

function buildExportPatientsListHtml(candidates, activeId) {
  return candidates
    .map(function (p) {
      var checked = p.id === activeId ? ' checked' : '';
      return (
        '<li style="margin:6px 0;">' +
        '<label style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;">' +
        '<input type="checkbox" class="export-patients-cb" data-patient-id="' +
        esc(p.id) +
        '"' +
        checked +
        ' style="margin-top:3px;flex-shrink:0;" />' +
        '<span>' +
        esc(patientPickerLabel(p)) +
        '</span></label></li>'
      );
    })
    .join('');
}

function runExportPatientsSelection(patientIds) {
  saveState();
  var payload = buildPatientsSelectionExportPayload(patientIds);
  if (!payload.entries.length) {
    rt.showToast('No hay pacientes exportables en la selección.', 'error');
    return;
  }
  downloadJsonPayload(payload, 'R-plus-pacientes-' + formatDateSlug(new Date()) + '.json');
  addAuditEntry('selection-export', 'ok', payload.entries.length, payload.to);
  rt.showToast(
    'Exportados ' + payload.entries.length + ' paciente' + (payload.entries.length === 1 ? '' : 's'),
    'success'
  );
}

function wireExportPatientsModal(backdrop, candidates) {
  var ordered = candidates;
  backdrop.querySelector('#export-patients-all')?.addEventListener('click', function () {
    backdrop.querySelectorAll('.export-patients-cb').forEach(function (cb) {
      cb.checked = true;
    });
    syncExportPatientsActions(backdrop);
  });
  backdrop.querySelector('#export-patients-none')?.addEventListener('click', function () {
    backdrop.querySelectorAll('.export-patients-cb').forEach(function (cb) {
      cb.checked = false;
    });
    syncExportPatientsActions(backdrop);
  });
  backdrop.querySelector('#export-patients-cancel')?.addEventListener('click', function () {
    closeExportPatientsModal(backdrop);
  });
  backdrop.addEventListener('change', function (ev) {
    if (ev.target && ev.target.classList && ev.target.classList.contains('export-patients-cb')) {
      syncExportPatientsActions(backdrop);
    }
  });
  backdrop.querySelector('#export-patients-ok')?.addEventListener('click', function () {
    var ids = selectedPatientIdsFromBackdrop(backdrop);
    if (!ids.length) return;
    closeExportPatientsModal(backdrop);
    runExportPatientsSelection(ids);
  });
  backdrop.addEventListener('click', function (ev) {
    if (ev.target === backdrop) closeExportPatientsModal(backdrop);
  });
  syncExportPatientsActions(backdrop);
  if (!ordered.length) {
    var exportBtn = backdrop.querySelector('#export-patients-ok');
    if (exportBtn) exportBtn.disabled = true;
  }
}

export function openExportPatientsModal() {
  var candidates = exportablePatientsForPicker();
  var listHtml = candidates.length
    ? buildExportPatientsListHtml(candidates, rt.getActiveId())
    : '<li style="font-size:13px;color:var(--text-muted);">No hay pacientes exportables en el censo visible.</li>';
  var backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop';
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;';
  backdrop.innerHTML =
    '<div class="lab-conflict-modal" style="max-width:560px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<h3 style="margin:0 0 8px;">Exportar pacientes</h3>' +
    '<p style="font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--text-muted);">Marca los pacientes que quieres incluir. El archivo JSON se puede importar con <strong>Importar paciente…</strong> o <strong>Importar rango…</strong>.</p>' +
    '<div style="overflow-y:auto;flex:0 1 auto;max-height:42vh;padding-right:4px;">' +
    '<ul style="margin:0;padding-left:0;list-style:none;font-size:13px;">' +
    listHtml +
    '</ul></div>' +
    '<p id="export-patients-count" style="font-size:12px;color:var(--text-muted);margin:10px 0 6px;">Ningún paciente seleccionado</p>' +
    '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;">' +
    '<button type="button" id="export-patients-none" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Quitar todos</button>' +
    '<button type="button" id="export-patients-all" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Seleccionar todos</button>' +
    '<button type="button" id="export-patients-cancel" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Cancelar</button>' +
    '<button type="button" id="export-patients-ok" disabled aria-disabled="true" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:not-allowed;opacity:0.55;">Exportar JSON…</button>' +
    '</div></div>';
  document.body.appendChild(backdrop);
  wireExportPatientsModal(backdrop, candidates);
}
