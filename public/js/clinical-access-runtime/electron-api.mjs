/** @returns {import('../clinical-session-context.mjs').ElectronDbApi|null} */
export function electronApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}
