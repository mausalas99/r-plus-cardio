/** Canonical HTML escape helpers (dependency-free). */

/** @param {unknown} s */
export function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {unknown} s */
export function escAttr(s) {
  return escHtml(s).replace(/'/g, '&#39;');
}

/** @param {unknown} s */
export function esc(s) {
  return escHtml(s);
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return escHtml(s);
}

/** @param {unknown} s */
export function escapeAttr(s) {
  return escAttr(s);
}
