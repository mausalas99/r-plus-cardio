/** Shared equipos date/duration formatters. */

/** @param {string} [iso] */
export function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** @param {number|null|undefined} sec */
export function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const n = Math.max(0, Math.floor(sec));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return '< 1 min';
}
