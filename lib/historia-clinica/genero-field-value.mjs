import { HC_INTERROGADO_NEGADO } from './defaults.mjs';
import {
  normalizeMedicamentosList,
} from './medicamento-entry.mjs';
import { generoFieldHasContent } from './genero-field-shared.mjs';
import { trim } from './string-util.mjs';

const NEGADO_FIELD = HC_INTERROGADO_NEGADO.toLowerCase();

function defaultFieldValue() {
  return {};
}

function parseGpacString(s) {
  const m = String(s).match(/G\s*(\d+).*?P\s*(\d+).*?A\s*(\d+).*?C\s*(\d+)/i);
  if (!m) return null;
  return { g: m[1], p: m[2], a: m[3], c: m[4] };
}


/**
 * @param {{ kind: string }} spec
 * @param {string} s
 */
function normalizeFieldValueFromString(spec, s) {
  switch (spec.kind) {
    case 'age':
      return { edad: s.replace(/\s*años?\s*/gi, '').trim() };
    case 'gpac': {
      const parsed = parseGpacString(s);
      if (parsed) return parsed;
      return { detalle: s };
    }
    case 'fum':
      return { fum: s };
    case 'medications':
    case 'medication':
      return { medicamentos: normalizeMedicamentosList(s) };
    default:
      return { detalle: s };
  }
}

/**
 * @param {{ kind: string }} spec
 * @param {object} raw
 */
function normalizeFieldValueFromObject(spec, raw) {
  /** @type {Record<string, string>} */
  const out = {};
  if (spec.kind === 'age') {
    if (trim(raw.edad) !== '') out.edad = trim(raw.edad);
  } else if (spec.kind === 'fum') {
    if (trim(raw.fum) !== '') out.fum = trim(raw.fum);
    if (trim(raw.ciclo) !== '') out.ciclo = trim(raw.ciclo);
  } else if (spec.kind === 'gpac') {
    ['g', 'p', 'a', 'c'].forEach(function (k) {
      if (trim(raw[k]) !== '') out[k] = trim(raw[k]);
    });
    if (trim(raw.detalle) !== '') out.detalle = trim(raw.detalle);
  } else if (spec.kind === 'medications' || spec.kind === 'medication') {
    const meds = normalizeMedicamentosList(raw.medicamentos || raw.medicacion || raw);
    if (meds.length) return { medicamentos: meds };
  } else if (trim(raw.detalle) !== '') {
    out.detalle = trim(raw.detalle);
  }
  if (!Object.keys(out).length) return defaultFieldValue();
  return out;
}

/**
 * @param {{ kind: string }} spec
 * @param {unknown} raw
 */
export function normalizeFieldValue(spec, raw) {
  if (raw == null || raw === '') return defaultFieldValue();
  if (typeof raw === 'string') {
    const s = trim(raw);
    if (!s || s.toLowerCase() === NEGADO_FIELD) return defaultFieldValue();
    return normalizeFieldValueFromString(spec, s);
  }
  if (typeof raw !== 'object') return defaultFieldValue();
  if (raw.negado === true && !generoFieldHasContent(spec, raw)) return defaultFieldValue();
  return normalizeFieldValueFromObject(spec, raw);
}
