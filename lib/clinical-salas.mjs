/** Canonical clinical sala labels (registration, teams, LAN rooms, DB CHECK). */
export const CLINICAL_SALA_VALUES = [
  'Sala 1',
  'Sala 2',
  'Sala E',
  'Torre HU',
  'Área A/Pensionistas',
  'Interconsultas',
  'UX',
  'Eme',
];

/**
 * @param {{ values?: string[], allowNull?: boolean }} [opts]
 */
export function clinicalSalaSqlCheck(opts = {}) {
  const values = opts.values || CLINICAL_SALA_VALUES;
  const allowNull = opts.allowNull !== false;
  const list = values.map((s) => `'${String(s).replace(/'/g, "''")}'`).join(', ');
  if (allowNull) return `CHECK(sala IN (${list}) OR sala IS NULL)`;
  return `CHECK(sala IN (${list}))`;
}

/** @param {unknown} value */
function normalizeSalaKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** @param {string} sala */
export function clinicalServiceForSala(sala) {
  const key = normalizeSalaKey(sala);
  if (key === 'torre hu') return 'Torre HU';
  if (key === 'area a/pensionistas') return 'Área A/Pensionistas';
  if (key === 'interconsultas') return 'Interconsultas';
  if (key === 'ux') return 'UX';
  if (key === 'eme' || key === 'emergencias' || key === 'urgent care') return 'Eme';
  if (key === 'sala 1' || key === 'sala 2' || key === 'sala e') return 'Sala';
  return '';
}

/** Torre HU / Área A use shared ABCD — no Sala R1 primera/segunda línea. */
export function clinicalSalaUsesAbcOnlyRotation(sala) {
  const mapped = clinicalServiceForSala(sala);
  return mapped !== '' && mapped !== 'Sala';
}

/** @param {string} sala */
export function clinicalSalaRoomSlug(sala) {
  const s = String(sala || '').trim();
  if (s === 'Sala 1') return 'sala-1';
  if (s === 'Sala 2') return 'sala-2';
  if (s === 'Sala E') return 'sala-e';
  if (s === 'Torre HU') return 'torre-hu';
  if (s === 'Área A/Pensionistas') return 'area-a-pensionistas';
  if (s === 'Interconsultas') return 'interconsultas';
  if (s === 'UX') return 'ux';
  if (s === 'Eme') return 'eme';
  return '';
}
