import { normalizeServiceKey } from '../clinico-access.mjs';

/**
 * @param {object} ctx
 * @returns {object|null}
 */
export function evaluateGuardiaR4(ctx) {
  const { rank, targetPatient, allow, deny } = ctx;

  if (rank !== 'R4') return null;

  const svc = normalizeServiceKey(targetPatient?.service);
  if (svc.includes('sala') || svc.includes('torre')) {
    return allow('Modo Guardia R4: cobertura Sala + Torre', true, false);
  }
  return deny('Modo Guardia R4: fuera de dominio');
}
