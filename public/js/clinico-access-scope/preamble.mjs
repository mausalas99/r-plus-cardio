import {
  isActiveGuardiaCoveringUser,
  isIncomingPreviewWindow,
  isInterconsultasPatient,
  userOffCallFromInterconsultasRotationServices,
  userOnCallForInterconsultasTeam,
} from '../clinico-access.mjs';
import { toMillis } from './scope-utils.mjs';

/** @param {object} ctx @returns {object|null} */
export function evaluateScopeIdentity(ctx) {
  const { currentUser, targetPatient, deny } = ctx;
  if (!currentUser?.user_id || !targetPatient?.id) {
    return deny('Usuario o paciente no identificado');
  }
  return null;
}

/** @param {object} ctx @returns {object|null} */
export function evaluateScopeAdmin(ctx) {
  const { currentUser, rank, enforceTeamPatientScope, allow } = ctx;
  if (
    !enforceTeamPatientScope &&
    (currentUser.is_program_admin === 1 ||
      currentUser.is_program_admin === true ||
      rank === 'Admin')
  ) {
    return allow('Privilegios admin: acceso completo');
  }
  return null;
}

/** @param {object} ctx @returns {object|null} */
export function evaluateScopeActiveGuardia(ctx) {
  const { userId, activeGuardia, allow } = ctx;
  if (isActiveGuardiaCoveringUser(userId, activeGuardia)) {
    return allow('Guardia activa: cobertura asignada');
  }
  return null;
}

/** @param {object} ctx @returns {object|null} */
export function evaluateScopeIncomingPreview(ctx) {
  const { patientId, assignments, cycle, now, allow } = ctx;
  if (!isIncomingPreviewWindow(cycle, now)) return null;
  const incoming = assignments.find((a) => String(a.patient_id) === patientId);
  if (!incoming) return null;
  const effectiveMs = toMillis(incoming.effective_at);
  const nowMs = toMillis(now);
  if (Number.isFinite(effectiveMs) && Number.isFinite(nowMs) && nowMs < effectiveMs) {
    return allow(
      'Vista previa Incoming: lectura permitida hasta vigencia',
      true,
      false,
      { incomingPreview: true }
    );
  }
  return null;
}

/** @param {object} ctx @returns {object|null} */
export function evaluateScopeInterconsultas(ctx) {
  const { targetPatient, userId, joinedTeams, rank, now, allow } = ctx;
  if (!isInterconsultasPatient(targetPatient)) return null;
  if (userOffCallFromInterconsultasRotationServices(userId, joinedTeams, rank, now)) {
    return allow('Off-call UX/Eme: censo Interconsultas');
  }
  if (userOnCallForInterconsultasTeam(userId, joinedTeams, rank, now)) {
    return allow('Interconsultas de guardia: censo del día');
  }
  return null;
}

export const SCOPE_PREAMBLE_EVALUATORS = [
  evaluateScopeIdentity,
  evaluateScopeAdmin,
  evaluateScopeActiveGuardia,
  evaluateScopeIncomingPreview,
];
