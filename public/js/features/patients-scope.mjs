import { patients } from '../app-state.mjs';
import {
  ensureTeamAssignedPatientsOnDevice,
  renderGuardiaCensusGrid,
  clinicalSessionContext,
  getClinicalScopeContextForEvaluate,
  isClinicalScopeReadyForLanPatientApply,
} from '../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror, shouldShowClinicalCensusFilters } from '../clinical-privileges.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import {
  filterPatientsForGuardiaCensus as filterPatientsForGuardiaCensusCore,
} from './patients-clinical-filter.mjs';
import { elevatedPatientFilters } from './clinical-census-filters-state.mjs';
import { syncClinicalContextBarVisibility } from './clinical-context-bar.mjs';
import {
  createCensusFiltersBar,
  syncCensusScalarFilterInputs,
  wireCensusFilterInputs,
} from './patients-scope-filters-bar.mjs';
import { filterPatientsForPitchTour } from '../tour-pitch-demo-seed.mjs';
import { isGuardiaMode } from './chrome.mjs';
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';

let patientSearchFilter = '';

export function getPatientSearchFilter() {
  return patientSearchFilter;
}

export function setPatientSearchFilter(val) {
  patientSearchFilter = (val || '').trim().toLowerCase();
}

export function patientMatchesSearch(p) {
  if (!patientSearchFilter) return true;
  var q = patientSearchFilter;
  return (
    String(p.nombre || '')
      .toLowerCase()
      .indexOf(q) !== -1 ||
    String(p.registro || '')
      .toLowerCase()
      .indexOf(q) !== -1 ||
    String(p.cuarto || '')
      .toLowerCase()
      .indexOf(q) !== -1 ||
    String(p.cama || '')
      .toLowerCase()
      .indexOf(q) !== -1 ||
    String(p.servicio || '')
      .toLowerCase()
      .indexOf(q) !== -1 ||
    String(p.area || '')
      .toLowerCase()
      .indexOf(q) !== -1
  );
}

export function patientsVisibleInSidebar() {
  const base = filterPatientsForPitchTour(patients);
  if (shouldEnforceTeamPatientMirror() && !isClinicalScopeReadyForLanPatientApply()) {
    return [];
  }
  return filterPatientsForGuardiaCensus(base);
}

export function pickDefaultVisiblePatientId() {
  const visible = patientsVisibleInSidebar();
  if (!visible.length) return null;
  const activeId = rt.getActiveId();
  if (
    activeId != null &&
    visible.some(function (p) {
      return String(p.id) === String(activeId);
    })
  ) {
    return activeId;
  }
  return visible[0].id;
}

export function ensureActivePatientInSidebarScope() {
  const nextId = pickDefaultVisiblePatientId();
  if (nextId != null) {
    patientsBridge.selectPatient(nextId);
    return true;
  }
  if (rt.getActiveId() == null) return false;
  rt.setActiveId(null);
  const pv = document.getElementById('patient-view');
  const es = document.getElementById('empty-state');
  if (pv) pv.style.display = 'none';
  if (es) es.style.display = 'flex';
  rt.syncWorkContextChrome();
  return false;
}

export function reselectIfActivePatientHidden(visiblePatients) {
  const activeId = rt.getActiveId();
  if (activeId == null) return false;
  const stillVisible = visiblePatients.some(function (p) {
    return String(p.id) === String(activeId);
  });
  if (stillVisible) return false;
  ensureActivePatientInSidebarScope();
  return true;
}

export function filterPatientsForGuardiaCensus(basePatients) {
  return filterPatientsForGuardiaCensusCore(
    basePatients,
    clinicalSessionContext.user,
    getClinicalScopeContextForEvaluate(),
    clinicalSessionContext.guardiasMap,
    elevatedPatientFilters
  );
}

export function syncClinicalCensusFiltersChrome() {
  syncClinicalCensusFiltersBar();
}

/** Filtros censo — apply toolbar state immediately, then optional LAN census pull. */
export function refreshCensusViewsAfterFilterChange() {
  const user = clinicalSessionContext.user;
  if (user) syncCensusScalarFilterInputs(user);
  patientsBridge.renderPatientList();
  if (isGuardiaMode()) renderGuardiaCensusGrid(rt.getSettings());
  if (shouldEnforceTeamPatientMirror()) return;
  void ensureTeamAssignedPatientsOnDevice({ allowLanPull: true, lanPullDelayMs: 5000 }).then(() => {
    patientsBridge.renderPatientList({ silent: true });
    if (isGuardiaMode()) renderGuardiaCensusGrid(rt.getSettings());
  });
}

function censusFiltersMountEl() {
  if (isMobileWeb()) {
    return document.getElementById('clinical-census-filters-sidebar-mount');
  }
  return document.getElementById('clinical-census-filters-mount');
}

function hideCensusFiltersMounts() {
  ['clinical-census-filters-mount', 'clinical-census-filters-sidebar-mount'].forEach(function (id) {
    const mount = document.getElementById(id);
    if (!mount) return;
    mount.hidden = true;
    mount.setAttribute('aria-hidden', 'true');
  });
}

export function syncClinicalCensusFiltersBar() {
  const user = clinicalSessionContext.user;
  const showFilters = user && shouldShowClinicalCensusFilters(user);
  const filtersMount = censusFiltersMountEl();
  let bar = document.getElementById('clinical-census-filters');
  if (
    !showFilters ||
    (shouldEnforceTeamPatientMirror() && !isClinicalScopeReadyForLanPatientApply())
  ) {
    if (bar) bar.remove();
    hideCensusFiltersMounts();
    syncClinicalContextBarVisibility();
    return;
  }
  if (!filtersMount) return;
  try {
    const storedSala = localStorage.getItem('clinical.censusFilterSala');
    if (storedSala) {
      elevatedPatientFilters.sala = storedSala;
      localStorage.removeItem('clinical.censusFilterSala');
    }
  } catch (_e) { void _e; }
  const mobileSidebar = isMobileWeb();
  if (!bar) {
    bar = createCensusFiltersBar(user, filtersMount, mobileSidebar);
    wireCensusFilterInputs(bar, refreshCensusViewsAfterFilterChange);
  }
  syncCensusScalarFilterInputs(user);
  syncClinicalContextBarVisibility();
}
