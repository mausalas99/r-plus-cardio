import { patientAssignedToTeam, patientCoveredByGuardia } from '../clinico-access.mjs';

/** @param {object} ctx @returns {object} */
export function evaluateTeamScopeTail(ctx) {
  const { patientId, assignments, joinedTeamIds, now, userId, guardias, allow, deny } = ctx;

  if (patientAssignedToTeam(patientId, assignments, joinedTeamIds, now)) {
    return allow('Paciente del equipo (asignación)');
  }

  if (patientCoveredByGuardia(patientId, userId, guardias)) {
    return allow('Paciente entregado (handoff)');
  }

  return deny('Fuera de alcance');
}
