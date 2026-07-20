/**
 * Clinical onboarding gate helpers.
 */
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import {
  isClinicalLocalOnlyMode,
  isClinicalSyncModeChosen,
  isLocalOnlyPlaceholderUsername,
  needsClinicalLanProfileGate,
  readRpcSettings,
  resolveClinicalClientId,
  setClinicalSyncModeLocalOnly,
} from '../clinical-settings.mjs';
import { isDbMode } from '../db-storage-bridge.mjs';
import { hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';
import { filterJoinedTeams } from './clinical-teams.mjs';
import {
  isLegacyMachineUsername,
  isValidUsernameFormat,
  normalizeUsername,
} from '../clinical-username.mjs';
import { isCardionotasLanUiEnabled } from './cardio/cardionotas-gates.mjs';

function getClientId() {
  return resolveClinicalClientId(readRpcSettings());
}

export function needsUsernameClaim() {
  const user = clinicalSessionContext.user;
  if (!user?.user_id) return true;
  if (isLegacyMachineUsername(user.username, getClientId())) return true;
  try {
    const settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    const cached = String(settings.clinicalUsername || '').trim();
    if (cached && !isValidUsernameFormat(normalizeUsername(cached))) return true;
    if (cached && isLegacyMachineUsername(user.username, getClientId())) return true;
  } catch (_e) { void _e; }
  const handle = normalizeUsername(user.username || '');
  return !isValidUsernameFormat(handle);
}

/** Sin equipo asignado (informativo; no bloquea la app). R4/Admin supervisan sin unirse. */
export function needsTeamOnboarding() {
  if (!clinicalSessionContext.user?.user_id) return true;
  if (hasElevatedTeamPrivileges(clinicalSessionContext.user)) return false;
  const teams = clinicalSessionContext.teams || [];
  return filterJoinedTeams(teams, clinicalSessionContext.user).length === 0;
}

/** First screen: LAN guardia vs solo este equipo (before any profile fields).
 *  R+ Cardio has no LAN — force solo-equipo and never show the choice. */
export function needsClinicalSyncModeChoice() {
  if (!isDbMode()) return false;
  if (!isCardionotasLanUiEnabled()) {
    const settings = readRpcSettings();
    if (!isClinicalLocalOnlyMode(settings)) {
      setClinicalSyncModeLocalOnly(true);
    }
    return false;
  }
  const settings = readRpcSettings();
  if (settings.clinicalRegistered === true) return false;
  if (isClinicalSyncModeChosen(settings)) return false;
  return true;
}

function syncSessionFromPersistedProfile(settings, user) {
  if (!user) return;
  const cachedUser = normalizeUsername(String(settings.clinicalUsername || ''));
  if (cachedUser && isValidUsernameFormat(cachedUser)) {
    user.username = cachedUser;
  }
  if (!String(user.clinical_name || '').trim() && settings.clinicalDisplayName) {
    user.clinical_name = String(settings.clinicalDisplayName);
  }
  if (!String(user.sala || '').trim() && settings.clinicalSala) {
    user.sala = String(settings.clinicalSala);
  }
  if (settings.clinicalRank && !String(user.rank || '').trim()) {
    user.rank = String(settings.clinicalRank);
  }
}

function hasValidPersistedUsername(settings) {
  const cachedUser = normalizeUsername(String(settings.clinicalUsername || ''));
  return (
    isValidUsernameFormat(cachedUser) &&
    !isLegacyMachineUsername(cachedUser, getClientId()) &&
    !isLocalOnlyPlaceholderUsername(cachedUser)
  );
}

/** Device binding written by onboarding submit — trust when session row lags IPC refresh. */
export function hasPersistedClinicalProfile(settings = readRpcSettings(), user = clinicalSessionContext.user) {
  if (settings.clinicalRegistered !== true) return false;
  if (isClinicalLocalOnlyMode(settings)) return true;
  if (needsClinicalLanProfileGate(settings)) return false;
  if (!hasValidPersistedUsername(settings)) return false;
  const hasName = String(settings.clinicalDisplayName || user?.clinical_name || '').trim();
  const hasSala = String(settings.clinicalSala || user?.sala || '').trim();
  return !!hasName && !!hasSala;
}

function needsLocalOnlyProfile(settings) {
  if (!isClinicalLocalOnlyMode(settings)) return false;
  return settings.clinicalRegistered !== true;
}

function needsLanProfile(settings, user) {
  if (hasPersistedClinicalProfile(settings, user)) return false;
  if (needsClinicalLanProfileGate(settings)) return true;
  if (isLocalOnlyPlaceholderUsername(user?.username)) return true;
  if (needsUsernameClaim()) return true;
  if (!String(user?.clinical_name || settings.clinicalDisplayName || '').trim()) return true;
  if (!String(user?.sala || settings.clinicalSala || '').trim()) return true;
  return false;
}

/** Falta perfil clínico mínimo antes de usar guardia / Mi rotación con datos. */
export function needsProfileOnboarding() {
  if (!isDbMode()) return false;
  if (!clinicalSessionContext.user?.user_id) return true;
  if (needsClinicalSyncModeChoice()) return true;
  const settings = readRpcSettings();
  const user = clinicalSessionContext.user;
  if (hasPersistedClinicalProfile(settings, user)) {
    syncSessionFromPersistedProfile(settings, user);
    return false;
  }
  if (needsLocalOnlyProfile(settings)) return true;
  return needsLanProfile(settings, user);
}

export function needsClinicalOnboarding() {
  return needsProfileOnboarding();
}

export { getClientId, needsLocalOnlyProfile };
