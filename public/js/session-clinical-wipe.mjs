/**
 * Session-scoped PHI wipe for iPad/web surfaces (audit M2).
 * Desktop Electron persists in SQLCipher; mobile/interno web must not leave clinical blobs at rest.
 */
import { CLINICAL_LS_KEYS } from './db-storage-bridge.mjs';

/** LAN/session keys that may hold ward credentials on web clients. */
export const SESSION_WEB_LS_KEYS = [
  'rplus.lan.bearer',
  'rpc-lan-config',
  'rpc-lan-shift-pin',
  'rpc-lan-ui-role',
  'rpc-lan-hide-disconnect-banner',
  'rpc-lan-room-snapshots',
  'rpc-lan-host-patient-map',
];

/**
 * @param {{ includeLanSession?: boolean }} [opts]
 */
export function wipeSessionClinicalStorage(opts) {
  if (typeof localStorage === 'undefined') return 0;
  var includeLan = !opts || opts.includeLanSession !== false;
  var removed = 0;
  for (var i = 0; i < CLINICAL_LS_KEYS.length; i += 1) {
    var key = CLINICAL_LS_KEYS[i];
    if (localStorage.getItem(key) == null) continue;
    try {
      localStorage.removeItem(key);
      removed += 1;
    } catch (_e) { void _e; }
  }
  if (includeLan) {
    for (var j = 0; j < SESSION_WEB_LS_KEYS.length; j += 1) {
      var lanKey = SESSION_WEB_LS_KEYS[j];
      if (localStorage.getItem(lanKey) == null) continue;
      try {
        localStorage.removeItem(lanKey);
        removed += 1;
      } catch (_e) { void _e; }
    }
  }
  return removed;
}

export function shouldInstallSessionClinicalWipe() {
  return isSessionScopedWebClient();
}

function hasSessionScopedWebRuntimeFlag() {
  const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
  if (!g) return false;
  if (g.__RPC_MOBILE_WEB__ || g.__RPC_WEB_CLINICAL__) return true;
  if (
    typeof document !== 'undefined' &&
    document.documentElement &&
    document.documentElement.classList.contains('rpc-mobile-web')
  ) {
    return true;
  }
  return false;
}

/** iPad/PWA: clinical PHI stays in memory for the session; no SQLCipher on web. */
export function isSessionScopedWebClient() {
  if (typeof window === 'undefined') return false;
  if (window.electronAPI && typeof window.electronAPI.dbClinicalLoadAll === 'function') {
    return false;
  }
  return hasSessionScopedWebRuntimeFlag();
}

/** Wipe clinical localStorage when the browser session ends (mobile web / PWA). */
export function installSessionClinicalWipeOnExit() {
  if (!shouldInstallSessionClinicalWipe()) return;
  var wipe = function () {
    wipeSessionClinicalStorage();
  };
  window.addEventListener('pagehide', wipe);
  window.addEventListener('beforeunload', wipe);
}
