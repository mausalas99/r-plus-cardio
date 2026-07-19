import { storage } from './storage.js';

const DEBOUNCE_MS = 60_000;
/** @type {Map<string, number>} */
const recentToasts = new Map();

function toastKey(entityType, entityId) {
  return `${entityType}:${entityId || '*'}`;
}

export function resetLwwToastDebounceForTests() {
  recentToasts.clear();
}

/** @returns {boolean} true if a toast may be shown (records debounce window). */
export function shouldShowLwwToast(entityType, entityId) {
  const key = toastKey(entityType, entityId);
  const now = Date.now();
  const last = recentToasts.get(key);
  if (last != null && now - last < DEBOUNCE_MS) {
    return false;
  }
  recentToasts.set(key, now);
  return true;
}

function lwwToastMessage(entityType) {
  const type = String(entityType || '').toLowerCase();
  if (type === 'patient') {
    return 'Paciente sincronizado; otro cambio en la sala pudo reemplazar cuarto/cama.';
  }
  if (type === 'todo') {
    return 'Pendiente sincronizado; se aplicó la versión más reciente.';
  }
  if (type === 'bundle' || type === 'sync-bundle') {
    return 'Sala actualizada; algunos datos se fusionaron por fecha.';
  }
  return 'Sala actualizada; algunos datos se fusionaron por fecha.';
}

/**
 * @param {{ showToast?: (msg: string, type: string) => void }} runtime
 * @param {{ entityType?: string, entityId?: string, overwrittenKeys?: string[] }} opts
 */
export function notifyLwwOverwrite(runtime, { entityType, entityId, overwrittenKeys } = {}) {
  if (!runtime || typeof runtime.showToast !== 'function') return;
  if (!storage.getLanLwwOverwriteToast()) return;
  const type = String(entityType || '').toLowerCase();
  const keys = Array.isArray(overwrittenKeys) ? overwrittenKeys : [];
  const isBundle = type === 'bundle' || type === 'sync-bundle';
  if (keys.length === 0 && !isBundle) return;
  if (!shouldShowLwwToast(entityType, entityId)) return;
  runtime.showToast(lwwToastMessage(entityType), 'info');
}
