import { patientInJoinedTeamScope, patientInUserSala } from '../clinico-access.mjs';

/** @param {object} ctx @returns {object|null} */
export function evaluateTeamScopeEntregaR1(ctx) {
  const {
    rank,
    entregaPhaseActive,
    enforceTeamPatientScope,
    targetPatient,
    joinedTeams,
    assignments,
    joinedTeamIds,
    userId,
    userSala,
    now,
    allow,
    deny,
  } = ctx;

  if (!entregaPhaseActive || rank !== 'R1') return null;

  if (enforceTeamPatientScope) {
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
      return allow('Fase entrega R1: paciente de mi equipo', true, false);
    }
    return deny('Fase entrega R1: fuera de mi equipo');
  }
  if (patientInUserSala(targetPatient, userSala)) {
    return allow('Fase entrega R1: censo de sala', true, false);
  }
  return deny('Fase entrega R1: fuera de mi sala');
}
