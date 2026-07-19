/**
 * Guardia mode ranks without dedicated evaluators (R3, R5, …).
 * @param {object} ctx
 * @returns {object|null}
 */
export function evaluateGuardiaFallback(ctx) {
  const { rank, deny } = ctx;

  if (rank === 'R1' || rank === 'R2' || rank === 'R4') return null;

  return deny('Modo Guardia: rango sin cobertura');
}
