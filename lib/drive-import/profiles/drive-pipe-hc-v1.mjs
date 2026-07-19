import { parseKeyValueBlock, parseApnpLines, buildAppFromSections } from '../hc-field-parsers.mjs';
import { filterIdentificacionForHcImport } from '../filter-ficha-patient-fields.mjs';

export const id = 'drive-pipe-hc-v1';
export const label = 'Guardia — encabezado | y HC clásica';

/**
 * @param {Record<string, string>} sections
 * @param {unknown} header
 */
export function score(sections, header) {
  let s = 0;
  if (header) s += 30;
  if (sections.historiaClinica) s += 25;
  if (sections.peea) s += 20;
  if (sections.motivoConsulta) s += 10;
  if (sections.ficha) s -= 50;
  if (sections.app) s -= 20;
  return s;
}

/**
 * @param {{ sections: Record<string, string> }} doc
 * @returns {Record<string, unknown>}
 */
export function mapHc(doc) {
  const sections = doc.sections || {};
  const identificacion = filterIdentificacionForHcImport(parseKeyValueBlock(sections.historiaClinica || ''));
  const apnp = parseApnpLines(sections.apnp || '');
  const ahfText = (sections.ahf || '').trim();
  const app = buildAppFromSections(sections);
  if (sections.ecd && !app.descripcionDetallada.includes(sections.ecd)) {
    app.descripcionDetallada = [sections.ecd, app.descripcionDetallada].filter(Boolean).join('\n\n');
  }

  return {
    identificacion,
    motivoConsulta: (sections.motivoConsulta || '').trim(),
    signosVitalesIngreso: (sections.signosVitales || '').trim(),
    apnp,
    ahf: {
      conditions: [],
      customConditions: [],
      entries: [],
      descripcionDetallada: ahfText,
    },
    app,
    padecimientoActual: (sections.peea || '').trim(),
  };
}
