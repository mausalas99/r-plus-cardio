'use strict';

const LEGACY_SECTION_KEYS = new Set(['ficha', 'ahf', 'app', 'apnp', 'peea']);
const NESTED_SECTION_KEYS = new Set([
  'identificacion',
  'motivoConsulta',
  'apnp',
  'app',
  'ahf',
  'genero',
  'sexual',
  'padecimientoActual',
  'datosNegados',
  'ipas',
  'signosVitalesIngreso',
]);
const SECTION_KEYS = new Set([...LEGACY_SECTION_KEYS, ...NESTED_SECTION_KEYS]);
const META_KEYS = new Set([
  'labsAtAdmission',
  'labAnchor',
  'labLookbackHours',
  'editMode',
  'meta',
  'patientId',
  'createdAt',
  'updatedAt',
]);

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isLegacyFlatHistoria(data) {
  if (!isPlainObject(data)) return false;
  return (
    typeof data.ficha === 'string' ||
    typeof data.app === 'string' ||
    typeof data.ahf === 'string' ||
    typeof data.apnp === 'string' ||
    typeof data.peea === 'string'
  );
}

/**
 * Best-effort flat → nested migration for PUT payloads still on legacy shape.
 * @param {Record<string, unknown>} data
 */
function migrateLegacyHistoriaData(data) {
  if (!isPlainObject(data) || !isLegacyFlatHistoria(data)) {
    return data;
  }
  const out = { ...data };
  if (typeof out.app === 'string') {
    out.app = {
      conditions: [],
      descripcionDetallada: out.app,
      medicamentosActuales: '',
      hospitalizacionesPrevias: '',
    };
  }
  if (typeof out.ahf === 'string') {
    out.ahf = { conditions: [], descripcionDetallada: out.ahf };
  }
  if (typeof out.apnp === 'string') {
    out.apnp = { tabaquismo: out.apnp };
  }
  if (typeof out.peea === 'string') {
    out.padecimientoActual = out.peea;
  }
  if (typeof out.ficha === 'string') {
    const ident = isPlainObject(out.identificacion) ? { ...out.identificacion } : {};
    ident.informante = out.ficha;
    out.identificacion = ident;
  }
  delete out.ficha;
  delete out.peea;
  return out;
}

module.exports = {
  migrateLegacyHistoriaData,
  SECTION_KEYS,
  NESTED_SECTION_KEYS,
  LEGACY_SECTION_KEYS,
  META_KEYS,
  isPlainObject,
};
