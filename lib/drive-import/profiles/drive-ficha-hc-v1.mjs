import { parseFichaIdentificacion } from '../parse-header.mjs';
import { parseApnpLines, buildAppFromSections } from '../hc-field-parsers.mjs';
import { filterIdentificacionForHcImport } from '../filter-ficha-patient-fields.mjs';

export const id = 'drive-ficha-hc-v1';
export const label = 'Guardia — ficha + APNP/APPP';

/**
 * @param {Record<string, string>} sections
 * @param {unknown} header
 */
export function score(sections, header) {
  let s = 0;
  if (header) s += 20;
  if (sections.ficha) s += 45;
  if (sections.app) s += 25;
  if (sections.apnp) s += 15;
  if (sections.peea) s += 15;
  if (sections.historiaClinica && !sections.ficha) s -= 15;
  return s;
}

/**
 * @param {{ sections: Record<string, string> }} doc
 * @returns {Record<string, unknown>}
 */
export function mapHc(doc) {
  const sections = doc.sections || {};
  const ficha = parseFichaIdentificacion(sections.ficha || '');
  const apnp = parseApnpLines(sections.apnp || '');
  const app = buildAppFromSections(sections);
  const peeaParts = [sections.peea, sections.efUx, sections.pendientes].filter(Boolean);
  const padecimientoActual = peeaParts.join('\n\n').trim();

  return {
    identificacion: filterIdentificacionForHcImport(ficha.identificacion),
    motivoConsulta: (sections.motivoConsulta || '').trim(),
    signosVitalesIngreso: (sections.signosVitales || '').trim(),
    apnp,
    ahf: {
      conditions: [],
      customConditions: [],
      entries: [],
      descripcionDetallada: (sections.ahf || '').trim(),
    },
    app,
    padecimientoActual,
    _sexo: ficha.sexo,
  };
}
