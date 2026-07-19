/** @param {Date|string|undefined} value @param {string|undefined} [fallbackIso] */
export function toMillis(value, fallbackIso) {
  if (value instanceof Date) return value.getTime();
  if (value != null && value !== '') return new Date(String(value)).getTime();
  if (fallbackIso) return new Date(String(fallbackIso)).getTime();
  return NaN;
}
