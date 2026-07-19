/** Sync mobile-web flag for boot hubs — no LAN persist / clinical deps. */

function mobileRuntimeGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  return null;
}

export function isMobileWeb() {
  var g = mobileRuntimeGlobal();
  if (!g) return false;
  return !!(
    g.__RPC_MOBILE_WEB__ ||
    (typeof document !== 'undefined' &&
      document.documentElement &&
      document.documentElement.classList.contains('rpc-mobile-web'))
  );
}
