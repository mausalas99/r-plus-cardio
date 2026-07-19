/**
 * @param {unknown} value
 * @returns {string}
 */
export function summarizeHcString(value) {
  const t = value.trim();
  if (!t) return 'vacío';
  if (t.length <= 72) return '"' + t.replace(/\s+/g, ' ') + '"';
  return t.slice(0, 70).replace(/\s+/g, ' ') + '… (' + t.length + ' caracteres)';
}

/**
 * @param {object} value
 * @returns {string}
 */
export function summarizeHcObject(value) {
  const parts = [];
  const desc = value.descripcionDetallada || value.descripcion;
  if (desc && String(desc).trim()) {
    const d = String(desc).trim();
    parts.push(
      d.length <= 60 ? d : d.slice(0, 58).replace(/\s+/g, ' ') + '… (' + d.length + ' car.)',
    );
  }
  const conds = value.conditions || value.entries;
  if (Array.isArray(conds) && conds.length) {
    parts.push(conds.length + ' condición' + (conds.length === 1 ? '' : 'es'));
  }
  if (value.tabaquismo || value.alcoholismo) {
    parts.push('hábitos');
  }
  return parts.length ? parts.join(' · ') : 'bloque estructurado';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function summarizeHcValue(value) {
  if (value == null) return 'vacío';
  if (typeof value === 'string') return summarizeHcString(String(value).trim());
  if (Array.isArray(value)) {
    return value.length + ' elemento' + (value.length === 1 ? '' : 's');
  }
  if (typeof value === 'object') return summarizeHcObject(value);
  return 'contenido';
}
