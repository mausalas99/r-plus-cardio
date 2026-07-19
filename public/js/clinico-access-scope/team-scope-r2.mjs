import {
  patientCoveredByGuardia,
  patientInJoinedTeamScope,
  patientInUserSala,
} from '../clinico-access.mjs';

/** @param {object} ctx @returns {object|null} */
export function evaluateTeamScopeR2(ctx) {
  const {
    rank,
    patientId,
    userId,
    guardias,
    targetPatient,
    joinedTeams,
    assignments,
    joinedTeamIds,
    strictTeamFilter,
    enforceTeamPatientScope,
    userSala,
    now,
    allow,
    deny,
  } = ctx;

  if (rank !== 'R2') return null;

  if (patientCoveredByGuardia(patientId, userId, guardias)) {
    return allow('R2: paciente entregado');
  }
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
    return allow('R2: paciente de mi equipo');
  }
  if (!strictTeamFilter && !enforceTeamPatientScope && patientInUserSala(targetPatient, userSala)) {
    return allow('R2: paciente en mi sala');
  }
  return deny('R2: sin equipo ni entrega');
}
