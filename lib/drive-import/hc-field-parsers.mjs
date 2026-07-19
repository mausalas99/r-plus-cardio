import {
  isNegatedDriveText,
  parseAppSubsections,
} from './hc-structured-extract.mjs';

const KV_RE = /^([A-ZÁÉÍÓÚÑ0-9\s]+)\s*[:;]\s*(.+)$/i;

/**
 * @param {string} block
 * @returns {Record<string, string>}
 */
export function parseKeyValueBlock(block) {
  /** @type {Record<string, string>} */
  const out = {};
  const keyMap = {
    ORIGEN: 'lugarNacimiento',
    RESIDENCIA: 'residencia',
    'ESTADO CIVIL': 'estadoCivil',
    RELIGIÓN: 'religion',
    RELIGION: 'religion',
    ESCOLARIDAD: 'escolaridad',
    OCUPACIÓN: 'ocupacionActual',
    OCUPACION: 'ocupacionActual',
  };
  for (const raw of String(block || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = KV_RE.exec(line);
    if (!m) continue;
    const label = m[1].trim().toUpperCase();
    const value = m[2].trim();
    const field = keyMap[label] || label.toLowerCase().replace(/\s+/g, '_');
    out[field] = value;
  }
  return out;
}

/**
 * @param {string} block
 * @returns {Record<string, string>}
 */
export function parseApnpLines(block) {
  /** @type {Record<string, string>} */
  const apnp = {};
  const map = {
    TABAQUISMO: 'tabaquismo',
    ETILISMO: 'alcoholismo',
    TOXICOMANÍAS: 'toxicomanias',
    TOXICOMANIAS: 'toxicomanias',
    'TATUAJES/PERFORACIONES': 'tatuajes',
    TATUAJES: 'tatuajes',
    ZOONOSIS: 'deportesPasatiemposMascotas',
    COMBE: 'dieta',
    BIOMASA: 'dieta',
    'VIAJES RECIENTES': 'dieta',
    HERBOLARIA: 'dieta',
  };
  for (const raw of String(block || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = KV_RE.exec(line);
    if (!m) continue;
    const label = m[1].trim().toUpperCase();
    const field = map[label];
    if (field) apnp[field] = m[2].trim();
  }
  return apnp;
}

/**
 * @param {Record<string, string>} sections
 * @returns {Record<string, unknown>}
 */
export function buildAppFromSections(sections) {
  const parts = [
    sections.ecd,
    sections.medicamentos,
    sections.quirurgicos,
    sections.internamientos,
    sections.app,
  ].filter(Boolean);
  const descripcionDetallada = parts.join('\n\n').trim();
  const subs = parseAppSubsections(descripcionDetallada);
  const alergiasText = subs.alergias || '';
  const inmunText = subs.inmunizaciones || '';

  return {
    conditions: [],
    customConditions: [],
    conditionDetails: {},
    cirugias: [],
    hospitalizaciones: [],
    alergiasNegado: alergiasText ? isNegatedDriveText(alergiasText) : false,
    alergiaMedicamentos: [],
    traumaticosEntries: [],
    transfusionesEntries: [],
    descripcionDetallada,
    medicamentosActuales: [],
    inmunizaciones: inmunText && !isNegatedDriveText(inmunText) ? inmunText : '',
  };
}
