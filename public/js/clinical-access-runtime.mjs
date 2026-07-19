/**
 * Wires clinical access modules into the running app (Guardia grid, session, signing).
 * Thin barrel — implementation lives under ./clinical-access-runtime/.
 */
export { clinicalSessionContext } from './clinical-session-context.mjs';

export { markClinicalAccessBootReady, waitForClinicalAccessReady } from './clinical-access-runtime/boot-ready.mjs';

export {
  isClinicalScopeReadyForLanPatientApply,
  applyClinicalScopeFromLanOpsSnapshot,
  prunePatientsOutsideClinicalScope,
} from './clinical-access-runtime/scope-lan.mjs';

export {
  fetchClinicalScopeContextFromDb,
  fetchClinicalTeamsFromDb,
  fetchActiveRotationCycleFromDb,
  fetchIncomingAssignmentsFromDb,
} from './clinical-access-runtime/scope-db.mjs';

export { getClinicalScopeContextForEvaluate } from './clinical-access-runtime/scope-evaluate.mjs';

export {
  mapPatientForGuardiaGrid,
  buildGuardiasMap,
  syncGuardiaCensusPanelVisibility,
  refreshGuardiaCensusFromDb,
  renderGuardiaCensusGrid,
} from './clinical-access-runtime/guardia-grid.mjs';

export {
  resolveClinicalRank,
  bootstrapClinicalAccess,
  lookupClinicalUserByUsername,
  resumeClinicalIdentityByUsername,
} from './clinical-access-runtime/bootstrap.mjs';

export { migrateLocalPatientsClinicalSala, getClinicalUser, unlockClinicalSessionOverlay } from './clinical-access-runtime/session-user.mjs';

export { touchClinicalSessionActivity } from './clinical-access-runtime/session-activity.mjs';

export { refreshClinicalUserProfile } from './clinical-access-runtime/session-profile.mjs';

export {
  ensureTeamAssignedPatientsOnDevice,
  ensureElevatedWardCensusOnDevice,
  refreshClinicalPatientListForScope,
  wireClinicalOpsSyncRefresh,
} from './clinical-access-runtime/census-lan-pull.mjs';

export {
  initClinicalAccessRuntime,
  stopClinicalAccessRuntime,
  resumeClinicalSession,
} from './clinical-access-runtime/lifecycle.mjs';

export {
  assertClinicalWriteAllowed,
  signOutgoingLiveSyncMutation,
  verifyIncomingClinicalLedger,
  guardAndSignLiveSyncMutation,
} from './clinical-access-runtime/crypto-signing.mjs';

export {
  pruneMobilePatientsOutsideTeamScope,
  finalizeMobileLanPatientCensus,
} from './clinical-access-runtime/mobile.mjs';
