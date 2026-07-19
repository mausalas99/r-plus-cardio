export const ENTREGA_PHASE_LS_KEY = 'guardia.entregaPhase';

/** @param {Storage|undefined} storage */
export function readEntregaPhaseActive(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ENTREGA_PHASE_LS_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw);
    return !!(o && o.active);
  } catch {
    return false;
  }
}
