/**
 * Top-level Manejo app tab host for Cardionotas IC panel.
 */
import { isCardionotasManejoAppTab } from './cardionotas-gates.mjs';
import { renderManejoPanel } from './manejo-panel.mjs';

export function getCardioManejoAppMount() {
  return document.getElementById('med-pane-cardio-manejo');
}

/** Render Fantásticos / diuréticos into the main Manejo tab (when gated). */
export function renderCardioManejoAppTab() {
  if (!isCardionotasManejoAppTab()) return false;
  var mount = getCardioManejoAppMount();
  if (!mount) return false;
  renderManejoPanel(mount);
  return true;
}
