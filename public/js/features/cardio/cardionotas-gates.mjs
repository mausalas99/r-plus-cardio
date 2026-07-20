/** R+ Cardio MVP feature gates — strip LiveSync, Interconsulta, VPO, Receta HU. */

export function isCardionotasLanUiEnabled() {
  return false;
}

export function isCardionotasInterconsultaEnabled() {
  return false;
}

export function filterSalidaSectionsForCardionotas(sections) {
  return (sections || []).filter(
    (s) => s !== 'vpo' && s !== 'recetaHu' && s !== 'listado',
  );
}

/** Display name in chrome / dialogs / Electron productName. */
export function cardionotasProductName() {
  return 'R+ Cardio';
}
