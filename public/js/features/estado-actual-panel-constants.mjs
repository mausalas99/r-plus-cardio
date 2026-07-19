/** Vital keys and labels shared across Estado Actual panel modules. */

/** @type {readonly string[]} */
export const VITAL_KEYS = ['tas', 'tad', 'fc', 'fr', 'temp', 'sat'];

/** @type {Record<string, string>} */
export const VITAL_LABELS = {
  tas: 'TAS',
  tad: 'TAD',
  fc: 'FC',
  fr: 'FR',
  temp: 'Temp',
  sat: 'Saturación',
};

/** @type {Record<string, string>} */
export const VITAL_UNITS = {
  tas: 'mmHg',
  tad: 'mmHg',
  fc: 'lpm',
  fr: 'rpm',
  temp: '°C',
  sat: '%',
};

/** @type {readonly string[]} */
export const SOPORTE_OPTIONS = [
  'Aire ambiente',
  'Puntillas nasales',
  'Alto flujo',
  'VM no invasiva',
  'Traqueostomía',
];
