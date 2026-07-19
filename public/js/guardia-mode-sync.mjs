/**
 * Keeps censo filter state in sync with the guardia board toggle.
 */
import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import { rerenderGuardiaBoardIfRequested, syncGuardiaModeDom } from './guardia-mode-sync-ui.mjs';

/**
 * @param {boolean} active
 * @param {{ rerenderBoard?: boolean, settings?: Record<string, unknown>|null, renderGuardiaBoard?: (settings: Record<string, unknown>|null|undefined) => void }} [opts]
 */
export function setGuardiaMode(active, opts = {}) {
  clinicalSessionContext.guardiaMode = !!active;
  syncGuardiaModeUI(opts);
}

/**
 * @param {{ rerenderBoard?: boolean, settings?: Record<string, unknown>|null, renderGuardiaBoard?: (settings: Record<string, unknown>|null|undefined) => void }} [opts]
 */
export function syncGuardiaModeUI(opts = {}) {
  const active = !!clinicalSessionContext.guardiaMode;
  syncGuardiaModeDom(active);
  rerenderGuardiaBoardIfRequested(opts);
}

export function toggleGuardiaMode(opts = {}) {
  setGuardiaMode(!clinicalSessionContext.guardiaMode, { ...opts, rerenderBoard: true });
}
