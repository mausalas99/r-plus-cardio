/**
 * Serialize / deserialize HC patch sections for manual review before import.
 */

import { filterIdentificacionForHcImport } from './filter-ficha-patient-fields.mjs';

/** @type {Record<string, string>} */
export const HC_SECTION_LABELS = {
  identificacion: 'Identificación',
  motivoConsulta: 'Motivo de consulta',
  signosVitalesIngreso: 'Signos vitales de ingreso',
  apnp: 'Antecedentes no patológicos',
  ahf: 'Antecedentes heredofamiliares',
  app: 'Antecedentes patológicos',
  padecimientoActual: 'Padecimiento actual / PEEA',
};

const IDENT_LABELS = {
  lugarNacimiento: 'ORIGEN',
  residencia: 'RESIDENCIA',
  estadoCivil: 'ESTADO CIVIL',
  religion: 'RELIGIÓN',
  escolaridad: 'ESCOLARIDAD',
  ocupacionActual: 'OCUPACIÓN',
  informante: 'INFORMANTE',
  registro: 'REGISTRO',
  cama: 'CAMA',
  dx: 'DX',
  edad: 'EDAD',
};

const APNP_LABELS = {
  tabaquismo: 'TABAQUISMO',
  alcoholismo: 'ETILISMO',
  toxicomanias: 'TOXICOMANÍAS',
  tatuajes: 'TATUAJES',
  deportesPasatiemposMascotas: 'ZOONOSIS',
  dieta: 'DIETA / COMBE',
};

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {string}
 */
function labeledObjectToEditText(value, labels) {
  return Object.entries(value)
    .filter(function (entry) {
      return entry[1] != null && String(entry[1]).trim();
    })
    .map(function (entry) {
      const label = labels[entry[0]] || entry[0].toUpperCase();
      return label + ': ' + String(entry[1]).trim();
    })
    .join('\n');
}

function descripcionDetalladaText(value) {
  return String(/** @type {{ descripcionDetallada?: string }} */ (value).descripcionDetallada || '').trim();
}

const TEXT_HC_KEYS = new Set(['motivoConsulta', 'padecimientoActual', 'signosVitalesIngreso']);

export function hcPatchValueToEditText(key, value) {
  if (value == null) return '';
  if (TEXT_HC_KEYS.has(key)) return String(value).trim();
  if (key === 'identificacion' && typeof value === 'object' && !Array.isArray(value)) {
    return labeledObjectToEditText(
      filterIdentificacionForHcImport(/** @type {Record<string, string>} */ (value)),
      IDENT_LABELS
    );
  }
  if ((key === 'ahf' || key === 'app') && typeof value === 'object' && value) {
    return descripcionDetalladaText(value);
  }
  if (key === 'apnp' && typeof value === 'object' && value) {
    return labeledObjectToEditText(/** @type {Record<string, string>} */ (value), APNP_LABELS);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * @param {string} block
 * @returns {Record<string, string>}
 */
function parseLabeledLines(block, labelToField) {
  /** @type {Record<string, string>} */
  const out = {};
  const reverse = {};
  Object.keys(labelToField).forEach(function (field) {
    reverse[String(labelToField[field]).toUpperCase()] = field;
  });
  for (const raw of String(block || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const label = line.slice(0, idx).trim().toUpperCase();
    const value = line.slice(idx + 1).trim();
    const field = reverse[label] || label.toLowerCase().replace(/\s+/g, '_');
    out[field] = value;
  }
  return out;
}

/**
 * @param {string} key
 * @param {string} text
 * @param {unknown} original
 * @returns {unknown}
 */
function cloneObjectOr(original, defaultValue) {
  return original && typeof original === 'object' && !Array.isArray(original)
    ? Object.assign({}, /** @type {Record<string, unknown>} */ (original))
    : defaultValue;
}

function editDescripcionDetalladaSection(trimmed, original) {
  const base = cloneObjectOr(original, { conditions: [], customConditions: [], entries: [] });
  base.descripcionDetallada = trimmed;
  return base;
}

export function editTextToHcPatchValue(key, text, original) {
  const trimmed = String(text || '').trim();
  if (key === 'motivoConsulta' || key === 'padecimientoActual' || key === 'signosVitalesIngreso') {
    return trimmed;
  }
  if (key === 'identificacion') {
    const base = cloneObjectOr(original, {});
    return filterIdentificacionForHcImport(
      Object.assign(base, parseLabeledLines(trimmed, IDENT_LABELS))
    );
  }
  if (key === 'ahf' || key === 'app') {
    return editDescripcionDetalladaSection(trimmed, original);
  }
  if (key === 'apnp') {
    const base = cloneObjectOr(original, {});
    return Object.assign(base, parseLabeledLines(trimmed, APNP_LABELS));
  }
  if (!trimmed) return original;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
