import { getJoinedTeamsForUser } from '../clinico-access-teams.mjs';
import { makeAllowDeny } from './shared.mjs';

/** @param {string|Date|undefined|null} ctxNow */
export function resolveScopeNow(ctxNow) {
  if (ctxNow == null) return new Date();
  if (ctxNow instanceof Date) return ctxNow;
  return new Date(String(ctxNow));
}

/**
 * @param {object|null|undefined} currentUser
 * @param {object|null|undefined} targetPatient
 * @param {object|null|undefined} activeGuardia
 * @param {object|null|undefined} context
 */
export function buildScopeContext(currentUser, targetPatient, activeGuardia, context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const teams = Array.isArray(ctx.teams) ? ctx.teams : [];
  const assignments = Array.isArray(ctx.assignments) ? ctx.assignments : [];
  const guardias = Array.isArray(ctx.guardias) ? ctx.guardias : [];
  const cycle = ctx.cycle ?? null;
  const guardiaMode = !!ctx.guardiaMode;
  const now = resolveScopeNow(ctx.now);
  const userId = String(currentUser?.user_id || '');
  const rank = String(currentUser?.rank || '');
  const patientId = String(targetPatient?.id || '');
  const userSala = String(currentUser?.sala || '');
  const enforceTeamPatientScope = !!ctx.enforceTeamPatientScope;
  const { allow, deny } = makeAllowDeny(currentUser, targetPatient, now);

  return {
    teams,
    assignments,
    guardias,
    cycle,
    guardiaMode,
    now,
    userId,
    rank,
    patientId,
    userSala,
    enforceTeamPatientScope,
    allow,
    deny,
    scopeCtx: {
      currentUser,
      targetPatient,
      activeGuardia,
      rank,
      userId,
      patientId,
      userSala,
      assignments,
      cycle,
      guardias,
      enforceTeamPatientScope,
      entregaPhaseActive: !!ctx.entregaPhaseActive,
      onCallGuardiaReceiver: ctx.onCallGuardiaReceiver,
      now,
      allow,
      deny,
    },
  };
}

/** @param {object} built @param {string} userId */
export function attachJoinedTeamScope(built, userId) {
  const { teams, scopeCtx, enforceTeamPatientScope } = built;
  const currentUser = scopeCtx.currentUser;
  const joinedTeams = getJoinedTeamsForUser(teams, currentUser || userId);
  const joinedTeamIds = new Set(joinedTeams.map((t) => String(t.team_id)));
  const strictTeamFilter = enforceTeamPatientScope ? true : joinedTeams.length > 0;
  Object.assign(scopeCtx, { joinedTeams, joinedTeamIds, strictTeamFilter });
  return scopeCtx;
}
