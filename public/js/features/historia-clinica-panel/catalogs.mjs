import appConditions from '../../../../lib/historia-clinica/catalogs/app-conditions.json' with { type: 'json' };
import ahfConditions from '../../../../lib/historia-clinica/catalogs/ahf-conditions.json' with { type: 'json' };
import ipasSystems from '../../../../lib/historia-clinica/catalogs/ipas-systems.json' with { type: 'json' };

export const CATALOGS = { appConditions, ahfConditions, ipasSystems };
export { appConditions, ahfConditions, ipasSystems };

export const DEFAULT_LOOKBACK_H = 48;

export const DATA_KEYS = [
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
  'labsAtAdmission',
  'labAnchor',
  'meta',
  'labLookbackHours',
];

export function catalogOptions(map) {
  return Object.keys(map || {}).map(function (id) {
    return { id, label: map[id] };
  });
}
