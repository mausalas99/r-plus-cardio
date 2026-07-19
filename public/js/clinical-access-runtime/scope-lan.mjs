import { isDbMode } from '../db-storage-bridge.mjs';
import { shouldEnforceTeamPatientMirror, shouldUseElevatedPatientCensus } from '../clinical-privileges.mjs';
import { readEntregaPhaseActive } from '../clinico-access.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { buildClinicalScopeContextFromOpsSnapshot } from '../clinical-scope-from-ops.mjs';
import { joinedTeamIdsForUser } from '../mobile-team-patient-scope.mjs';
import { buildGuardiasMap } from './guardia-grid.mjs';
import { applyLanOpsResolvedUser, invalidateMobileSidebarPatientCache } from './scope-lan-user.mjs';

/** True when LAN may apply/filter patient bundle rows for the signed-in user. */
export function isClinicalScopeReadyForLanPatientApply() {
  const user = clinicalSessionContext.user;
  if (!user?.user_id) return false;
  if (shouldUseElevatedPatientCensus(user)) return true;
  // Desktop: scope evaluate has a session fallback — do not block push/apply on scopeContext hydrate races.
  if (!shouldEnforceTeamPatientMirror()) return true;
  const ctx = clinicalSessionContext.scopeContext;
  if (!ctx) return false;
  return joinedTeamIdsForUser(ctx.teams, user).size > 0;
}

function applyLanOpsScopeContext(snapshot) {
  const ctx = buildClinicalScopeContextFromOpsSnapshot(snapshot, {
    guardiaMode: clinicalSessionContext.guardiaMode,
    entregaPhaseActive: readEntregaPhaseActive(),
    enforceTeamPatientScope: true,
  });
  if (!ctx) return false;
  clinicalSessionContext.scopeContext = ctx;
  clinicalSessionContext.teams = ctx.teams;
  clinicalSessionContext.guardias = ctx.guardias;
  clinicalSessionContext.guardiasMap = buildGuardiasMap(ctx.guardias);
  return true;
}

/**
 * iPad/PWA: hydrate teams/assignments from LAN clinicalOps (no SQLCipher merge).
 * @param {object|null|undefined} snapshot
 * @returns {boolean}
 */
export function applyClinicalScopeFromLanOpsSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || isDbMode()) return false;
  applyLanOpsResolvedUser(snapshot, clinicalSessionContext.user);
  if (!applyLanOpsScopeContext(snapshot)) return false;
  invalidateMobileSidebarPatientCache();
  return true;
}

/**
 * Sidebar scope is enforced in patientsVisibleInSidebar — do not delete charts from storage.
 * @returns {number} always 0 (legacy callers kept for compatibility)
 */
export function prunePatientsOutsideClinicalScope() {
  return 0;
}
