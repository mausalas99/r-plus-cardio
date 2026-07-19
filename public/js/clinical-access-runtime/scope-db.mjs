import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { electronApi } from './electron-api.mjs';

/** @returns {Promise<object|null>} */
export async function fetchClinicalScopeContextFromDb() {
  const api = electronApi();
  const userId = clinicalSessionContext.user?.user_id;
  if (!api || typeof api.dbClinicalScopeContext !== 'function' || !userId) {
    // iPad/PWA: keep LAN-hydrated scopeContext when SQLCipher IPC is unavailable.
    return clinicalSessionContext.scopeContext ?? null;
  }
  const res = await api.dbClinicalScopeContext({ userId });
  if (!res || res.ok === false) {
    clinicalSessionContext.scopeContext = null;
    return null;
  }
  clinicalSessionContext.scopeContext = res.context ?? null;
  if (Array.isArray(res.context?.teams)) {
    clinicalSessionContext.teams = res.context.teams;
  }
  return clinicalSessionContext.scopeContext;
}

/** @returns {Promise<object[]>} */
export async function fetchClinicalTeamsFromDb() {
  const api = electronApi();
  if (!api || typeof api.dbClinicalTeamsList !== 'function') {
    clinicalSessionContext.teams = [];
    return [];
  }
  const res = await api.dbClinicalTeamsList();
  if (!res || res.ok === false) {
    clinicalSessionContext.teams = [];
    return [];
  }
  const teams = Array.isArray(res.teams) ? res.teams : [];
  clinicalSessionContext.teams = teams;
  return teams;
}

/** @returns {Promise<object|null>} */
export async function fetchActiveRotationCycleFromDb() {
  const api = electronApi();
  if (!api || typeof api.dbRotationCycleGet !== 'function') return null;
  const res = await api.dbRotationCycleGet();
  if (!res || res.ok === false) return null;
  return res.cycle ?? null;
}

/** @returns {Promise<object[]>} */
export async function fetchIncomingAssignmentsFromDb() {
  const api = electronApi();
  if (!api || typeof api.dbRotationIncomingAssignments !== 'function') return [];
  const res = await api.dbRotationIncomingAssignments();
  if (!res || res.ok === false) return [];
  return Array.isArray(res.assignments) ? res.assignments : [];
}
