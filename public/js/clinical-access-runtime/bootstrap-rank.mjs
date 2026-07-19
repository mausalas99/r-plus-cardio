/**
 * @param {Record<string, unknown>|null|undefined} settings
 * @param {string} [clientId]
 */
export function resolveClinicalRank(settings, clientId) {
  void clientId;
  const rank = settings && settings.clinicalRank ? String(settings.clinicalRank) : 'R1';
  const allowed = new Set(['R1', 'R2', 'R3', 'R4', 'Admin']);
  return allowed.has(rank) ? rank : 'R1';
}
