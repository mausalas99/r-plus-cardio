/**
 * Hide R+ LAN / guardia / sala-mode chrome that does not apply to R+ Cardio.
 */
import { isCardionotasLanUiEnabled } from './cardionotas-gates.mjs';

const HIDE_SELECTORS = [
  '#header-mode-seg',
  '#profile-clinical-bridge',
  '.profile-block--mode',
  '#profile-salida-section',
  '#m-sala-group',
  '#m-team-group',
  '#clinical-rotation-section',
  '#btn-sidebar-mi-rotacion',
  '.app-bar-mi-rotacion',
  '#clinical-context-bar',
  '#btn-export-censo-header',
  '#lan-connection-banner',
  '#btn-header-team-sync',
  '#exp-segment-listado',
  '#itab-content-listado',
  '#ronda-quick-listado',
  '#btn-gen-listado',
  '.profile-block--formats',
  '#templates-modal',
];

export function applyCardionotasStreamlineChrome() {
  if (typeof document === 'undefined') return;
  if (isCardionotasLanUiEnabled()) {
    document.documentElement.classList.remove('rpc-cardio-streamline');
    return;
  }
  document.documentElement.classList.add('rpc-cardio-streamline');
  HIDE_SELECTORS.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.hidden = true;
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
  });
}
