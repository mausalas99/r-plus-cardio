import { patientCoveredByGuardia, patientInJoinedTeamScope } from '../clinico-access.mjs';

/**
 * @param {object} ctx
 * @returns {object|null}
 */
export function evaluateGuardiaR1(ctx) {
  const {
    rank,
    userId,
    userSala,
    patientId,
    targetPatient,
    joinedTeams,
    joinedTeamIds,
    assignments,
    guardias,
    enforceTeamPatientScope,
    onCallGuardiaReceiver,
    now,
    allow,
    deny,
  } = ctx;

  if (rank !== 'R1') return null;

  if (onCallGuardiaReceiver) {
    if (patientCoveredByGuardia(patientId, userId, guardias)) {
      return allow('Modo Guardia R1: paciente entregado', true, false);
    }
    return deny('Modo Guardia R1: sin entrega recibida');
  }
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
      return allow('Modo Guardia R1: paciente de mi equipo', true, false);
    }
    if (patientCoveredByGuardia(patientId, userId, guardias)) {
      return allow('Modo Guardia R1: paciente entregado', true, false);
    }
    return deny('Modo Guardia R1: fuera de mi equipo');
  }
  const patientSala = targetPatient?.sala || '';
  if (patientSala && patientSala === userSala) {
    return allow('Modo Guardia R1: visibilidad de Sala completa', true, false);
  }
  return deny('Modo Guardia R1: fuera de mi Sala');
}
