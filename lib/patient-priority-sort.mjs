import { normalizeHandoffContext } from './entrega/entrega-handoff-context.mjs';
import { normalizePendientesJson } from './entrega/entrega-pendientes.mjs';
import { comparePatientsByBed } from './patient-bed-sort.mjs';

/**
 * 0 = crítico, 1 = inestable, 2 = resto.
 * @param {Record<string, unknown>} patient
 * @param {{ is_critical?: number|boolean, pendientes_json?: string|null }|null|undefined} guardiaMeta
 */
export function patientClinicalPriorityRank(patient, guardiaMeta) {
  const g = guardiaMeta || {};
  if (g.is_critical === 1 || g.is_critical === true || patient?.isCritical) return 0;

  let status = '';
  if (g.pendientes_json) {
    const doc = normalizePendientesJson(g.pendientes_json);
    status = normalizeHandoffContext(doc.handoffContext).clinicalStatus;
  }
  if (status === 'critical') return 0;
  if (status === 'unstable') return 1;
  return 2;
}

/**
 * @param {Record<string, unknown>} patient
 * @param {Map<string, object>|null|undefined} guardiasMap
 */
function guardiaMetaForPatient(patient, guardiasMap) {
  const id = String(patient?.id || '');
  if (!id) return patient?.guardiaMeta || {};
  return guardiasMap?.get?.(id) || patient?.guardiaMeta || {};
}

/**
 * Críticos e inestables primero; dentro de cada grupo, por cama.
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {Map<string, object>|null|undefined} [guardiasMap]
 */
export function comparePatientsByPriorityThenBed(a, b, guardiasMap) {
  const ra = patientClinicalPriorityRank(a, guardiaMetaForPatient(a, guardiasMap));
  const rb = patientClinicalPriorityRank(b, guardiaMetaForPatient(b, guardiasMap));
  if (ra !== rb) return ra - rb;
  return comparePatientsByBed(a, b);
}

/**
 * @template T
 * @param {T[]} patients
 * @param {Map<string, object>|null|undefined} [guardiasMap]
 */
export function sortPatientsByPriorityThenBed(patients, guardiasMap) {
  return [...(patients || [])].sort((a, b) => comparePatientsByPriorityThenBed(a, b, guardiasMap));
}
