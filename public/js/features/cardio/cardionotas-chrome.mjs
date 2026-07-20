/**
 * Hide R+ LAN / guardia / sala-mode chrome that does not apply to R+ Cardio.
 */
import {
  cardionotasSalidaTabLabel,
  isCardionotasLanUiEnabled,
} from './cardionotas-gates.mjs';

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
  '#itab-manejo',
  '#itab-content-manejo',
  '#med-subview-tabs-bar',
  '#med-work-area',
  '.med-empty-lead-legacy',
  /* Pendientes / Paciente tab content */
  '#itab-paciente',
  '#itab-content-paciente',
  '.exp-pendientes-mount',
  /* Drive import */
  '#exp-clinico-drive-actions',
  '#btn-drive-import',
  /* Entrega de pendientes / handoff */
  '#btn-guardia-entrega-phase',
  '#guardia-entrega-phase-status',
  '#guardia-orphan-entregas-strip',
  '#entrega-modal-backdrop',
  /* Salida segment bar — only Hoja IC pane remains */
  '#exp-segment-salida',
];

/** @param {HTMLElement | null} el @param {string} label */
function setInnerTabTextLabel(el, label) {
  if (!el) return;
  el.setAttribute('aria-label', label);
  var replaced = false;
  el.childNodes.forEach(function (node) {
    if (node.nodeType === 3 && String(node.textContent || '').trim()) {
      node.textContent = ' ' + label + ' ';
      replaced = true;
    }
  });
  if (!replaced) {
    el.appendChild(document.createTextNode(' ' + label));
  }
}

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
  var cardioMount = document.getElementById('med-pane-cardio-manejo');
  if (cardioMount) {
    cardioMount.hidden = false;
    cardioMount.style.display = '';
  }
  var cardioEmpty = document.querySelector('.med-empty-lead-cardio');
  if (cardioEmpty) {
    cardioEmpty.hidden = false;
    if (cardioEmpty instanceof HTMLElement) cardioEmpty.style.display = '';
  }
  setInnerTabTextLabel(
    document.getElementById('itab-salida'),
    cardionotasSalidaTabLabel(),
  );
  var salidaBar = document.getElementById('exp-segment-salida');
  if (salidaBar) {
    salidaBar.hidden = true;
    salidaBar.style.display = 'none';
  }
  // Datos stays available without the Paciente/Pendientes tab.
  var datosActions = document.getElementById('exp-paciente-datos-actions');
  if (datosActions) {
    datosActions.hidden = false;
    datosActions.style.display = '';
  }
}
