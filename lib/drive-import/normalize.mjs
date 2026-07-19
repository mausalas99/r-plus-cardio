/**
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeDrivePaste(text) {
  return String(text == null ? '' : text)
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
