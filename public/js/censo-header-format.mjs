/**
 * Encabezado del PDF de censo: ubicación (sala o torre) y equipo de guardia.
 */

export const CENSO_UBICACION_TORRE = 'torre';
export const CENSO_TORRE_HU_LABEL = 'Torre HU';
export const DEFAULT_CENSO_FIMI_LABEL = 'FIMI';

/** Etiqueta configurable para ingreso al servicio (antes «medicina interna» fijo). */
export function resolveCensoFimiLabel(settings) {
  return String(settings?.censoFimiLabel || '').trim() || DEFAULT_CENSO_FIMI_LABEL;
}

/** @param {Record<string, unknown>} settings */
function medTpl(settings) {
  var tpl = settings && settings.medicosPlantilla;
  return tpl && typeof tpl === 'object' ? /** @type {Record<string, string>} */ (tpl) : {};
}

/** @param {string} v */
function pick(v) {
  return String(v || '').trim();
}

/**
 * Normaliza valor guardado (incluye migración de censoTorre suelto).
 * @param {Record<string, unknown>} settings
 * @returns {string}
 */
export function normalizeCensoUbicacionValue(settings) {
  var st = settings || {};
  var sala = pick(st.censoSala);
  if (sala) {
    if (/^torre/i.test(sala) || sala === CENSO_UBICACION_TORRE) return CENSO_UBICACION_TORRE;
    return sala;
  }
  if (pick(st.censoTorre)) return CENSO_UBICACION_TORRE;
  return '';
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {string}
 */
export function formatCensoSalaTitleLine(settings) {
  var ubic = normalizeCensoUbicacionValue(settings);
  if (ubic === CENSO_UBICACION_TORRE) return 'Censo de ' + CENSO_TORRE_HU_LABEL;
  if (ubic) return 'Censo de Sala ' + ubic;
  return 'Censo de Sala';
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {{ r2: string, r1a: string, r1b: string, maestro: string }}
 */
export function resolveCensoEquipoMembers(settings) {
  var st = settings || {};
  var tpl = medTpl(st);
  var legacyR1 = pick(st.residenteR1);
  return {
    r2: pick(st.residenteR2) || pick(tpl.r2),
    r1a: pick(st.residenteR1a) || pick(tpl.r1a) || legacyR1,
    r1b: pick(st.residenteR1b) || pick(tpl.r1b),
    maestro: pick(st.profesorName) || pick(tpl.profesor),
  };
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {string}
 */
export function formatCensoEquipoLine(settings) {
  var m = resolveCensoEquipoMembers(settings);
  return [m.r2, m.r1a, m.r1b, m.maestro].filter(Boolean).join(' · ');
}

/**
 * @param {Record<string, unknown>} settings
 * @returns {{ titleLine: string, equipoLine: string, sala: string, torre: string, ubicacion: string }}
 */
export function buildCensoDocumentHeader(settings) {
  var ubic = normalizeCensoUbicacionValue(settings);
  var isTorre = ubic === CENSO_UBICACION_TORRE;
  return {
    titleLine: formatCensoSalaTitleLine(settings),
    equipoLine: formatCensoEquipoLine(settings),
    ubicacion: isTorre ? CENSO_TORRE_HU_LABEL : ubic,
    sala: isTorre ? '' : ubic,
    torre: isTorre ? CENSO_TORRE_HU_LABEL : '',
  };
}
