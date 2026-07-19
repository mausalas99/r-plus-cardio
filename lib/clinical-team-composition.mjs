/** @param {unknown} value */
function normalizeServiceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** @typedef {{ r1: number, r2: number, r3: number }} TeamCompositionLimits */

/** @type {Record<string, TeamCompositionLimits>} */
export const TEAM_COMPOSITION_BY_SERVICE = {
  interconsultas: { r1: 1, r2: 1, r3: 2 },
  ux: { r1: 1, r2: 1, r3: 1 },
  eme: { r1: 1, r2: 0, r3: 1 },
};

/** @param {string} service */
export function getTeamCompositionLimits(service) {
  const key = normalizeServiceKey(service);
  return TEAM_COMPOSITION_BY_SERVICE[key] || null;
}

/** Services where UX/Eme staff rotate to Interconsultas on off-call days. */
export const OFF_CALL_INTERCONSULTAS_SERVICES = new Set(['ux', 'eme']);

/**
 * @param {string} service
 * @param {string} rank
 * @param {Array<{ rank?: string }>} members
 * @returns {string|null} error message
 */
export function validateTeamRankSlot(service, rank, members) {
  const limits = getTeamCompositionLimits(service);
  if (!limits) return null;
  const r = String(rank || '').trim().toUpperCase();
  const slotKey = r.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(limits, slotKey)) return null;
  const max = limits[slotKey];
  if (max === 0) {
    return `${r} no participa en equipos de ${String(service || '').trim()}.`;
  }
  const count = (members || []).filter((m) => String(m?.rank || '').toUpperCase() === r).length;
  if (count >= max) {
    return `El equipo ya tiene ${max} ${r} (máximo para este servicio).`;
  }
  return null;
}

/** @param {string} service */
export function serviceUsesStructuredComposition(service) {
  return getTeamCompositionLimits(service) != null;
}
