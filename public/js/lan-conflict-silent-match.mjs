/**
 * LWW silent-match helpers (no modal UI). Used by lan-sync hot path and optionally by clinical-conflict-viewer.
 */
import {
  summarizeArrayValue,
  summarizeObjectFieldValue,
  summarizeScalarValue,
  trimCollapse,
} from './lan-conflict-field-summarize.mjs';

const INTERNAL_DIFF_KEYS = new Set([
  'id',
  'patientId',
  'updatedAt',
  'version',
  'expectedVersion',
  '_deleted',
  'entityType',
  'entityId',
  'roomId',
  'clientId',
  'audit',
]);

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

const HC_STRUCTURED_KEYS = new Set(['ahf', 'app', 'apnp', 'ipas', 'genero', 'identificacion', 'signosVitalesIngreso']);

export { formatFieldLabel } from './lan-conflict-labels.mjs';

/**
 * @param {string} [fieldKey]
 * @param {unknown} value
 * @returns {string}
 */
export function summarizeConflictFieldValue(fieldKey, value) {
  const key = String(fieldKey || '').trim();
  const scalar = summarizeScalarValue(value);
  if (scalar != null) return scalar;
  if (Array.isArray(value)) return summarizeArrayValue(value);
  if (typeof value === 'object' && value) {
    const parts = summarizeObjectFieldValue(key, value);
    if (parts.length) return parts.join(' · ');
    if (HC_STRUCTURED_KEYS.has(key)) return 'bloque sin texto legible';
    try {
      const raw = JSON.stringify(value);
      return raw.length > 120 ? trimCollapse(raw, 117) : raw;
    } catch {
      return '—';
    }
  }
  return '—';
}

function isInternalNoiseKey(key, localData, serverData) {
  if (!INTERNAL_DIFF_KEYS.has(key)) return false;
  const serverVal = serverData?.[key];
  if (serverVal === undefined || serverVal === null) return true;
  return valuesEqual(localData?.[key], serverVal);
}

function keysThatDiffer(localData, serverData) {
  const keys = new Set([...Object.keys(localData || {}), ...Object.keys(serverData || {})]);
  keys.delete('_deleted');
  return [...keys]
    .filter((key) => !isInternalNoiseKey(key, localData, serverData))
    .filter((key) => !valuesEqual(localData?.[key], serverData?.[key]))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string[]} [conflictingKeys]
 * @param {Record<string, unknown>} [localData]
 * @param {Record<string, unknown>} [serverData]
 * @returns {string[]}
 */
export function pickDiffKeys(conflictingKeys, localData, serverData) {
  const raw = Array.isArray(conflictingKeys) ? conflictingKeys.filter(Boolean) : [];
  const onlyStar = raw.length === 1 && raw[0] === '*';

  if (raw.length && !onlyStar) {
    return raw
      .filter((key) => !isInternalNoiseKey(key, localData, serverData))
      .sort((a, b) => a.localeCompare(b));
  }

  return keysThatDiffer(localData, serverData).filter((key) => {
    if (!INTERNAL_DIFF_KEYS.has(key)) return true;
    return !valuesEqual(localData?.[key], serverData?.[key]);
  });
}

/**
 * @param {{ conflictingKeys?: string[], localData?: Record<string, unknown>, serverData?: Record<string, unknown> }} opts
 */
export function conflictSnapshotsMatchForAutoResolve({ conflictingKeys, localData, serverData }) {
  const keys = pickDiffKeys(conflictingKeys, localData, serverData);
  if (!keys.length) return false;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const localVal = summarizeConflictFieldValue(key, localData?.[key]);
    const serverVal = summarizeConflictFieldValue(key, serverData?.[key]);
    if (localVal !== serverVal || localVal === '—') return false;
  }
  return true;
}
