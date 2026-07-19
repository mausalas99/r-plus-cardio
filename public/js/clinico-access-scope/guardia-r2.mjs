import { patientCoveredByGuardia } from '../clinico-access.mjs';

/**
 * @param {object} ctx
 * @returns {object|null}
 */
export function evaluateGuardiaR2(ctx) {
  const { rank, userId, patientId, guardias, allow, deny } = ctx;

  if (rank !== 'R2') return null;

  if (patientCoveredByGuardia(patientId, userId, guardias)) {
    return allow('Modo Guardia R2: paciente entregado', true, false);
  }
  return deny('Modo Guardia R2: sin entrega recibida');
}
