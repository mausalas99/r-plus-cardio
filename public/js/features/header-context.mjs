/**
 * Always-visible clinical context in the header (premium UI phase 2):
 * active patient (name · bed · dx) + current navigation path.
 */
import { patients } from '../app-state.mjs';
import { resolveConsolidatedTarget } from '../expediente-tabs.mjs';
import { GROUP_LABELS, SECTION_LABELS } from '../expediente-group-row.mjs';
import { diagnosticosTextForCenso } from '../patient-diagnosticos.mjs';

export function buildHeaderPath(appTab, inner, settings) {
  if (appTab === 'lab') return 'Laboratorio';
  if (appTab === 'med') return 'Manejo';
  if (appTab === 'agenda') return 'Agenda';
  var granular = inner || 'todo';
  var target = resolveConsolidatedTarget(granular, settings || {});
  var path = GROUP_LABELS[target.tab] || 'Expediente';
  if (target.tab === 'paciente') return path;
  var section = target.section;
  if (section && SECTION_LABELS[section]) path += ' › ' + SECTION_LABELS[section];
  return path;
}


function sidebarShowsActivePatient() {
  if (typeof document === 'undefined') return true;
  var root = document.documentElement;
  return !root.classList.contains('sidebar-auto-hide') || root.classList.contains('sidebar-reveal');
}

export function buildHeaderPatientLine(p) {
  if (!p) return '';
  var parts = [String(p.nombre || '').trim() || 'Paciente'];
  var cuarto = String(p.cuarto || '').trim();
  if (cuarto) parts.push(cuarto);
  var dx = '';
  try {
    dx = String(diagnosticosTextForCenso(p.diagnosticosList) || '').trim();
  } catch {
    dx = '';
  }
  if (dx) parts.push(dx.length > 48 ? dx.slice(0, 47) + '…' : dx);
  return parts.join(' · ');
}

/** ctx: { getActiveId, getActiveAppTab, getActiveInner, getSettings } */
export function syncHeaderContext(ctx) {
  var patientEl = document.getElementById('header-context-patient');
  var pathEl = document.getElementById('header-context-path');
  if (!patientEl || !pathEl || !ctx) return;
  var id = typeof ctx.getActiveId === 'function' ? ctx.getActiveId() : null;
  var p =
    id == null
      ? null
      : patients.find(function (x) {
          return String(x.id) === String(id);
        }) || null;
  var showPatient = !!(p && !sidebarShowsActivePatient());
  patientEl.textContent = showPatient ? buildHeaderPatientLine(p) : '';
  patientEl.style.display = showPatient ? '' : 'none';
  pathEl.textContent = buildHeaderPath(
    typeof ctx.getActiveAppTab === 'function' ? ctx.getActiveAppTab() : 'nota',
    typeof ctx.getActiveInner === 'function' ? ctx.getActiveInner() : 'todo',
    typeof ctx.getSettings === 'function' ? ctx.getSettings() : {}
  );
}
