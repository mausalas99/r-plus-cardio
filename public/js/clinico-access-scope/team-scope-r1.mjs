import { patientCoveredByGuardia, patientInJoinedTeamScope, patientInUserSala } from '../clinico-access.mjs';

/** @param {object} ctx @returns {object|null} */
export function evaluateTeamScopeR1(ctx) {
  const {
    rank,
    strictTeamFilter,
    enforceTeamPatientScope,
    targetPatient,
    joinedTeams,
    assignments,
    joinedTeamIds,
    userId,
    patientId,
    userSala,
    guardias,
    now,
    allow,
    deny,
  } = ctx;

  if (rank !== 'R1') return null;

  if (strictTeamFilter) {
    if (
      patientInJoinedTeamScope(
        targetPatient,
        joinedTeams,
        assignments,
        joinedTeamIds,
        userId,
        now,
        { strictTeamFilter: true }
      )
    ) {
      return allow('R1: paciente de mi equipo');
    }
    if (patientCoveredByGuardia(patientId, userId, guardias)) {
      return allow('R1: paciente entregado');
    }
    return deny('R1: fuera de mi equipo');
  }
  if (!enforceTeamPatientScope && patientInUserSala(targetPatient, userSala)) {
    return allow('R1: paciente en mi sala');
  }
  return deny('R1: fuera de mi sala');
}
