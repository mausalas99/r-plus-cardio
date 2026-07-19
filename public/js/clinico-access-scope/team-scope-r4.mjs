/** @param {object} ctx @returns {object|null} */
export function evaluateTeamScopeR4(ctx) {
  const { rank, enforceTeamPatientScope, allow } = ctx;
  if (!enforceTeamPatientScope && rank === 'R4') {
    return allow('R4: acceso global');
  }
  return null;
}
