import { isDbMode } from '../db-storage-bridge.mjs';
import { hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';
import { patients } from '../app-state.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import {
  countElevatedMissingPatients,
  countTeamMemberMissingPatients,
} from './census-missing-count.mjs';
import {
  clinicalOpsSyncedRefreshTimer,
  refreshClinicalPatientListForScopeInFlight,
  setClinicalOpsSyncedRefreshTimer,
  setRefreshClinicalPatientListForScopeInFlight,
} from './state.mjs';
import { fetchClinicalScopeContextFromDb, fetchClinicalTeamsFromDb } from './scope-db.mjs';
import { getClinicalScopeContextForEvaluate } from './scope-evaluate.mjs';

/** @param {string} reason @param {number} [delayMs] */
async function scheduleLanPatientReconcile(reason, delayMs) {
  try {
    const lan = await import('../features/lan-sync.mjs');
    if (typeof lan.isLanSessionConfiguredForRest !== 'function' || !lan.isLanSessionConfiguredForRest()) {
      return;
    }
    const rid =
      typeof lan.getActiveLiveSyncRoomId === 'function'
        ? String(lan.getActiveLiveSyncRoomId() || '').trim()
        : '';
    if (!rid) return;
    const push = await import('../features/lan/push.mjs');
    if (typeof push.scheduleReconcileLiveSyncRoom === 'function') {
      push.scheduleReconcileLiveSyncRoom(rid, { reason, delayMs });
    }
  } catch { /* LAN optional */ }
}

async function countMissingAssignedPatients(user, teams, assignments, localIds, now) {
  if (hasElevatedTeamPrivileges(user)) {
    return countElevatedMissingPatients(assignments, localIds);
  }
  const teamMissing = await countTeamMemberMissingPatients(user, teams, assignments, localIds, now);
  return teamMissing == null ? 0 : teamMissing;
}

/** Pull host census rows for team assignments missing on this device. */
export async function ensureTeamAssignedPatientsOnDevice(options) {
  const user = clinicalSessionContext.user;
  if (!user?.user_id) return;
  const ctx = getClinicalScopeContextForEvaluate();
  const teams = Array.isArray(ctx.teams) ? ctx.teams : [];
  const assignments = Array.isArray(ctx.assignments) ? ctx.assignments : [];
  const now = ctx.now || new Date().toISOString();
  const localIds = new Set((patients || []).map((p) => String(p?.id || '')));
  const missing = await countMissingAssignedPatients(user, teams, assignments, localIds, now);
  if (!missing) return;
  const opts = options || {};
  if (!opts.allowLanPull) return;
  await scheduleLanPatientReconcile('missing-patients', opts.lanPullDelayMs);
}

/**
 * Elevated census: reconcile full ward from LAN host when viewing all teams.
 * @param {{ allowLanPull?: boolean, teamFilterId?: string, lanPullDelayMs?: number }} [options]
 */
export async function ensureElevatedWardCensusOnDevice(options = {}) {
  const user = clinicalSessionContext.user;
  if (!user?.user_id || !hasElevatedTeamPrivileges(user)) return;

  const teamFilterId = options.teamFilterId != null ? String(options.teamFilterId) : '';
  const viewingAllTeams = !teamFilterId;

  await ensureTeamAssignedPatientsOnDevice(options);

  if (!viewingAllTeams || !options.allowLanPull) return;
  await scheduleLanPatientReconcile(
    'full-ward-census',
    options.lanPullDelayMs != null ? options.lanPullDelayMs : 2000
  );
}

/** Reload teams + scope from DB and re-filter the patient sidebar (LAN join / team roster). */
export async function refreshClinicalPatientListForScope(options) {
  if (!clinicalSessionContext.user?.user_id) return;
  if (refreshClinicalPatientListForScopeInFlight) return refreshClinicalPatientListForScopeInFlight;
  const opts = options || {};
  setRefreshClinicalPatientListForScopeInFlight(
    (async function () {
      if (isDbMode()) {
        await fetchClinicalTeamsFromDb();
        await fetchClinicalScopeContextFromDb();
      }
      await ensureTeamAssignedPatientsOnDevice({
        allowLanPull: opts.allowLanPull !== false,
        lanPullDelayMs: opts.lanPullDelayMs,
      });
      if (typeof document === 'undefined') return;
      try {
        const mod = await import('../features/patients.mjs');
        if (typeof mod.renderPatientList === 'function') {
          mod.renderPatientList({ silent: true });
        }
      } catch { /* patients UI optional */ }
    })().finally(function () {
      setRefreshClinicalPatientListForScopeInFlight(null);
    })
  );
  return refreshClinicalPatientListForScopeInFlight;
}

function rosterChangedFromMergeStats(stats) {
  return (
    Number(stats.assignmentsInserted) > 0 ||
    Number(stats.membershipInserted) > 0 ||
    Number(stats.membershipRejoinsApplied) > 0
  );
}

async function scheduleHostReconcileAfterOpsMerge() {
  const lan = await import('../features/lan-sync.mjs');
  if (typeof lan.isLanSessionConfiguredForRest !== 'function' || !lan.isLanSessionConfiguredForRest()) {
    return;
  }
  const rid =
    typeof lan.getActiveLiveSyncRoomId === 'function' ? String(lan.getActiveLiveSyncRoomId() || '').trim() : '';
  if (!rid) return;
  const push = await import('../features/lan/push.mjs');
  if (typeof push.scheduleReconcileLiveSyncRoom === 'function') {
    push.scheduleReconcileLiveSyncRoom(rid, { reason: 'assignment-merge', delayMs: 2000 });
  } else if (typeof push.reconcileLiveSyncRoom === 'function') {
    void push.reconcileLiveSyncRoom(rid, { force: true, reason: 'assignment-merge' });
  }
}

/** One-shot host bundle pull when roster/assignments change visibility (not on every no-op merge). */
async function pullHostPatientsAfterOpsMerge(event) {
  const stats = event?.detail?.mergeStats;
  if (!stats || !rosterChangedFromMergeStats(stats)) return;
  try {
    await scheduleHostReconcileAfterOpsMerge();
  } catch { /* LAN optional */ }
}

export function wireClinicalOpsSyncRefresh() {
  if (typeof document === 'undefined' || document._rpcClinicalOpsSyncedRefreshWired) return;
  document._rpcClinicalOpsSyncedRefreshWired = true;
  document.addEventListener('rpc-clinical-ops-synced', (event) => {
    if (document.body.classList.contains('clinical-lan-directory-open')) return;
    if (clinicalOpsSyncedRefreshTimer) clearTimeout(clinicalOpsSyncedRefreshTimer);
    setClinicalOpsSyncedRefreshTimer(
      setTimeout(function () {
        setClinicalOpsSyncedRefreshTimer(null);
        void refreshClinicalPatientListForScope({ allowLanPull: false });
        void pullHostPatientsAfterOpsMerge(event);
      }, 1500)
    );
  });
}
