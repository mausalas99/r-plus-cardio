/** @param {unknown} value */
export function normalizeServiceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** @param {Date|string|undefined} value @param {string|undefined} [fallbackIso] */
export function toMillis(value, fallbackIso) {
  if (value instanceof Date) return value.getTime();
  if (value != null && value !== '') return new Date(String(value)).getTime();
  if (fallbackIso) return new Date(String(fallbackIso)).getTime();
  return NaN;
}
