import { isDbMode } from '../db-storage-bridge.mjs';
import { isGuardiaMode } from '../features/chrome.mjs';
import { renderGuardiaBoard } from '../features/guardia-board.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { electronApi } from './electron-api.mjs';
import { fetchClinicalScopeContextFromDb, fetchClinicalTeamsFromDb } from './scope-db.mjs';

/** @param {Record<string, unknown>} p */
export function mapPatientForGuardiaGrid(p) {
  const cuarto = p.cuarto != null ? String(p.cuarto) : '';
  const cama = p.cama != null ? String(p.cama) : '';
  return {
    id: String(p.id),
    bed_label: [cuarto, cama].filter(Boolean).join('-'),
    name: String(p.nombre || ''),
    service: String(p.servicio || p.area || ''),
    sub_area: String(p.area || ''),
    negativa_maniobras_firmada: Number(p.negativa_maniobras_firmada || 0),
    interconsult_type: String(p.interconsult_type || 'None'),
    interconsult_status: String(p.interconsult_status || 'Pending'),
  };
}

/** @param {object[]} guardias */
export function buildGuardiasMap(guardias) {
  const map = new Map();
  (guardias || []).forEach((g) => {
    if (g && g.patient_id) map.set(String(g.patient_id), g);
  });
  return map;
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function syncGuardiaCensusPanelVisibility(_settings) {
  const legacyPanel = document.getElementById('guardia-census-panel');
  if (legacyPanel) legacyPanel.hidden = true;
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export async function renderGuardiaCensusGrid(settings) {
  if (isGuardiaMode()) renderGuardiaBoard(settings);
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export async function refreshGuardiaCensusFromDb(settings) {
  if (!isDbMode() || !clinicalSessionContext.user) return;
  const api = electronApi();
  if (!api || typeof api.dbGuardiaCensus !== 'function') return;
  const res = await api.dbGuardiaCensus({ userId: clinicalSessionContext.user.user_id });
  if (!res || res.ok === false) return;
  clinicalSessionContext.guardias = Array.isArray(res.guardias) ? res.guardias : [];
  clinicalSessionContext.guardiasMap = buildGuardiasMap(clinicalSessionContext.guardias);
  clinicalSessionContext.orphanGuardias = Array.isArray(res.orphans) ? res.orphans : [];
  await fetchClinicalTeamsFromDb();
  await fetchClinicalScopeContextFromDb();
  await renderGuardiaCensusGrid(settings);
}
