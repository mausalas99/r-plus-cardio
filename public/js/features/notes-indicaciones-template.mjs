/**
 * Apply extra template to indicaciones with merge mode prompt.
 */

/** @param {boolean} hasExisting */
export function resolveExtraTemplateMergeMode(hasExisting) {
  if (!hasExisting) return 'replace';
  const ans = prompt('Ya hay contenido en las indicaciones.\nEscribe R = reemplazar, A = agregar al final, C = cancelar.', 'A');
  const v = String(ans || '').trim().toUpperCase();
  if (v === 'C' || v === '') return null;
  return v === 'R' ? 'replace' : 'append';
}

/** @param {string} current @param {string} addition @param {string} mode */
export function mergeIndicacionField(current, addition, mode) {
  if (!addition) return current || '';
  if (mode === 'replace') return addition;
  if (!current) return addition;
  return current.replace(/\s+$/, '') + '\n' + addition;
}

/** @param {object} target @param {object} tmpl @param {string} mode */
export function applyExtraTemplateFields(target, tmpl, mode) {
  target.dieta = mergeIndicacionField(target.dieta || '', tmpl.dieta || '', mode);
  target.cuidados = mergeIndicacionField(target.cuidados || '', tmpl.cuidados || '', mode);
  target.medicamentos = mergeIndicacionField(target.medicamentos || '', tmpl.medicamentos || '', mode);
}
