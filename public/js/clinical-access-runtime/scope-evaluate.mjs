import { shouldEnforceTeamPatientMirror } from '../clinical-privileges.mjs';
import { readEntregaPhaseActive } from '../clinico-access.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';

function scopeContextForEvaluateFromParts(parts) {
  const enforceTeamPatientScope =
    parts.enforceTeamPatientScope != null
      ? !!parts.enforceTeamPatientScope
      : shouldEnforceTeamPatientMirror();
  return {
    teams: parts.teams,
    guardias: parts.guardias,
    cycle: parts.cycle,
    assignments: parts.assignments,
    salaGuardiaToday: parts.salaGuardiaToday,
    guardiaMode: parts.guardiaMode,
    entregaPhaseActive: parts.entregaPhaseActive,
    enforceTeamPatientScope,
    now: parts.now,
  };
}

/** @returns {object} */
export function getClinicalScopeContextForEvaluate() {
  const cached = clinicalSessionContext.scopeContext;
  if (cached && typeof cached === 'object') {
    return scopeContextForEvaluateFromParts({
      teams: Array.isArray(cached.teams) ? cached.teams : clinicalSessionContext.teams,
      guardias: Array.isArray(cached.guardias)
        ? cached.guardias
        : clinicalSessionContext.guardias,
      cycle: cached.cycle ?? null,
      assignments: Array.isArray(cached.assignments) ? cached.assignments : [],
      salaGuardiaToday: Array.isArray(cached.salaGuardiaToday) ? cached.salaGuardiaToday : [],
      guardiaMode:
        cached.guardiaMode != null
          ? !!cached.guardiaMode
          : !!clinicalSessionContext.guardiaMode,
      entregaPhaseActive:
        cached.entregaPhaseActive != null
          ? !!cached.entregaPhaseActive
          : readEntregaPhaseActive(),
      enforceTeamPatientScope: shouldEnforceTeamPatientMirror()
        ? true
        : cached.enforceTeamPatientScope,
      now: cached.now || new Date().toISOString(),
    });
  }
  const fallbackAssignments = Array.isArray(clinicalSessionContext.scopeContext?.assignments)
    ? clinicalSessionContext.scopeContext.assignments
    : [];
  return scopeContextForEvaluateFromParts({
    teams: clinicalSessionContext.teams,
    guardias: clinicalSessionContext.guardias,
    cycle: null,
    assignments: fallbackAssignments,
    salaGuardiaToday: [],
    guardiaMode: !!clinicalSessionContext.guardiaMode,
    entregaPhaseActive: readEntregaPhaseActive(),
    enforceTeamPatientScope: shouldEnforceTeamPatientMirror(),
    now: new Date().toISOString(),
  });
}
