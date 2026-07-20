/** R+ Cardio MVP feature gates — strip LiveSync, Interconsulta, VPO, Receta HU. */

export function isCardionotasLanUiEnabled() {
  return false;
}

export function isCardionotasInterconsultaEnabled() {
  return false;
}

/**
 * IC Manejo (Fantásticos / diuréticos) lives in the top-level Manejo app tab,
 * not as an Expediente sub-tab.
 */
export function isCardionotasManejoAppTab() {
  return true;
}

/** Hide Paciente → Pendientes (entrega de pendientes) from Expediente. */
export function isCardionotasPendientesHidden() {
  return true;
}

/** Hide Google Drive HC import chrome. */
export function isCardionotasDriveImportHidden() {
  return true;
}

/** Hide clinical entrega / handoff chrome. */
export function isCardionotasEntregaHidden() {
  return true;
}

export function filterSalidaSectionsForCardionotas(sections) {
  return (sections || []).filter(
    (s) => s !== 'vpo' && s !== 'recetaHu' && s !== 'listado',
  );
}

/** @param {string[]} tabs */
export function filterExpedienteTabsForCardionotas(tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  let out = list.slice();
  if (isCardionotasManejoAppTab()) {
    out = out.filter((t) => t !== 'manejo');
  }
  if (isCardionotasPendientesHidden()) {
    out = out.filter((t) => t !== 'paciente');
  }
  return out;
}

/** Expediente group label for the salida composite (Hoja IC only in Cardio). */
export function cardionotasSalidaTabLabel() {
  return 'Hoja IC';
}

/** Display name in chrome / dialogs / Electron productName. */
export function cardionotasProductName() {
  return 'R+ Cardio';
}
