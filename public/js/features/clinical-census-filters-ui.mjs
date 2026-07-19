export const CLINICAL_CENSUS_FILTERS_COLLAPSED_LS = 'rpc.clinicalCensusFiltersCollapsed';
export const CLINICAL_CENSUS_FILTER_TEAM_LS = 'rpc.clinicalCensusFilterTeam';
import { hasElevatedTeamPrivileges, shouldEnforceTeamPatientMirror } from '../clinical-privileges.mjs';
import { filterJoinedTeams } from './clinical-teams/shared.mjs';

export const CENSUS_TEAM_FILTER_ALL = '__all__';
export const CENSUS_TEAM_FILTER_UNASSIGNED = '__unassigned__';

/** @param {object[]} teams @param {object|null|undefined} user */
function joinedTeamsForUser(teams, user) {
  const uid = String(user?.user_id || '');
  if (!uid) return [];
  return (teams || []).filter((team) =>
    (team.members || []).some((m) => String(m.user_id) === uid)
  );
}

/**
 * Prefer the user's joined team in their sala; otherwise first membership.
 * @param {object|null|undefined} user
 * @param {object[]} teams
 */
export function resolveActiveTeamFilterId(user, teams) {
  const joined = joinedTeamsForUser(teams, user);
  if (!joined.length) return '';
  if (joined.length === 1) return String(joined[0].team_id || '');
  const sala = String(user?.sala || '').trim();
  const inSala = joined.find((t) => String(t.sala || '') === sala);
  return String((inSala || joined[0]).team_id || '');
}

/** @param {Storage|undefined} storage */
export function readElevatedTeamFilterPreference(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CLINICAL_CENSUS_FILTER_TEAM_LS);
    if (raw === CENSUS_TEAM_FILTER_ALL) return { pinned: true, teamId: '' };
    if (raw) return { pinned: true, teamId: String(raw) };
  } catch (_e) { void _e; }
  return { pinned: false, teamId: '' };
}

/** @param {string} teamId @param {Storage|undefined} storage */
export function writeElevatedTeamFilterPreference(teamId, storage = globalThis.localStorage) {
  try {
    storage?.setItem(
      CLINICAL_CENSUS_FILTER_TEAM_LS,
      teamId ? String(teamId) : CENSUS_TEAM_FILTER_ALL
    );
  } catch (_e) { void _e; }
}

/**
 * Census Equipo filter: default to active membership unless user chose Todos/another team.
 * @param {object|null|undefined} user
 * @param {object[]} teams
 * @param {Storage|undefined} storage
 */
export function resolveElevatedTeamFilterId(user, teams, storage = globalThis.localStorage) {
  const pref = readElevatedTeamFilterPreference(storage);
  if (pref.pinned) return pref.teamId;
  // R4 / Admin / program admin: full censo by default; narrow via Equipo dropdown.
  return '';
}

/** Admin/R4 on iPad: full ward team catalog; residents see only joined teams. */
export function censusFiltersUseFullTeamCatalog(user) {
  if (!shouldEnforceTeamPatientMirror()) return true;
  return hasElevatedTeamPrivileges(user);
}

/**
 * Equipo options for Filtros censo — joined teams on iPad for R1–R3; full sala list for Admin/R4.
 * @param {object|null|undefined} user
 * @param {object[]} teams
 * @param {string} [salaFilter]
 */
export function censusTeamCatalogForFilters(user, teams, salaFilter) {
  const salaScoped = filterTeamsForCensusSala(teams, salaFilter);
  if (censusFiltersUseFullTeamCatalog(user)) return salaScoped;
  return filterJoinedTeams(salaScoped, user);
}

/**
 * @param {object|null|undefined} user
 * @param {object[]} teamsForCatalog
 * @param {string} [priorTeamId]
 * @param {Storage|undefined} storage
 */
export function resolveCensusTeamFilterId(user, teamsForCatalog, priorTeamId = '', storage = globalThis.localStorage) {
  const prior = String(priorTeamId ?? '');
  const pref = readElevatedTeamFilterPreference(storage);
  if (pref.pinned) return pref.teamId;
  if (prior) return prior;
  if (shouldEnforceTeamPatientMirror() && !censusFiltersUseFullTeamCatalog(user)) {
    return resolveActiveTeamFilterId(user, teamsForCatalog);
  }
  return resolveElevatedTeamFilterId(user, teamsForCatalog, storage);
}

/** @param {string} teamId @param {object[]} teams */
export function isTeamIdInCensusCatalog(teamId, teams) {
  if (!teamId || teamId === CENSUS_TEAM_FILTER_UNASSIGNED) return true;
  return (teams || []).some((t) => String(t.team_id || '') === String(teamId));
}

/**
 * Equipo dropdown options for Filtros censo — scoped to selected sala.
 * @param {object[]} teams
 * @param {string} [salaFilter] — `__all__` or a sala name
 */
export function filterTeamsForCensusSala(teams, salaFilter) {
  const list = Array.isArray(teams) ? teams : [];
  const sala = String(salaFilter || '').trim();
  if (!sala || sala === '__all__') return list;
  return list.filter((t) => String(t.sala || '').trim() === sala);
}

/**
 * Clear team filter when it no longer exists in the sala-scoped catalog.
 * @param {string} teamId
 * @param {object[]} teamsForSala
 */
export function reconcileCensusTeamFilterForSala(teamId, teamsForSala) {
  const tid = String(teamId || '');
  if (!tid || tid === CENSUS_TEAM_FILTER_UNASSIGNED) return tid;
  if (isTeamIdInCensusCatalog(tid, teamsForSala)) return tid;
  return '';
}

/** @param {Storage|undefined} storage */
export function readCensusFiltersCollapsed(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(CLINICAL_CENSUS_FILTERS_COLLAPSED_LS) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} collapsed @param {Storage|undefined} storage */
export function writeCensusFiltersCollapsed(collapsed, storage = globalThis.localStorage) {
  try {
    if (collapsed) storage?.setItem(CLINICAL_CENSUS_FILTERS_COLLAPSED_LS, '1');
    else storage?.removeItem(CLINICAL_CENSUS_FILTERS_COLLAPSED_LS);
  } catch (_e) { void _e; }
}
