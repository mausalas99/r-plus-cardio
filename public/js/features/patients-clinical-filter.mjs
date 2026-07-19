import {
  isPatientReadableInClinicalScope,
  patientMatchesTeam,
  resolvePatientTeamIdFromAssignments,
  patientHasExplicitTeamAssignment,
  resolvePatientSala,
} from '../clinico-access.mjs';
import {
  shouldEnforceTeamPatientMirror,
  shouldUseElevatedPatientCensus,
} from '../clinical-privileges.mjs';
import { filterPatientsForMobileTeamMirror } from '../mobile-team-patient-scope.mjs';
import { CENSUS_TEAM_FILTER_UNASSIGNED } from './clinical-census-filters-ui.mjs';

/** Map chart patient row to scope patient shape. */
export function patientForScopeEvaluate(p) {
  return {
    id: String(p?.id || ''),
    service: String(p?.servicio || p?.service || ''),
    sub_area: String(p?.area || p?.sub_area || ''),
    sala: p?.sala,
    interconsult_type: p?.interconsult_type,
  };
}

/**
 * @param {object[]} patients
 * @param {object|null|undefined} user
 * @param {object} scopeContext
 * @param {Map<string, object>|null|undefined} [guardiasMap]
 */
export function filterPatientsForClinicalSidebar(patients, user, scopeContext, guardiasMap) {
  if (!user?.user_id) return shouldEnforceTeamPatientMirror() ? [] : patients || [];
  if (shouldEnforceTeamPatientMirror()) {
    return filterPatientsForMobileTeamMirror(patients, user, scopeContext, guardiasMap);
  }
  if (shouldUseElevatedPatientCensus(user)) return patients || [];
  return (patients || []).filter((p) => {
    if (!p) return false;
    const mapped = patientForScopeEvaluate(p);
    const activeGuardia =
      guardiasMap && typeof guardiasMap.get === 'function'
        ? guardiasMap.get(String(p.id)) || null
        : null;
    return isPatientReadableInClinicalScope(user, mapped, activeGuardia, scopeContext);
  });
}

/**
 * Client-only filters for elevated users (sala / teamId / service substring).
 * @param {object[]} patients
 * @param {{ sala?: string, teamId?: string, service?: string }} filters
 */
/**
 * Team for Filtros censo: explicit assignment wins, else structural match to team slice.
 * @param {object} patient
 * @param {string} teamId
 * @param {object[]} teams
 * @param {object[]} assignments
 * @param {Date|string|number} [now]
 */
export function patientMatchesCensusTeamFilter(patient, teamId, teams, assignments, now) {
  const tid = String(teamId || '');
  if (!tid) return true;
  const patientId = String(patient?.id || '');
  if (tid === CENSUS_TEAM_FILTER_UNASSIGNED) {
    if (patient._noExplicitTeamAssignment != null) return patient._noExplicitTeamAssignment;
    return !patientHasExplicitTeamAssignment(patientId, assignments);
  }
  const team = (teams || []).find((t) => String(t.team_id || '') === tid);
  if (!team) return false;
  if (patient._filterTeamId != null) return patient._filterTeamId === tid;
  const assigned = resolvePatientTeamIdFromAssignments(patientId, assignments, now);
  if (assigned) return assigned === tid;
  return patientMatchesTeam(patientForScopeEvaluate(patient), team);
}

/** @param {object} patient @param {object[]} teams @param {object[]} assignments @param {Date|string|number} [now] */
export function resolvePatientCensusTeamId(patient, teams, assignments, now) {
  const patientId = String(patient?.id || '');
  const assigned = resolvePatientTeamIdFromAssignments(patientId, assignments, now);
  if (assigned) return assigned;
  const mapped = patientForScopeEvaluate(patient);
  for (const team of teams || []) {
    if (patientMatchesTeam(mapped, team)) {
      return String(team.team_id || '');
    }
  }
  return '';
}

/**
 * Census sala filter: explicit patient sala, inferred sala, or assigned team's sala.
 * @param {object} patient
 * @param {string} sala
 * @param {object[]} teams
 * @param {object[]} assignments
 * @param {Date|string|number} [now]
 */
export function patientMatchesCensusSalaFilter(patient, sala, teams, assignments, now) {
  const target = String(sala || '').trim();
  if (!target) return true;
  if (String(patient?.sala || '').trim() === target) return true;
  if (resolvePatientSala(patient) === target) return true;
  const assignedTeamId = resolvePatientTeamIdFromAssignments(
    String(patient?.id || ''),
    assignments,
    now
  );
  if (!assignedTeamId) return false;
  const team = (teams || []).find((t) => String(t.team_id || '') === assignedTeamId);
  return String(team?.sala || '').trim() === target;
}

export function applyElevatedPatientFilters(patients, filters, ctx = {}) {
  let list = patients || [];
  const sala = filters.sala;
  const teams = ctx.teams || [];
  const assignments = ctx.assignments || [];
  const now = ctx.now || new Date().toISOString();
  if (sala && sala !== '__all__') {
    list = list.filter((p) => patientMatchesCensusSalaFilter(p, sala, teams, assignments, now));
  }
  if (filters?.teamId === CENSUS_TEAM_FILTER_UNASSIGNED) {
    list = list.filter((p) =>
      patientMatchesCensusTeamFilter(p, CENSUS_TEAM_FILTER_UNASSIGNED, teams, assignments, now)
    );
  } else if (filters?.teamId) {
    list = list.filter((p) =>
      patientMatchesCensusTeamFilter(p, filters.teamId, teams, assignments, now)
    );
  }
  if (filters?.service) {
    const q = String(filters.service).toLowerCase();
    list = list.filter((p) => String(p.servicio || '').toLowerCase().includes(q));
  }
  return list;
}

/**
 * @param {object[]} list
 * @param {{ teams?: object[], assignments?: object[], userId?: string, now?: string }} ctx
 */
export function tagPatientsForTeamFilter(list, ctx = {}) {
  const assignments = ctx.assignments || [];
  const teams = ctx.teams || [];
  const now = ctx.now || new Date().toISOString();
  for (const p of list) {
    if (!p) continue;
    p._filterTeamId = resolvePatientCensusTeamId(p, teams, assignments, now);
    p._noExplicitTeamAssignment = !patientHasExplicitTeamAssignment(
      String(p.id || ''),
      assignments
    );
  }
  return list;
}

/**
 * Clinical scope + optional Filtros censo (elevated users).
 * @param {object[]} basePatients
 * @param {object|null|undefined} user
 * @param {object} scopeContext
 * @param {Map<string, object>|null|undefined} [guardiasMap]
 * @param {{ sala?: string, teamId?: string, service?: string }} [elevatedFilters]
 */
export function filterPatientsForGuardiaCensus(
  basePatients,
  user,
  scopeContext,
  guardiasMap,
  elevatedFilters = {}
) {
  if (!user?.user_id) return basePatients || [];
  let visible = filterPatientsForClinicalSidebar(
    basePatients,
    user,
    scopeContext,
    guardiasMap
  );
  const applyCensusToolbarFilters =
    shouldUseElevatedPatientCensus(user) || shouldEnforceTeamPatientMirror();
  if (!applyCensusToolbarFilters) return visible;
  const filterCtx = {
    teams: scopeContext.teams || [],
    assignments: scopeContext.assignments || [],
    now: scopeContext.now || new Date().toISOString(),
  };
  tagPatientsForTeamFilter(visible, filterCtx);
  return applyElevatedPatientFilters(visible, elevatedFilters, filterCtx);
}
