// Entrega form payload assembly helpers
import {
  clinicalSessionContext,
  getClinicalScopeContextForEvaluate,
} from '../../clinical-access-runtime.mjs';
import {
  buildEntregaPatientCensus,
  serializePendientesJson,
} from '../../../../lib/entrega/entrega-pendientes.mjs';
import { vitalsFrequencyForDb } from '../../../../lib/entrega/entrega-vitals-plan.mjs';
import {
  getEntregaDraftItems,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  readEntregaVitalsPlan,
} from '../entrega-modal-ui.mjs';
import { resolveEntregaPatientRow } from './clinical-entrega-util.mjs';
import { resolveEntregaSourceTeamId } from './clinical-entrega-team.mjs';
import { getEntregaPhaseCoveringUserId } from './clinical-entrega-phase.mjs';

/** @param {string} patientId @param {object|null|undefined} existing */
export function resolveEntregaFormCoveringUserId(patientId, existing) {
  const phaseCovering = getEntregaPhaseCoveringUserId();
  return String(
    document.getElementById('entrega-covering-user')?.value ||
      phaseCovering ||
      existing?.covering_user_id ||
      ''
  );
}

/** @param {string} patientId @param {object|null|undefined} existing @param {string} coveringUserId */
export function resolveEntregaFormSourceTeamId(patientId, existing, _coveringUserId) {
  const scopeCtx = getClinicalScopeContextForEvaluate();
  const teamsForSubmit = clinicalSessionContext.teams || scopeCtx.teams || [];
  const assignmentsForSubmit = scopeCtx.assignments || [];
  return (
    String(document.getElementById('entrega-source-team')?.value || '') ||
    resolveEntregaSourceTeamId(
      patientId,
      resolveEntregaPatientRow(patientId),
      teamsForSubmit,
      assignmentsForSubmit,
      existing,
      String(clinicalSessionContext.user?.user_id || '')
    )
  );
}

/** @param {string} patientId @param {string|undefined} guardiaId @param {object|null|undefined} existing */
export function buildEntregaSubmitPayload(patientId, guardiaId, existing) {
  const coveringUserId = resolveEntregaFormCoveringUserId(patientId, existing);
  const sourceTeamId = resolveEntregaFormSourceTeamId(patientId, existing, coveringUserId);
  const patientCensus = buildEntregaPatientCensus(resolveEntregaPatientRow(patientId));
  const vitalsPlan = readEntregaVitalsPlan();
  const handoffContext = readEntregaHandoffContext();
  const pendientesJson = serializePendientesJson({
    version: 2,
    vitalsPlan,
    handoffContext,
    ...(patientCensus ? { patientCensus } : {}),
    items: getEntregaDraftItems(),
  });

  return {
    patientId,
    guardiaId,
    coveringUserId,
    sourceTeamId,
    isCritical: readEntregaCriticalFromHandoff(),
    pendientesJson,
    vitalsFrequency: vitalsFrequencyForDb(vitalsPlan.frequency),
  };
}
