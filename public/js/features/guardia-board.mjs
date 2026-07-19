/**
 * Modo Guardia — public barrel (DB mode census dashboard).
 */
import { isDbMode } from '../db-storage-bridge.mjs';
import { isGuardiaMode } from './chrome.mjs';
import { refreshGuardiaCensusFromDb } from '../clinical-access-runtime.mjs';
import { renderGuardiaBoard } from './guardia-board-render.mjs';

export { computeGuardiaSummary } from './guardia-board-chrome.mjs';
export { renderGuardiaBoard } from './guardia-board-render.mjs';

export function syncGuardiaBoardFromRuntime(settings) {
  if (!isDbMode() || !isGuardiaMode()) return;
  renderGuardiaBoard(settings);
}

export function isGuardiaBoardAvailable() {
  return isDbMode();
}

export function syncGuardiaModeButtonVisibility() {
  const show = isDbMode();
  const btn = document.querySelector('#header-mode-seg .header-mode-seg-btn[data-mode="guardia"]');
  if (btn) {
    if (show) btn.removeAttribute('hidden');
    else btn.setAttribute('hidden', '');
  }
}

if (typeof document !== 'undefined' && !document._rpcInternoVitalsSyncedWired) {
  document._rpcInternoVitalsSyncedWired = true;
  document.addEventListener('rpc-interno-vitals-synced', () => {
    if (!isGuardiaMode()) return;
    void refreshGuardiaCensusFromDb().then(() => renderGuardiaBoard(null));
  });
}
