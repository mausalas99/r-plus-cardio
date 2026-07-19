/** Cardionotas MVP feature gates — strip LiveSync, Interconsulta, VPO, Receta HU. */

export function isCardionotasLanUiEnabled() {
  return false;
}

export function isCardionotasInterconsultaEnabled() {
  return false;
}

export function filterSalidaSectionsForCardionotas(sections) {
  return (sections || []).filter((s) => s !== 'vpo' && s !== 'recetaHu');
}
