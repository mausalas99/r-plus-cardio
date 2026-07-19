import { syncTabBarIndicator } from '../ui-tab-motion.mjs';
import { mp, getMedSubview } from './med-pharm-profile-state.mjs';

function syncSubviewVisibility() {
  var receta = document.getElementById('med-subview-receta');
  var perfil = document.getElementById('med-subview-perfil');
  if (receta) receta.style.display = mp.medSubview === 'receta' ? '' : 'none';
  if (perfil) perfil.style.display = mp.medSubview === 'perfil' ? '' : 'none';
  var recetaTab = document.getElementById('med-itab-receta');
  var perfilTab = document.getElementById('med-itab-perfil');
  if (recetaTab) {
    var onReceta = mp.medSubview === 'receta';
    recetaTab.classList.toggle('active', onReceta);
    recetaTab.setAttribute('aria-selected', onReceta ? 'true' : 'false');
  }
  if (perfilTab) {
    var onPerfil = mp.medSubview === 'perfil';
    perfilTab.classList.toggle('active', onPerfil);
    perfilTab.setAttribute('aria-selected', onPerfil ? 'true' : 'false');
  }
  var bar = document.getElementById('med-subview-tabs-bar');
  var activeTab = mp.medSubview === 'perfil' ? perfilTab : recetaTab;
  syncTabBarIndicator(bar, activeTab);
}

export function setMedSubview(mode) {
  if (mode !== 'receta' && mode !== 'perfil') return;
  mp.medSubview = mode;
  syncSubviewVisibility();
  mp.rt.refreshMedPanel();
}

export function initMedPharmSubviewUiShell(wireUiOnce) {
  wireUiOnce();
  syncSubviewVisibility();
}

export { syncSubviewVisibility, getMedSubview };
