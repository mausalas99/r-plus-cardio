export const id = 'drive-eventos-only-v1';
export const label = 'Solo eventualidades';

/**
 * @param {Record<string, string>} sections
 * @param {unknown} header
 */
export function score(sections, header) {
  const hcKeys = ['ficha', 'historiaClinica', 'peea', 'app', 'apnp', 'ahf', 'motivoConsulta'];
  const hasHc = hcKeys.some((k) => sections[k] && String(sections[k]).trim());
  if (hasHc) return 0;
  let s = 10;
  if (!header) s += 15;
  return s;
}

export function mapHc() {
  return {};
}
