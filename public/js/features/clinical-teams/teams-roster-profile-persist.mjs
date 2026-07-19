/** Mi rotación — persist clinical profile from panel form. */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import {
  isClinicalLocalOnlyMode,
  persistClinicalUserBinding,
  readRpcSettings,
} from '../../clinical-settings.mjs';
import { dbApi, toast, currentUserId } from './shared.mjs';

function syncProgramAdminFlag(isProgramAdmin, res) {
  if (!clinicalSessionContext.user) return;
  if (isProgramAdmin !== undefined) {
    clinicalSessionContext.user.is_program_admin = isProgramAdmin ? 1 : 0;
    return;
  }
  if (res.profile?.is_program_admin != null) {
    clinicalSessionContext.user.is_program_admin = res.profile.is_program_admin === 1 ? 1 : 0;
  }
}

function applyProfileUpsertToSession(res, { rank, sala, clinicalName, isProgramAdmin }) {
  if (!clinicalSessionContext.user) return;
  const savedRank = String(res.profile?.rank || rank || '');
  clinicalSessionContext.user.rank =
    savedRank === 'Admin' ? 'R1' : savedRank || clinicalSessionContext.user.rank;
  if (sala != null) clinicalSessionContext.user.sala = sala;
  if (clinicalName) clinicalSessionContext.user.clinical_name = clinicalName;
  if (res.profile?.username) clinicalSessionContext.user.username = res.profile.username;
  syncProgramAdminFlag(isProgramAdmin, res);
  if (String(res.profile?.rank || '') === 'Admin') {
    clinicalSessionContext.user.is_program_admin = 1;
  }
}

function buildProfileBinding({ userId, username, clinicalName, rank, sala, isProgramAdmin }) {
  const settings = readRpcSettings();
  const binding = {
    userId,
    username: username || settings.clinicalUsername,
    displayName: clinicalName || settings.clinicalDisplayName,
    rank: rank || settings.clinicalRank,
    sala: sala ?? settings.clinicalSala,
    isProgramAdmin,
    registered: true,
  };
  if (!isClinicalLocalOnlyMode(settings)) {
    binding.lanProfileGateComplete = true;
  }
  return binding;
}

export async function persistProfileFromPanel(fields) {
  const userId = currentUserId();
  const api = dbApi();
  if (!userId || !api || typeof api.dbClinicalProfileUpsert !== 'function') {
    toast('Base de datos no disponible.', 'error');
    return false;
  }
  return submitProfileUpsert(api, userId, fields);
}

async function submitProfileUpsert(api, userId, fields) {
  const res = await api.dbClinicalProfileUpsert({
    userId,
    clinicalName: fields.clinicalName || clinicalSessionContext.user?.clinical_name || '',
    rank: fields.rank || effectiveClinicalRank(clinicalSessionContext.user),
    sala: fields.sala ?? clinicalSessionContext.user?.sala ?? null,
    isProgramAdmin: fields.isProgramAdmin,
    adminAccessCode: fields.adminAccessCode ?? undefined,
  });
  if (!res || res.ok === false) {
    toast(res?.error || 'No se guardó el perfil.', 'error');
    return false;
  }
  persistClinicalUserBinding(buildProfileBinding({ userId, ...fields }));
  applyProfileUpsertToSession(res, fields);
  return true;
}
