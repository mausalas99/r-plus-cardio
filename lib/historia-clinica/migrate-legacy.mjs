import {
  hasLegacyFlatHistoriaFields,
  migrateLegacyFicha,
  migrateLegacyApp,
  migrateLegacyAhf,
  migrateLegacyApnpPeea,
} from './migrate-legacy-fields.mjs';

/**
 * Migrate flat legacy historia fields (ficha, ahf, app, apnp, peea strings)
 * into the nested HistoriaClinicaData shape.
 *
 * @param {object} legacy
 * @returns {object}
 */
export function migrateLegacyHistoriaData(legacy) {
  if (!legacy || typeof legacy !== 'object') return legacy;
  if (!hasLegacyFlatHistoriaFields(legacy)) return { ...legacy };

  const out = { ...legacy };
  migrateLegacyFicha(out, legacy);
  migrateLegacyApp(out, legacy);
  migrateLegacyAhf(out, legacy);
  migrateLegacyApnpPeea(out, legacy);

  delete out.ficha;
  delete out.peea;

  return out;
}
