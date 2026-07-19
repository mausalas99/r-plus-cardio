/**
 * @param {number} bytes
 * @returns {string} Ej. "12.3 MB"
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(2)} MB`;
}

/**
 * @param {number} bytesPerSecond
 * @returns {string} Ej. "1.2 MB/s" o "—" si no aplica
 */
export function formatSpeed(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '—';
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Etiqueta tipo "Descargando 37.3 MB / 59.2 MB · 1.1 MB/s"
 * @param {{ transferred: number, total: number, bytesPerSecond?: number }} p
 */
export function formatProgressLine(p) {
  const t = formatBytes(p.transferred || 0);
  const tot = formatBytes(p.total || 0);
  const sp = formatSpeed(p.bytesPerSecond);
  return `Descargando ${t} / ${tot} · ${sp}`;
}
