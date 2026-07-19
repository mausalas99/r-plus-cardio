import * as ficha from './profiles/drive-ficha-hc-v1.mjs';
import * as pipe from './profiles/drive-pipe-hc-v1.mjs';
import { mergeHcPatch } from './merge-hc-patch.mjs';
import { filterIdentificacionForHcImport } from './filter-ficha-patient-fields.mjs';

const HC_SECTION_KEYS = [
  'ficha',
  'historiaClinica',
  'peea',
  'app',
  'apnp',
  'ahf',
  'motivoConsulta',
  'signosVitales',
  'interrogatorio',
  'dx',
  'medicamentos',
  'ecd',
  'fechaIngreso',
];

/**
 * @param {Record<string, string>} sections
 * @returns {boolean}
 */
export function hasDriveHcSections(sections) {
  return HC_SECTION_KEYS.some(function (k) {
    return sections[k] && String(sections[k]).trim();
  });
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function textLength(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return String(value).trim().length;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value).reduce(function (sum, v) {
      return sum + textLength(v);
    }, 0);
  }
  if (Array.isArray(value)) {
    return value.reduce(function (sum, v) {
      return sum + textLength(v);
    }, 0);
  }
  return 0;
}

/**
 * @param {Record<string, unknown>} patch
 * @returns {string[]}
 */
export function listHcPatchSectionKeys(patch) {
  return Object.keys(patch || {}).filter(function (k) {
    if (String(k).startsWith('_')) return false;
    return textLength(patch[k]) > 0;
  });
}

/**
 * Combina mapeo ficha + pipe según las secciones presentes (sin elegir un solo perfil).
 * @param {{ sections: Record<string, string>, headerLines?: string[] }} doc
 * @returns {Record<string, unknown>}
 */
function shouldUseFichaProfile(sections) {
  return !!(
    sections.ficha ||
    sections.app ||
    (sections.apnp && sections.app !== undefined) ||
    (sections.peea && sections.ficha)
  );
}

function shouldUsePipeProfile(sections) {
  return !!(
    sections.historiaClinica ||
    sections.peea ||
    sections.apnp ||
    sections.ahf ||
    sections.motivoConsulta ||
    sections.signosVitales ||
    sections.ecd
  );
}

export function mapUniversalHc(doc) {
  const sections = doc.sections || {};
  if (!hasDriveHcSections(sections)) return {};

  let patch = {};
  const useFicha = shouldUseFichaProfile(sections);
  const usePipe = shouldUsePipeProfile(sections);

  if (useFicha || sections.ficha) {
    patch = mergeHcPatch(patch, ficha.mapHc(doc), 'fill');
  }
  if (usePipe || !useFicha) {
    patch = mergeHcPatch(patch, pipe.mapHc(doc), 'fill');
  }

  if (!listHcPatchSectionKeys(patch).length) {
    patch = mergeHcPatch(ficha.mapHc(doc), pipe.mapHc(doc), 'fill');
  }

  if (patch.identificacion && typeof patch.identificacion === 'object') {
    patch.identificacion = filterIdentificacionForHcImport(
      /** @type {Record<string, unknown>} */ (patch.identificacion)
    );
  }

  return patch;
}
