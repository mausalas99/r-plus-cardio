import { persistClinicalUserBinding, readRpcSettings } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { resolveClinicalUserRowFromOpsSnapshot } from '../clinical-scope-from-ops.mjs';

/** @param {unknown} resolvedRank @param {unknown} sessionRank */
function normalizeLanOpsRank(resolvedRank, sessionRank) {
  const rank = String(resolvedRank || sessionRank || 'R1').trim() || 'R1';
  return rank === 'Admin' ? 'R1' : rank;
}

/** @param {object} resolved */
function resolvedIsProgramAdmin(resolved) {
  return resolved.is_program_admin === 1 || resolved.is_program_admin === true ? 1 : 0;
}

/** @param {object} resolved @param {object|null|undefined} sessionUser */
function buildLanOpsSessionUser(resolved, sessionUser) {
  return {
    user_id: String(resolved.user_id),
    username: resolved.username ?? sessionUser?.username ?? null,
    rank: normalizeLanOpsRank(resolved.rank, sessionUser?.rank),
    sala: resolved.sala ?? sessionUser?.sala ?? null,
    clinical_name: resolved.clinical_name ?? sessionUser?.clinical_name ?? null,
    is_program_admin: resolvedIsProgramAdmin(resolved),
  };
}

/** @param {object} nextUser */
function persistLanOpsUserBinding(nextUser) {
  persistClinicalUserBinding({
    userId: nextUser.user_id,
    username: nextUser.username || undefined,
    rank: nextUser.rank,
    sala: nextUser.sala,
    displayName: nextUser.clinical_name || undefined,
    isProgramAdmin: nextUser.is_program_admin === 1,
    registered: true,
  });
}

/**
 * @param {object} snapshot
 * @param {object|null|undefined} sessionUser
 * @returns {boolean} whether user row was applied
 */
export function applyLanOpsResolvedUser(snapshot, sessionUser) {
  const settings = readRpcSettings();
  const resolved = resolveClinicalUserRowFromOpsSnapshot(snapshot, {
    userId: sessionUser?.user_id || settings.clinicalUserId,
    username: sessionUser?.username || settings.clinicalUsername,
  });
  if (!resolved) return false;

  const nextUser = buildLanOpsSessionUser(resolved, sessionUser);
  clinicalSessionContext.user = nextUser;
  persistLanOpsUserBinding(nextUser);
  return true;
}

function invalidateMobileSidebarPatientCache() {
  if (typeof document === 'undefined') return;
  void import('../features/patients.mjs')
    .then((mod) => {
      if (typeof mod.invalidateMobileSidebarPatientCache === 'function') {
        mod.invalidateMobileSidebarPatientCache();
      }
    })
    .catch(() => {});
}

export { invalidateMobileSidebarPatientCache };
