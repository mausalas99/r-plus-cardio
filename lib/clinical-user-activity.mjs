/** Shared LAN directory activity helpers (Node + renderer). */

export const CLINICAL_USER_ACTIVITY_ACTIVE_MS = 24 * 60 * 60 * 1000;
export const CLINICAL_USER_ACTIVITY_RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {string|null}
 */
export function mergeLastActivityIso(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left) return right || null;
  if (!right) return left;
  return left >= right ? left : right;
}

/**
 * @param {string|null|undefined} iso
 * @param {number} [nowMs]
 * @returns {'active'|'recent'|'stale'|'unknown'}
 */
export function clinicalUserActivityTier(iso, nowMs = Date.now()) {
  const raw = String(iso || '').trim();
  if (!raw) return 'unknown';
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return 'unknown';
  const age = nowMs - ts;
  if (age < 0) return 'active';
  if (age <= CLINICAL_USER_ACTIVITY_ACTIVE_MS) return 'active';
  if (age <= CLINICAL_USER_ACTIVITY_RECENT_MS) return 'recent';
  return 'stale';
}

/**
 * @param {string|null|undefined} iso
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatClinicalUserLastActivity(iso, nowMs = Date.now()) {
  const tier = clinicalUserActivityTier(iso, nowMs);
  if (tier === 'unknown') return 'Sin actividad registrada';
  const ts = new Date(String(iso)).getTime();
  const diffMin = Math.floor((nowMs - ts) / 60000);
  if (diffMin < 1) return 'Activo ahora';
  if (diffMin < 60) return `Activo hace ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) {
    const mins = diffMin % 60;
    return mins ? `Activo hace ${hours} h ${mins} min` : `Activo hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Activo ayer';
  if (days < 7) return `Activo hace ${days} d`;
  return `Inactivo · ${days} d sin actividad`;
}

/** @param {'active'|'recent'|'stale'|'unknown'} tier */
export function clinicalUserActivityLabel(tier) {
  if (tier === 'active') return 'Activo';
  if (tier === 'recent') return 'Reciente';
  if (tier === 'stale') return 'Inactivo';
  return 'Sin registro';
}
