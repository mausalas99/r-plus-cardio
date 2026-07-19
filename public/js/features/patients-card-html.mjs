import { isModeSala } from '../mode-features.mjs';
import { renderPatientSidebarBodyHtml } from '../patient-sidebar-card.mjs';
import { rt } from './patients-runtime-state.mjs';

export function renderPatientCardToolbarHtml(p, pinOn, archOn) {
  var pinTitle = pinOn ? 'Quitar de fijados' : 'Fijar paciente';
  var archTitle = archOn ? 'Restaurar del archivo' : 'Archivar paciente';
  var archiveIcon = archOn
    ? '↩'
    : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"></path><path d="M10 12h4"></path></svg>';
  return (
    '<div class="patient-card-toolbar">' +
    '<div class="patient-card-toolbar-left">' +
    '<button type="button" class="patient-toolbar-chip patient-toolbar-chip--icon btn-archive-clean" title="' +
    archTitle +
    '" aria-label="' +
    archTitle +
    '" onclick="togglePatientArchived(event,\'' +
    p.id +
    '\')">' +
    archiveIcon +
    '</button>' +
    '<button type="button" class="patient-toolbar-chip btn-pinned-text' +
    (pinOn ? ' patient-toolbar-chip--on' : '') +
    '" title="' +
    pinTitle +
    '" aria-label="' +
    pinTitle +
    '" onclick="togglePatientPinned(event,\'' +
    p.id +
    '\')">' +
    (pinOn ? 'Fijado' : 'Fijar') +
    '</button>' +
    '</div>' +
    '<button type="button" class="btn-delete-card" onclick="deletePatient(event,\'' +
    p.id +
    '\')" aria-label="Eliminar">×</button>' +
    '</div>'
  );
}


export function patientSidebarCardOpts(extra) {
  var opts = { showServicio: !isModeSala(rt.getSettings()) };
  if (extra) {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) opts[k] = extra[k];
    }
  }
  return opts;
}

export function renderPatientCardHtml(p) {
  var pinOn = !!p.pinned;
  var archOn = !!p.archived;
  var aid = rt.getActiveId();
  return (
    '<div class="patient-card ' +
      (p.id === aid ? 'active' : '') +
      (pinOn ? ' patient-card--pinned' : '') +
      (archOn ? ' patient-card--archived' : '') +
      '" data-patient-id="' +
      p.id +
      '" role="button" tabindex="0">' +
      renderPatientCardToolbarHtml(p, pinOn, archOn) +
      renderPatientSidebarBodyHtml(p, patientSidebarCardOpts()) +
      '</div>'
  );
}

export function renderPinnedSectionLabelHtml(count) {
  return (
    '<div class="patient-list-section-label patient-list-section-label--pinned" role="group" aria-label="Pacientes fijados">' +
    '<svg class="patient-list-pin-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a3 3 0 1 0-6 0v3.76z"/></svg>' +
    '<span class="patient-list-section-count">' +
    count +
    '</span></div>'
  );
}

export function renderActiveSectionLabelHtml(count) {
  return (
    '<div class="patient-list-section-label" role="group" aria-label="Lista de pacientes">Pacientes <span class="patient-list-section-count">' +
    count +
    '</span></div>'
  );
}

export function renderArchivedToggleHtml(collapsed, count) {
  return (
    '<button type="button" class="patient-list-section-toggle" onclick="toggleArchivedSection(event)" aria-expanded="' +
    (!collapsed ? 'true' : 'false') +
    '">Archivados <span>(' +
    count +
    ')</span> <span>' +
    (collapsed ? '▶' : '▼') +
    '</span></button>'
  );
}
