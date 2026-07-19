import { hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';
import { isLegacyMachineUsername } from '../clinical-username.mjs';
import { persistClinicalUserBinding, readRpcSettings } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { electronApi } from './electron-api.mjs';
import { ensureElevatedWardCensusOnDevice } from './census-lan-pull.mjs';
import { buildGuardiasMap } from './guardia-grid.mjs';
import { fetchClinicalScopeContextFromDb, fetchClinicalTeamsFromDb } from './scope-db.mjs';
import { refreshClinicalUserProfile } from './session-profile.mjs';
import { migrateLocalPatientsClinicalSala } from './session-user.mjs';

/** @param {string} userId */
async function mergeBootstrapProfileFromDb(userId) {
  const api = electronApi();
  if (!api || typeof api.dbClinicalProfileGet !== 'function') return;
  try {
    const profileRes = await api.dbClinicalProfileGet({ userId });
    const profile = profileRes?.profile;
    if (!profile || !clinicalSessionContext.user) return;
    const profileRank = String(profile.rank || '');
    clinicalSessionContext.user.rank =
      profileRank === 'Admin' ? 'R1' : profileRank || clinicalSessionContext.user.rank;
    clinicalSessionContext.user.sala = profile.sala ?? null;
    clinicalSessionContext.user.clinical_name = profile.clinical_name ?? null;
    clinicalSessionContext.user.is_program_admin =
      profile.is_program_admin === 1 || profileRank === 'Admin' ? 1 : 0;
  } catch { /* profile IPC optional */ }
}

function applyBootstrapGuardiaState(res) {
  clinicalSessionContext.decryptedPrivateKeyPem = res.user.privateKeyPem || null;
  clinicalSessionContext.guardias = Array.isArray(res.guardias) ? res.guardias : [];
  clinicalSessionContext.guardiasMap = buildGuardiasMap(clinicalSessionContext.guardias);
  clinicalSessionContext.orphanGuardias = Array.isArray(res.orphans) ? res.orphans : [];
}

function persistBootstrapUserBinding(res) {
  const settings = readRpcSettings();
  const clientId = String(settings.clientId || '');
  const patch = {
    userId: res.user.userId,
    username: res.user.username,
  };
  if (isLegacyMachineUsername(res.user.username, clientId)) {
    patch.staleDeviceUserId = res.user.userId;
  }
  persistClinicalUserBinding(patch);
}

async function refreshBootstrapScopeAndCensus() {
  await refreshClinicalUserProfile();
  await fetchClinicalTeamsFromDb();
  await fetchClinicalScopeContextFromDb();
  if (hasElevatedTeamPrivileges(clinicalSessionContext.user)) {
    void ensureElevatedWardCensusOnDevice({
      allowLanPull: true,
      lanPullDelayMs: 8000,
      teamFilterId: '',
    });
  }
  if (typeof document !== 'undefined') {
    void import('../clinical-profile-lan-sync.mjs')
      .then((mod) => mod.flushClinicalProfileToLan())
      .catch(() => {});
  }
  migrateLocalPatientsClinicalSala();
}

/** @param {object} res Bootstrap IPC payload with `user` and `guardias`. */
export async function applyBootstrapResult(res) {
  clinicalSessionContext.user = {
    user_id: res.user.userId,
    username: res.user.username,
    rank: res.user.rank,
    is_program_admin: res.user.isProgramAdmin ? 1 : 0,
    public_key: res.user.publicKeyPem,
  };
  await mergeBootstrapProfileFromDb(res.user.userId);
  applyBootstrapGuardiaState(res);
  persistBootstrapUserBinding(res);
  await refreshBootstrapScopeAndCensus();
}
