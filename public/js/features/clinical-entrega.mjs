/**
 * Entrega (handoff) modal — assign active_guardias with rank-based eligibility (façade).
 */
import { resolveEntregaActorRole as resolveEntregaActorRoleImpl } from './entrega-modal-ui.mjs';
import { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY } from './clinical-entrega/clinical-entrega-constants.mjs';
import {
  ensureEntregaTargetUser,
  collectEntregaScopeUsers,
  listEntregaTargets,
} from './clinical-entrega/clinical-entrega-targets.mjs';
import {
  resolveEntregaSourceTeamId,
  resolveEntregaCensusTeamId,
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
} from './clinical-entrega/clinical-entrega-team.mjs';
import {
  submitEntregaAssignment,
  collectEntregaFormPayload,
  persistEntregaFormState,
} from './clinical-entrega/clinical-entrega-submit.mjs';
import { openEntregaModal, closeEntregaModal } from './clinical-entrega/clinical-entrega-modal.mjs';
import {
  resolveR1GuardiaCovering,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
  getEntregaPhase,
  isEntregaPhaseActive,
  getEntregaPhaseCoveringUserId,
  startEntregaPhase,
  endEntregaPhase,
  endEntregaPhaseFlow,
  beginEntregaPhaseFlow,
  toggleEntregaPhase,
  loadGuardiaGridViewContext,
  saveGuardiaGridMode,
} from './clinical-entrega/clinical-entrega-phase.mjs';

export function resolveEntregaActorRole(currentUser, existingGuardia) {
  return resolveEntregaActorRoleImpl(currentUser, existingGuardia);
}

export { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY };
export {
  ensureEntregaTargetUser,
  collectEntregaScopeUsers,
  listEntregaTargets,
  resolveEntregaSourceTeamId,
  resolveEntregaCensusTeamId,
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
  submitEntregaAssignment,
  collectEntregaFormPayload,
  persistEntregaFormState,
  openEntregaModal,
  closeEntregaModal,
  resolveR1GuardiaCovering,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
  getEntregaPhase,
  isEntregaPhaseActive,
  getEntregaPhaseCoveringUserId,
  startEntregaPhase,
  endEntregaPhase,
  endEntregaPhaseFlow,
  beginEntregaPhaseFlow,
  toggleEntregaPhase,
  loadGuardiaGridViewContext,
  saveGuardiaGridMode,
};
