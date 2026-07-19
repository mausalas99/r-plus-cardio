/**
 * Orden y etiquetas de secciones Drive para revisión/importación HC.
 * @typedef {{ sectionKey: string, label: string }} DriveHcReviewSpec
 */

/** @type {DriveHcReviewSpec[]} */
export const DRIVE_HC_REVIEW_ORDER = [
  { sectionKey: 'pendientes', label: 'Pendientes' },
  { sectionKey: 'historiaClinica', label: 'Historia clínica' },
  { sectionKey: 'motivoConsulta', label: 'Motivo de consulta' },
  { sectionKey: 'signosVitales', label: 'Signos vitales de ingreso' },
  { sectionKey: 'ficha', label: 'Ficha de identificación' },
  { sectionKey: 'ahf', label: 'Antecedentes heredofamiliares' },
  { sectionKey: 'apnp', label: 'Antecedentes personales no patológicos' },
  { sectionKey: 'app', label: 'Antecedentes personales patológicos' },
  { sectionKey: 'peea', label: 'Padecimiento actual / PEEA' },
];

/**
 * @param {Record<string, string>} sections
 * @returns {Array<{ sectionKey: string, label: string, text: string }>}
 */
export function listDriveHcReviewSections(sections) {
  const src = sections || {};
  /** @type {Array<{ sectionKey: string, label: string, text: string }>} */
  const out = [];
  for (const spec of DRIVE_HC_REVIEW_ORDER) {
    const text = String(src[spec.sectionKey] || '').trim();
    if (!text) continue;
    out.push({ sectionKey: spec.sectionKey, label: spec.label, text: text });
  }
  return out;
}
