import fieldSpecs from './catalogs/genero-field-specs.json' with { type: 'json' };
import { HC_INTERROGADO_NEGADO } from './defaults.mjs';
import { generoFieldHasContent } from './genero-field-shared.mjs';
import { normalizeFieldValue } from './genero-field-value.mjs';
import { formatGeneroFieldLine } from './genero-field-format.mjs';

export { generoFieldHasContent };

const NEGADO_FIELD = HC_INTERROGADO_NEGADO.toLowerCase();

/**
 * @param {string | null | undefined} sexo
 * @returns {'male' | 'female'}
 */
export function generoSexBucket(sexo) {
  return String(sexo || '').toUpperCase() === 'M' ? 'male' : 'female';
}

/**
 * @param {string | null | undefined} sexo
 * @returns {Array<{ id: string, label: string, kind: string, fullWidth?: boolean }>}
 */
export function generoFieldSpecsForSex(sexo) {
  const bucket = generoSexBucket(sexo);
  return (fieldSpecs[bucket] || fieldSpecs.female).slice();
}

/**
 * @param {string | null | undefined} sexo
 * @returns {Record<string, string>}
 */
export function generoCatalogForSex(sexo) {
  const out = {};
  generoFieldSpecsForSex(sexo).forEach(function (spec) {
    out[spec.id] = spec.label;
  });
  return out;
}

function defaultFieldValue() {
  return {};
}

/**
 * @param {string | null | undefined} sexo
 */
export function defaultGeneroBlock(sexo) {
  /** @type {Record<string, { negado: boolean }>} */
  const out = {};
  generoFieldSpecsForSex(sexo).forEach(function (spec) {
    out[spec.id] = defaultFieldValue();
  });
  return out;
}

function isLegacyGeneroShape(genero) {
  return (
    Array.isArray(genero.checks) ||
    genero.descripcion != null ||
    genero.negado != null
  );
}

function applyLegacyGeneroShape(genero, sexo, out) {
  const specs = generoFieldSpecsForSex(sexo);
  const checks = Array.isArray(genero.checks) ? genero.checks : [];
  const detail = String(genero.descripcion || '').trim();
  const isGenericDetail =
    !detail ||
    detail.toLowerCase() === HC_INTERROGADO_NEGADO.toLowerCase() ||
    detail.toLowerCase().endsWith(': ' + NEGADO_FIELD);
  specs.forEach(function (spec) {
    if (checks.indexOf(spec.id) >= 0 && detail && !isGenericDetail) {
      out[spec.id] = normalizeFieldValue(spec, detail);
    }
  });
}

/**
 * @param {object | null | undefined} genero
 * @param {string | null | undefined} sexo
 */
export function normalizeGeneroBlock(genero, sexo) {
  const specs = generoFieldSpecsForSex(sexo);
  const out = defaultGeneroBlock(sexo);
  if (!genero || typeof genero !== 'object') return out;

  if (isLegacyGeneroShape(genero)) {
    applyLegacyGeneroShape(genero, sexo, out);
    return out;
  }

  specs.forEach(function (spec) {
    if (genero[spec.id] != null) {
      out[spec.id] = normalizeFieldValue(spec, genero[spec.id]);
    }
  });
  return out;
}

export { formatGeneroFieldLine };

/**
 * @param {object | null | undefined} genero
 * @param {string | null | undefined} sexo
 */
export function formatGeneroSection(genero, sexo) {
  const specs = generoFieldSpecsForSex(sexo);
  const block = normalizeGeneroBlock(genero, sexo);
  const lines = specs
    .map(function (spec) {
      return formatGeneroFieldLine(spec, block[spec.id]);
    })
    .filter(Boolean);

  if (!lines.length) {
    return (
      specs
        .map(function (s) {
          return s.label;
        })
        .join(', ') +
      ': ' +
      NEGADO_FIELD
    );
  }

  return lines.join('\n');
}
