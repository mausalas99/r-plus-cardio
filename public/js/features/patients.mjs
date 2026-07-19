// Patient list, ronda navigation, pin/archive, add/save modal, delete — barrel + sidebar chrome
import {
  patients,
  notes,
  indicaciones,
  saveState,
} from '../app-state.mjs';
import { applyProfileToNoteIfEmpty } from './notes-indicaciones.mjs';
import { applyNotaFormatScaffoldIfEmpty } from '../profile-templates.mjs';
import {
  lanSyncPatientArchivedFlag,
  isLanSessionConfiguredForRest,
} from './lan-sync.mjs';
import { rt, registerPatientsRuntime as _registerRt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import {
  pickDefaultVisiblePatientId,
  ensureActivePatientInSidebarScope,
  filterPatientsForGuardiaCensus,
  syncClinicalCensusFiltersChrome,
} from './patients-scope.mjs';
import { renderPatientList } from './patients-list.mjs';
import { selectPatient, deletePatient } from './patients-select.mjs';
import { setArchivedSectionCollapsed } from './patients-list.mjs';
import {
  onPatientSearchInput,
  togglePatientRoundSeen,
  getRoundOverviewMode,
  setRoundOverviewMode,
  syncRoundExpedienteLayout,
  renderRoundOverviewPanels,
  closeRondaQuickMoreMenu,
  returnToRoundOverview,
  openFullExpedienteFromRound,
  advanceRondaPatient,
  scrollActiveRondaCardIntoView,
} from './patients-round.mjs';
import {
  openAddModal,
  openAddModalFromLab,
  openAddModalFromLabPatient,
  closeModal,
  confirmCloseAddPatientModal,
  savePatient,
  initPatientModalEnterSave,
  focusPatientSearchInput,
} from './patients-modal.mjs';
import {
  generatePatientId,
  buildPatientEntry,
  findPatientByRegistro,
  ensureUniquePatientName,
} from './patients-modal-commit.mjs';

patientsBridge.renderPatientList = renderPatientList;
patientsBridge.selectPatient = selectPatient;

export { rt };
export {
  pickDefaultVisiblePatientId,
  ensureActivePatientInSidebarScope,
  filterPatientsForGuardiaCensus,
  syncClinicalCensusFiltersChrome,
};

export function invalidateMobileSidebarPatientCache() {
  /* no-op — kept for LAN scope refresh hooks */
}

export function registerPatientsRuntime(ctx) {
  _registerRt(ctx);
}

export function applyDefaultsToNewPatient(patientId) {
  if (!notes[patientId]) return;
  applyProfileToNoteIfEmpty(notes[patientId]);
  applyNotaFormatScaffoldIfEmpty(notes[patientId], rt.getSettings() || {});
}

export function applyDefaultsToNewIndicaciones(patientId) {
  if (!indicaciones[patientId]) return;
  var st = rt.getSettings() || {};
  if (st.defaultDieta && !indicaciones[patientId].dieta) indicaciones[patientId].dieta = st.defaultDieta;
  if (st.defaultCuidados && !indicaciones[patientId].cuidados) {
    indicaciones[patientId].cuidados = st.defaultCuidados;
  }
  if (st.defaultMedicamentos && !indicaciones[patientId].medicamentos) {
    indicaciones[patientId].medicamentos = st.defaultMedicamentos;
  }
  if (st.defaultIndicacionesEstudios && !indicaciones[patientId].estudios) {
    indicaciones[patientId].estudios = st.defaultIndicacionesEstudios;
  }
  if (st.defaultIndicacionesInterconsultas && !indicaciones[patientId].interconsultas) {
    indicaciones[patientId].interconsultas = st.defaultIndicacionesInterconsultas;
  }
}

var ARCHIVED_SECTION_COLLAPSED_LS = 'rpc-archived-section-collapsed';
var SIDEBAR_AUTO_HIDE_LS = 'rpc-sidebar-auto-hide';

export {
  getRoundOverviewMode,
  setRoundOverviewMode,
  onPatientSearchInput,
  togglePatientRoundSeen,
  syncRoundExpedienteLayout,
  renderRoundOverviewPanels,
  closeRondaQuickMoreMenu,
  returnToRoundOverview,
  openFullExpedienteFromRound,
  advanceRondaPatient,
  scrollActiveRondaCardIntoView,
};

export { renderPatientList, selectPatient, deletePatient };

function patientSectionKey(p) {
  if (p && p.archived) return 'archived';
  if (p && p.pinned) return 'pinned';
  return 'active';
}

function movePatientBefore(targetId, beforeId) {
  if (!targetId || !beforeId || targetId === beforeId) return;
  var from = patients.findIndex(function (p) {
    return p.id === targetId;
  });
  var to = patients.findIndex(function (p) {
    return p.id === beforeId;
  });
  if (from < 0 || to < 0 || from === to) return;
  var moved = patients.splice(from, 1)[0];
  if (from < to) to -= 1;
  patients.splice(to, 0, moved);
}

export function toggleArchivedSection(ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  try {
    var collapsed = localStorage.getItem(ARCHIVED_SECTION_COLLAPSED_LS) === '1';
    setArchivedSectionCollapsed(!collapsed);
  } catch {
    setArchivedSectionCollapsed(false);
  }
  patientsBridge.renderPatientList();
}

export function movePatientByOffset(ev, id, dir) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var p = patients.find(function (x) {
    return x.id === id;
  });
  if (!p) return;
  var sec = patientSectionKey(p);
  var ids = patients
    .filter(function (x) {
      return patientSectionKey(x) === sec;
    })
    .map(function (x) {
      return x.id;
    });
  var idx = ids.indexOf(id);
  if (idx < 0) return;
  var next = idx + dir;
  if (next < 0 || next >= ids.length) return;
  movePatientBefore(id, ids[next]);
  saveState();
  patientsBridge.renderPatientList();
}

export function togglePatientPinned(ev, id) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var p = patients.find(function (x) {
    return x.id === id;
  });
  if (!p) return;
  p.pinned = !p.pinned;
  if (p.pinned) p.archived = false;
  saveState();
  patientsBridge.renderPatientList();
}

export function togglePatientArchived(ev, id) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var p = patients.find(function (x) {
    return x.id === id;
  });
  if (!p) return;
  p.archived = !p.archived;
  if (p.archived) p.pinned = false;
  if (!p.archived) setArchivedSectionCollapsed(false);
  saveState();
  patientsBridge.renderPatientList();
  if (isLanSessionConfiguredForRest()) {
    lanSyncPatientArchivedFlag(p).catch(function () {
      rt.showToast('No se pudo sincronizar archivo con el host LAN.', 'error');
    });
  }
}

function readSidebarAutoHide() {
  try {
    return localStorage.getItem(SIDEBAR_AUTO_HIDE_LS) === '1';
  } catch {
    return false;
  }
}

function writeSidebarAutoHide(on) {
  try {
    localStorage.setItem(SIDEBAR_AUTO_HIDE_LS, on ? '1' : '0');
  } catch (_e) { void _e; }
}

function applySidebarAutoHideUi() {
  var on = readSidebarAutoHide();
  document.documentElement.classList.toggle('sidebar-auto-hide', on);
  if (!on) document.documentElement.classList.remove('sidebar-reveal');
  var btn = document.getElementById('btn-sidebar-auto-hide');
  if (btn) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on
      ? 'Mostrar barra de pacientes fija'
      : 'Ocultar barra de pacientes (reaparece al acercar el mouse)';
  }
}

export function toggleSidebarAutoHide() {
  writeSidebarAutoHide(!readSidebarAutoHide());
  applySidebarAutoHideUi();
}

export function initSidebarAutoHide() {
  var strip = document.getElementById('sidebar-hover-strip');
  var aside = document.getElementById('patient-sidebar');
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('rpc-mobile-web')) {
    writeSidebarAutoHide(false);
  }
  applySidebarAutoHideUi();
  if (!strip || !aside) return;
  function reveal() {
    if (readSidebarAutoHide()) document.documentElement.classList.add('sidebar-reveal');
  }
  function hide() {
    document.documentElement.classList.remove('sidebar-reveal');
  }
  strip.addEventListener('mouseenter', reveal);
  aside.addEventListener('mouseenter', reveal);
  aside.addEventListener('mouseleave', hide);
  strip.addEventListener('mouseleave', function (e) {
    var rel = e.relatedTarget;
    if (rel && (aside === rel || aside.contains(rel))) return;
    hide();
  });
}

export {
  openAddModal,
  openAddModalFromLab,
  openAddModalFromLabPatient,
  closeModal,
  confirmCloseAddPatientModal,
  savePatient,
  generatePatientId,
  buildPatientEntry,
  findPatientByRegistro,
  ensureUniquePatientName,
  focusPatientSearchInput,
  initPatientModalEnterSave,
};

export const windowHandlers = {
  onPatientSearchInput,
  focusPatientSearchInput,
  togglePatientPinned,
  togglePatientArchived,
  togglePatientRoundSeen,
  movePatientByOffset,
  toggleArchivedSection,
  toggleSidebarAutoHide,
  openAddModal,
  openAddModalFromLab,
  closeModal,
  savePatient,
  selectPatient,
  deletePatient,
  openFullExpedienteFromRound,
  returnToRoundOverview,
  closeRondaQuickMoreMenu,
};
