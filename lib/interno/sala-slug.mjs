import { CLINICAL_SALA_VALUES, clinicalSalaRoomSlug } from '../clinical-salas.mjs';

/** @param {string} slug */
export function salaFromSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (s === 'sala-1' || s === '1') return 'Sala 1';
  if (s === 'sala-2' || s === '2') return 'Sala 2';
  if (s === 'sala-e' || s === 'e') return 'Sala E';
  if (s === 'torre-hu') return 'Torre HU';
  if (s === 'area-a-pensionistas') return 'Área A/Pensionistas';
  return '';
}

/** @param {string} sala */
export function slugFromSala(sala) {
  return clinicalSalaRoomSlug(sala);
}

/** @type {readonly string[]} */
export const INTERNOS_SALA_VALUES = CLINICAL_SALA_VALUES;
