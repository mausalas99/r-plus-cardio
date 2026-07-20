import { isGuardiaMode } from './chrome.mjs';
import { isCardionotasLanUiEnabled } from './cardio/cardionotas-gates.mjs';

/** @returns {HTMLElement | null} */
export function clinicalContextBarEl() {
  return document.getElementById('clinical-context-bar');
}

/** Show the top clinical bar when Mi rotación or census filters are visible. */
export function syncClinicalContextBarVisibility() {
  const bar = clinicalContextBarEl();
  if (!bar) return;
  if (!isCardionotasLanUiEnabled()) {
    bar.hidden = true;
    return;
  }
  const rotation = document.getElementById('clinical-rotation-section');
  const filtersMount = document.getElementById('clinical-census-filters-mount');
  const hasRotation = rotation && !rotation.hidden && !isGuardiaMode();
  const hasFilters =
    filtersMount &&
    !filtersMount.hidden &&
    !!document.getElementById('clinical-census-filters');
  bar.hidden = !(hasRotation || hasFilters);
}
