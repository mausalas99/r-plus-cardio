/** Fields already stored on the patient record (Datos del paciente tab). */
export const IDENTIFICACION_PATIENT_TAB_FIELDS = new Set([
  'registro',
  'dx',
  'diagnosticos',
  'nombre',
  'edad',
  'cama',
  'sexo',
]);

/** @type {RegExp[]} */
const FICHA_PATIENT_LINE_RES = [
  /^REGISTRO\s*[:;]/i,
  /^(?:DX|IDX|DIAGN[ÓO]STICOS?|DIAGNOSTICOS?)\s*[:;]/i,
  /^NOMBRE\s*[:;]/i,
  /^EDAD\s*[:;]/i,
  /^CAMA\s*[:;]/i,
  /^SEXO\s*[:;]/i,
];

/**
 * @param {string} text
 * @returns {string}
 */
export function filterFichaDriveText(text) {
  return String(text || '')
    .split('\n')
    .filter(function (line) {
      const t = line.trim();
      if (!t) return true;
      return !FICHA_PATIENT_LINE_RES.some(function (re) {
        return re.test(t);
      });
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} identificacion
 * @returns {Record<string, string>}
 */
export function filterIdentificacionForHcImport(identificacion) {
  /** @type {Record<string, string>} */
  const out = {};
  Object.entries(identificacion || {}).forEach(function (entry) {
    const key = entry[0];
    const value = entry[1];
    if (IDENTIFICACION_PATIENT_TAB_FIELDS.has(key)) return;
    if (value != null && String(value).trim()) out[key] = String(value).trim();
  });
  return out;
}
