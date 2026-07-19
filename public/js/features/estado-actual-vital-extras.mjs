/** @type {readonly string[]} */
export const VITAL_BASE_KEYS = ['tas', 'tad', 'fc', 'fr', 'temp', 'sat'];

/**
 * Clave en `vitals` / `alteredAt` para la lectura adicional (+1).
 * @param {string} baseKey
 * @returns {string}
 */
export function getVitalExtraStorageKey(baseKey) {
  return baseKey === 'temp' ? 'tempPeak' : baseKey + 'Extra';
}

/**
 * @param {string} storageKey
 * @returns {string}
 */
export function getBaseVitalKey(storageKey) {
  if (storageKey === 'tempPeak') return 'temp';
  if (String(storageKey).endsWith('Extra')) return String(storageKey).slice(0, -5);
  return storageKey;
}

/**
 * @param {Record<string, unknown> | null | undefined} vitals
 * @param {string} baseKey
 * @returns {unknown}
 */
export function getVitalExtraValue(vitals, baseKey) {
  if (!vitals || typeof vitals !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (vitals)[getVitalExtraStorageKey(baseKey)];
}
