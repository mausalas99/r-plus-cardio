import {
  patientHasExplicitTeamAssignment,
  patientInJoinedTeamScope,
  r3ExtendedStructuralAccess,
} from '../clinico-access.mjs';

/** @param {object} ctx @returns {object|null} */
export function evaluateTeamScopeR3(ctx) {
  const {
    rank,
    targetPatient,
    joinedTeams,
    assignments,
    joinedTeamIds,
    userId,
    patientId,
    strictTeamFilter,
    currentUser,
    now,
    allow,
    deny,
  } = ctx;

  if (rank !== 'R3') return null;

  if (
    patientInJoinedTeamScope(
      targetPatient,
      joinedTeams,
      assignments,
      joinedTeamIds,
      userId,
      now,
      { strictTeamFilter }
    )
  ) {
    return allow('R3: paciente de mi equipo');
  }
  if (
    !strictTeamFilter &&
    !patientHasExplicitTeamAssignment(patientId, assignments) &&
    r3ExtendedStructuralAccess(currentUser, targetPatient, joinedTeams)
  ) {
    return allow('R3: servicio extendido');
  }
  return deny('R3: fuera de alcance');
}
