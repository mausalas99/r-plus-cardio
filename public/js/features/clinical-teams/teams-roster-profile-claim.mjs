/** Mi rotación — username claim / resume before profile save. */
import { clinicalSessionContext, resumeClinicalIdentityByUsername } from '../../clinical-access-runtime.mjs';
import {
  isLegacyMachineUsername,
  normalizeUsername,
  shouldClaimClinicalUsername,
} from '../../clinical-username.mjs';
import { dbApi, toast, currentUserId } from './shared.mjs';

export function clientIdFromSettings() {
  try {
    return String(JSON.parse(localStorage.getItem('rpc-settings') || '{}').clientId || '');
  } catch {
    return '';
  }
}

async function confirmUsernameChange(currentUsername, username) {
  if (!currentUsername || isLegacyMachineUsername(currentUsername, clientIdFromSettings())) {
    return true;
  }
  return window.confirm(
    `¿Cambiar tu usuario de @${currentUsername} a @${username}? Los equipos verán el nuevo nombre.`
  );
}

async function tryResumeExistingUsername(username, errMsg) {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
  } catch (_e) { void _e; }
  const resume = window.confirm(
    `El usuario @${username} ya existe.\n\n¿Recuperar tu cuenta en este dispositivo?`
  );
  if (!resume) {
    toast(errMsg, 'error');
    return false;
  }
  const resumeRes = await resumeClinicalIdentityByUsername(
    username,
    settings,
    clientIdFromSettings()
  );
  if (!resumeRes.ok) {
    toast(resumeRes.error || errMsg, 'error');
    return false;
  }
  return true;
}

async function submitUsernameClaim(userId, username) {
  const api = dbApi();
  if (typeof api.dbClinicalUsernameClaim !== 'function') {
    toast('No se pudo guardar el usuario LAN.', 'error');
    return false;
  }
  const claimRes = await api.dbClinicalUsernameClaim({ userId, username });
  if (claimRes?.ok) return true;
  const errMsg = String(claimRes?.error || '');
  if (/ya está en uso/i.test(errMsg)) {
    return tryResumeExistingUsername(username, errMsg);
  }
  toast(errMsg || 'No se pudo guardar el usuario.', 'error');
  return false;
}

/**
 * @returns {Promise<boolean|null>} true = changed ok, false = blocked, null = no change needed
 */
export async function claimClinicalUsernameIfNeeded(username, sala) {
  const userId = currentUserId();
  const api = dbApi();
  const currentUsername = normalizeUsername(clinicalSessionContext.user?.username || '');
  const usernameWillChange = shouldClaimClinicalUsername(
    currentUsername,
    username,
    clientIdFromSettings()
  );
  if (!usernameWillChange) return null;
  if (!userId || !api) return false;

  const { assertLanRoomForUsernameRegister } = await import('../../clinical-profile-lan-sync.mjs');
  await assertLanRoomForUsernameRegister({ sala });
  if (!(await confirmUsernameChange(currentUsername, username))) return false;

  const claimed = await submitUsernameClaim(userId, username);
  if (!claimed) return false;
  if (clinicalSessionContext.user) clinicalSessionContext.user.username = username;
  return true;
}
