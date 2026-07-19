import {
  invalidateParsed,
  readClinicalBlob,
  skipClinicalLocalPersist,
  safeParse,
  safeParseObject,
} from './storage-core.mjs';

export const prefsStorageMethods = {
  getSettings() {
    return safeParseObject(localStorage.getItem('rpc-settings'));
  },

  /**
   * Save application settings to localStorage
   * @param {Object} settings - Settings object
   */
  saveSettings(settings) {
    localStorage.setItem('rpc-settings', JSON.stringify(settings));
  },

  /**
   * Get current theme preference from localStorage
   * @returns {string} Theme name ('light' or 'dark')
   */
  getTheme() {
    return localStorage.getItem('theme') || 'light';
  },

  /**
   * Save theme preference to localStorage
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  saveTheme(theme) {
    localStorage.setItem('theme', theme);
  },

  /**
   * Get guided tour completion version from localStorage
   * @returns {string|null} Guided tour version or null if not completed
   */
  getGuidedTourVersion() {
    return localStorage.getItem('rpc-guidedTourDone');
  },

  /**
   * Save guided tour completion version to localStorage
   * @param {string} version - Guided tour version
   */
  saveGuidedTourVersion(version) {
    localStorage.setItem('rpc-guidedTourDone', version);
  },

  /**
   * Remove guided tour completion flag from localStorage
   */
  removeGuidedTourVersion() {
    localStorage.removeItem('rpc-guidedTourDone');
  },

  getLanConfig() {
    return safeParse(localStorage.getItem('rpc-lan-config'), null) || null;
  },

  saveLanConfig(cfg) {
    if (!cfg) {
      localStorage.removeItem('rpc-lan-config');
      return;
    }
    localStorage.setItem('rpc-lan-config', JSON.stringify(cfg));
  },

  /** Last ward shift PIN (6 digits) — used to re-find host after Wi‑Fi change. */
  getLanShiftPin() {
    try {
      const pin = String(localStorage.getItem('rpc-lan-shift-pin') || '').trim();
      return /^\d{6}$/.test(pin) ? pin : '';
    } catch {
      return '';
    }
  },

  saveLanShiftPin(pin) {
    const code = String(pin || '').trim();
    try {
      if (!/^\d{6}$/.test(code)) {
        localStorage.removeItem('rpc-lan-shift-pin');
        return;
      }
      localStorage.setItem('rpc-lan-shift-pin', code);
    } catch (_e) { void _e; }
  },

  getHostPatientMap() {
    return readClinicalBlob('lanHostPatientMap', 'rpc-lan-host-patient-map', safeParseObject);
  },

  saveHostPatientMap(map) {
    if (skipClinicalLocalPersist()) return;
    localStorage.setItem('rpc-lan-host-patient-map', JSON.stringify(map || {}));
    invalidateParsed('lanHostPatientMap');
  },

  /** 'host' = esta R+ abre el servidor; 'client' = solo se une. */
  getLanUiRole() {
    var v = localStorage.getItem('rpc-lan-ui-role');
    if (v === 'host' || v === 'client') return v;
    return 'client';
  },

  saveLanUiRole(role) {
    if (role === 'host' || role === 'client') {
      localStorage.setItem('rpc-lan-ui-role', role);
    }
  },

  /** Ocultar la franja «Sin conexión al host LAN» cuando se pierde el enlace. */
  getLanHideDisconnectBanner() {
    try {
      return localStorage.getItem('rpc-lan-hide-disconnect-banner') === '1';
    } catch {
      return false;
    }
  },

  saveLanHideDisconnectBanner(hide) {
    try {
      localStorage.setItem('rpc-lan-hide-disconnect-banner', hide ? '1' : '0');
    } catch (_e) { void _e; }
  },

  /** Aviso no bloqueante cuando LWW sobrescribe un cambio concurrente en la sala. */
  getLanLwwOverwriteToast() {
    try {
      var v = localStorage.getItem('rpc-lan-lww-overwrite-toast');
      if (v === '0') return false;
      return true;
    } catch {
      return true;
    }
  },

  setLanLwwOverwriteToast(enabled) {
    try {
      localStorage.setItem('rpc-lan-lww-overwrite-toast', enabled ? '1' : '0');
    } catch (_e) { void _e; }
  },
};
