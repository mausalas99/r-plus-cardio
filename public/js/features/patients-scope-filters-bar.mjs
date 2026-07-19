import { CLINICAL_SALA_VALUES } from '../../../lib/clinical-salas.mjs';
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { elevatedPatientFilters } from './clinical-census-filters-state.mjs';
import {
  readCensusFiltersCollapsed,
  writeCensusFiltersCollapsed,
  resolveCensusTeamFilterId,
  writeElevatedTeamFilterPreference,
  CENSUS_TEAM_FILTER_UNASSIGNED,
  reconcileCensusTeamFilterForSala,
  censusTeamCatalogForFilters,
  censusFiltersUseFullTeamCatalog,
} from './clinical-census-filters-ui.mjs';

function buildCensusFiltersBarHtml(user, mobileSidebar) {
  const showSalaFilter = !mobileSidebar || censusFiltersUseFullTeamCatalog(user);
  const salaBlock = showSalaFilter
    ? '<label class="clinical-census-filter"><span>Sala</span>' +
      '<select id="clinical-filter-sala" class="profile-input">' +
      '<option value="__all__">Todas</option>' +
      CLINICAL_SALA_VALUES.map((s) => `<option value="${s}">${s}</option>`).join('') +
      '</select></label>'
    : '';
  return (
    '<button type="button" id="btn-clinical-census-filters-toggle" class="clinical-census-filters-toggle" aria-expanded="true" aria-controls="clinical-census-filters-body">' +
    '<span class="clinical-census-filters-toggle-label">Filtros censo</span>' +
    '<span class="clinical-census-filters-chevron" aria-hidden="true"></span></button>' +
    '<div id="clinical-census-filters-body" class="clinical-census-filters-body">' +
    salaBlock +
    '<label class="clinical-census-filter"><span>Equipo</span>' +
    '<select id="clinical-filter-team" class="profile-input">' +
    '<option value="">Todos los equipos</option>' +
    '<option value="__unassigned__">Sin equipo asignado</option>' +
    '</select></label>' +
    '<label class="clinical-census-filter"><span>Servicio</span>' +
    '<input type="search" id="clinical-filter-service" class="profile-input" placeholder="Filtrar…" autocomplete="off">' +
    '</label></div>'
  );
}

function wireCensusFiltersCollapse(bar) {
  const applyCensusFiltersCollapsedUi = (collapsed) => {
    const toggleBtn = document.getElementById('btn-clinical-census-filters-toggle');
    const body = document.getElementById('clinical-census-filters-body');
    if (!toggleBtn || !body) return;
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    body.hidden = collapsed;
    bar.classList.toggle('is-collapsed', collapsed);
  };

  applyCensusFiltersCollapsedUi(readCensusFiltersCollapsed());

  const toggleBtn = bar.querySelector('#btn-clinical-census-filters-toggle');
  if (toggleBtn && !toggleBtn._rpcCensusToggleWired) {
    toggleBtn._rpcCensusToggleWired = true;
    toggleBtn.addEventListener('click', () => {
      const next = !bar.classList.contains('is-collapsed');
      writeCensusFiltersCollapsed(next);
      applyCensusFiltersCollapsedUi(next);
    });
  }
}

/** @param {HTMLElement} bar @param {() => void} refreshCensusViews */
export function wireCensusFilterInputs(bar, refreshCensusViews) {
  wireCensusFiltersCollapse(bar);
  const salaSel = bar.querySelector('#clinical-filter-sala');
  const teamSel = bar.querySelector('#clinical-filter-team');
  const serviceInp = bar.querySelector('#clinical-filter-service');
  if (salaSel) {
    salaSel.addEventListener('change', () => {
      elevatedPatientFilters.sala = String(salaSel.value || '__all__');
      syncCensusTeamFilterSelect(clinicalSessionContext.user);
      refreshCensusViews();
    });
  }
  if (teamSel) {
    teamSel.addEventListener('change', () => {
      elevatedPatientFilters.teamId = String(teamSel.value || '');
      writeElevatedTeamFilterPreference(elevatedPatientFilters.teamId);
      refreshCensusViews();
    });
  }
  if (serviceInp) {
    serviceInp.addEventListener('input', () => {
      elevatedPatientFilters.service = String(serviceInp.value || '').trim();
      refreshCensusViews();
    });
  }
}

/** @param {object} user @param {HTMLElement} filtersMount @param {boolean} mobileSidebar */
export function createCensusFiltersBar(user, filtersMount, mobileSidebar) {
  const bar = document.createElement('div');
  bar.id = 'clinical-census-filters';
  bar.className =
    'clinical-census-filters clinical-census-filters--toolbar' +
    (mobileSidebar ? ' clinical-census-filters--mobile-sidebar' : '');
  bar.innerHTML = buildCensusFiltersBarHtml(user, mobileSidebar);
  if (bar.parentElement && bar.parentElement !== filtersMount) {
    bar.remove();
  }
  filtersMount.appendChild(bar);
  filtersMount.hidden = false;
  filtersMount.setAttribute('aria-hidden', 'false');
  return bar;
}

/** @param {object} user */
export function syncCensusTeamFilterSelect(user) {
  const teamSel = document.getElementById('clinical-filter-team');
  if (!teamSel) return;
  const teams = clinicalSessionContext.teams || [];
  const salaFilter = String(elevatedPatientFilters.sala || '__all__');
  const teamsForCatalog = censusTeamCatalogForFilters(user, teams, salaFilter);
  const priorTeamId = String(elevatedPatientFilters.teamId ?? '');
  let teamFilterId = resolveCensusTeamFilterId(user, teamsForCatalog, priorTeamId);
  teamFilterId = reconcileCensusTeamFilterForSala(teamFilterId, teamsForCatalog);
  if (teamFilterId !== priorTeamId) {
    writeElevatedTeamFilterPreference(teamFilterId);
  }
  elevatedPatientFilters.teamId = teamFilterId;
  const unassignedOpt = censusFiltersUseFullTeamCatalog(user)
    ? `<option value="${CENSUS_TEAM_FILTER_UNASSIGNED}">Sin equipo asignado</option>`
    : '';
  teamSel.innerHTML =
    '<option value="">Todos los equipos</option>' +
    unassignedOpt +
    teamsForCatalog
      .map((t) => {
        const id = String(t.team_id || '');
        const label = String(t.name || id).slice(0, 40);
        return `<option value="${id}">${label}</option>`;
      })
      .join('');
  teamSel.value = teamFilterId;
}

/** @param {object} user */
export function syncCensusScalarFilterInputs(user) {
  const salaSel = document.getElementById('clinical-filter-sala');
  const serviceInp = document.getElementById('clinical-filter-service');
  if (salaSel && salaSel.value !== elevatedPatientFilters.sala) {
    salaSel.value = elevatedPatientFilters.sala;
  }
  syncCensusTeamFilterSelect(user);
  if (serviceInp && serviceInp.value !== elevatedPatientFilters.service) {
    serviceInp.value = elevatedPatientFilters.service;
  }
}
