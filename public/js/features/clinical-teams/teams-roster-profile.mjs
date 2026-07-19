/** Mi rotación — clinical profile form submit from panel. */
import { clinicalSessionContext, refreshClinicalUserProfile } from '../../clinical-access-runtime.mjs';
import {
  isBenignLanPushSkipCode,
  LAN_PROFILE_PUSH_FAILED_MSG,
} from '../../clinical-profile-lan-sync.mjs';
import { hasProgramAdminPrivileges } from '../../clinical-privileges.mjs';
import { isValidUsernameFormat, normalizeUsername } from '../../clinical-username.mjs';
import { syncRotationConfigButton } from '../clinical-rotation.mjs';
import { verifyAdminAccessCode } from '../../../../lib/admin-access-code.mjs';
import {
  toast,
  currentUserId,
  dbApi,
  promptAdminAccessCode,
  isAdminAccessGrantedThisSession,
  getVerifiedAdminAccessCode,
  rememberAdminAccessCode,
} from './shared.mjs';
import { claimClinicalUsernameIfNeeded } from './teams-roster-profile-claim.mjs';
import { persistProfileFromPanel } from './teams-roster-profile-persist.mjs';

function readProfileFormFields() {
  return {
    username: normalizeUsername(
      String(document.getElementById('clinical-profile-username')?.value || '')
    ),
    rank: String(document.getElementById('clinical-profile-rank')?.value || 'R1'),
    sala: String(document.getElementById('clinical-profile-sala')?.value || ''),
    clinicalName: String(document.getElementById('clinical-profile-name')?.value || '').trim(),
    adminCb: document.getElementById('clinical-profile-admin'),
  };
}

async function resolveProgramAdminChange(adminCb, wasProgramAdmin) {
  const wantsProgramAdmin = adminCb instanceof HTMLInputElement ? adminCb.checked : false;
  if (wantsProgramAdmin === wasProgramAdmin) {
    return { isProgramAdmin: undefined, adminAccessCode: null, wantsProgramAdmin, wasProgramAdmin };
  }
  if (!wantsProgramAdmin) {
    return { isProgramAdmin: false, adminAccessCode: null, wantsProgramAdmin, wasProgramAdmin };
  }
  if (!isAdminAccessGrantedThisSession()) {
    const code = await promptAdminAccessCode();
    if (!code || !verifyAdminAccessCode(code)) {
      if (adminCb instanceof HTMLInputElement) adminCb.checked = wasProgramAdmin;
      if (code != null) toast('Código incorrecto.', 'error');
      return null;
    }
    rememberAdminAccessCode(code);
  }
  return {
    isProgramAdmin: true,
    adminAccessCode: getVerifiedAdminAccessCode(),
    wantsProgramAdmin,
    wasProgramAdmin,
  };
}

async function toastProfileSaveResult({ msg, usernameWillChange, sala }) {
  const { flushClinicalProfileToLan } = await import('../../clinical-profile-lan-sync.mjs');
  const lanPush = await flushClinicalProfileToLan({ sala });
  if (!lanPush.ok && !isBenignLanPushSkipCode(lanPush.code)) {
    toast(LAN_PROFILE_PUSH_FAILED_MSG, 'warning');
  } else if (usernameWillChange && lanPush.ok) {
    toast(`${msg} @usuario publicado en la sala ⇄.`, 'success');
  } else {
    toast(msg, 'success');
  }
}

export async function handleProfileFormSubmit(ev) {
  ev.preventDefault();
  const fields = readProfileFormFields();
  const wasProgramAdmin = hasProgramAdminPrivileges(clinicalSessionContext.user);
  const adminChange = await resolveProgramAdminChange(fields.adminCb, wasProgramAdmin);
  if (!adminChange) return;

  if (!isValidUsernameFormat(fields.username)) {
    toast('Usuario inválido. Usa 3–32 caracteres en minúsculas: letras, números y _.', 'error');
    return;
  }
  if (!fields.clinicalName) {
    toast('Escribe tu nombre en guardia.', 'error');
    return;
  }
  if (!currentUserId() || !dbApi()) {
    toast('Sesión clínica no disponible. Desbloquea la base de datos.', 'error');
    return;
  }

  const claimResult = await claimClinicalUsernameIfNeeded(fields.username, fields.sala);
  if (claimResult === false) return;
  const usernameWillChange = claimResult === true;

  const ok = await persistProfileFromPanel({
    rank: fields.rank,
    sala: fields.sala,
    clinicalName: fields.clinicalName,
    isProgramAdmin: adminChange.isProgramAdmin,
    username: fields.username,
    adminAccessCode: adminChange.adminAccessCode,
  });
  if (!ok) return;

  await refreshClinicalUserProfile();
  const msg =
    adminChange.wantsProgramAdmin &&
    (adminChange.isProgramAdmin === true || adminChange.wasProgramAdmin)
      ? 'Perfil guardado. Privilegios de administración activos.'
      : 'Perfil guardado.';
  await toastProfileSaveResult({ msg, usernameWillChange, sala: fields.sala });
  syncRotationConfigButton();
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed', { detail: { force: true } }));
  void import('../lan-sync.mjs')
    .then((mod) => {
      if (typeof mod.pushClinicalOpsLanNow === 'function') void mod.pushClinicalOpsLanNow();
    })
    .catch(() => {});
  void import('../patients.mjs')
    .then((m) => m.renderPatientList())
    .catch(() => {});
}
