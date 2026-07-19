/**
 * Acceso a la guía clínica (Manejo): desbloqueo explícito.
 */

export const CLINICO_UNLOCK_PHRASE = 'entiendo, usare mi criterio clincio';

/** @param {unknown} text */
export function normalizeClinicoUnlockPhrase(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** @param {unknown} text */
export function matchesClinicoUnlockPhrase(text) {
  return (
    normalizeClinicoUnlockPhrase(text) ===
    normalizeClinicoUnlockPhrase(CLINICO_UNLOCK_PHRASE)
  );
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function isClinicoUnlocked(settings) {
  if (!settings || typeof settings !== 'object') return false;
  if (settings.clinicoUnlocked) return true;
  if (settings.hideManejoSection === false && !settings.hideClinicoTab) return true;
  return false;
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function isClinicoAccessHidden(settings) {
  if (!isClinicoUnlocked(settings)) return true;
  if (!settings) return true;
  return !!(settings.hideManejoSection || settings.hideClinicoTab);
}

/** @type {null|(() => void)} */
var _unlockSuccessCb = null;

export function openClinicoUnlockModal(onSuccess) {
  if (typeof onSuccess === 'function') onSuccess();
}

export function closeClinicoUnlockModal() {
  var backdrop = document.getElementById('clinico-unlock-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  _unlockSuccessCb = null;
}

export function confirmClinicoUnlock() {
  var cb = _unlockSuccessCb;
  closeClinicoUnlockModal();
  if (cb) cb();
}

export const clinicoAccessWindowHandlers = {
  openClinicoUnlockModal,
  closeClinicoUnlockModal,
  confirmClinicoUnlock,
};
