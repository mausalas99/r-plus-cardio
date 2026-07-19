/** Keys whose string values must stay as slugs / codes (catalog ids, entity keys). */
const SLUG_STRING_KEYS = new Set([
  'id',
  'substanceId',
  'conditionId',
  'relativeId',
  'linkedFrom',
  'stage',
]);

/** Keys never uppercased (metadata, numbers stored as strings, etc.). */
const SKIP_STRING_KEYS = new Set([
  'patientId',
  'createdAt',
  'updatedAt',
  'capturedAt',
  'setId',
  'source',
  'clientId',
  'fecha',
  'hora',
]);

/**
 * @param {string | null | undefined} value
 */
export function toClinicalHistoryText(value) {
  if (value == null) return '';
  return String(value).toUpperCase();
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {string | undefined} parentKey
 */
const PRESERVE_LITERAL = new Set([
  'negado',
  'activo',
  'exfumador',
  'dia',
  'daily',
  'semana',
  'weekly',
  'fin',
  'weekend',
  'mes',
  'monthly',
  'si',
  'no',
]);

function shouldPreserveString(key, value, parentKey) {
  if (typeof value !== 'string') return true;
  if (!value.trim()) return true;
  if (SKIP_STRING_KEYS.has(key)) return true;
  if (key === 'conditions' || key === 'checks' || parentKey === 'conditions' || parentKey === 'checks') {
    return true;
  }
  if (SLUG_STRING_KEYS.has(key) && /^[a-z][a-z0-9_]*$/i.test(value)) return true;
  if (key === 'status' || key === 'frequencyKind' || key === 'portadorVih') {
    if (PRESERVE_LITERAL.has(value.trim().toLowerCase())) return true;
  }
  return false;
}

/**
 * Deep-copy uppercasing for Historia Clínica free text (in-place friendly).
 * @param {unknown} value
 * @param {string} [key]
 * @param {string} [parentKey]
 */
export function applyClinicalHistoryUppercase(value, key, parentKey) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (shouldPreserveString(key || '', value, parentKey)) return value;
    return toClinicalHistoryText(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return applyClinicalHistoryUppercase(item, key, parentKey);
    });
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach(function (k) {
      value[k] = applyClinicalHistoryUppercase(value[k], k, key);
    });
    return value;
  }
  return value;
}

/**
 * @param {Element | null} el
 */
export function shouldUppercaseHcInput(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.dataset && el.dataset.hcNoUppercase != null) return false;
  const tag = el.tagName;
  if (tag === 'SELECT') return false;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return type === 'text' || type === '' || type === 'search';
}

/**
 * @param {HTMLInputElement | HTMLTextAreaElement} el
 */
export function applyUppercaseToHcInput(el) {
  if (!shouldUppercaseHcInput(el)) return;
  const next = toClinicalHistoryText(el.value);
  if (el.value === next) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = next;
  if (start != null && end != null) {
    try {
      el.setSelectionRange(start, end);
    } catch (_e) { void _e; }
  }
}
