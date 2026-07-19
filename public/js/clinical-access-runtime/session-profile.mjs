import { persistClinicalUserBinding } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { electronApi } from './electron-api.mjs';
import { touchClinicalUserActivityRemote } from './session-activity.mjs';
import { migrateLocalPatientsClinicalSala } from './session-user.mjs';

/** Reload username, rank, sala, admin flag from DB into session. */
export async function refreshClinicalUserProfile() {
  const { ensureLanProfileGateDeviceReset } = await import('../clinical-settings.mjs');
  ensureLanProfileGateDeviceReset();
  const api = electronApi();
  const userId = String(clinicalSessionContext.user?.user_id || '');
  if (!api || !userId || typeof api.dbClinicalProfileGet !== 'function') return;
  try {
    const res = await api.dbClinicalProfileGet({ userId });
    const profile = res?.profile;
    if (!profile || !clinicalSessionContext.user) return;
    clinicalSessionContext.user.username = profile.username ?? clinicalSessionContext.user.username;
    clinicalSessionContext.user.rank = profile.rank ?? clinicalSessionContext.user.rank;
    clinicalSessionContext.user.sala = profile.sala ?? null;
    clinicalSessionContext.user.clinical_name = profile.clinical_name ?? null;
    clinicalSessionContext.user.is_program_admin =
      profile.is_program_admin === 1 ? 1 : 0;
    persistClinicalUserBinding({
      isProgramAdmin: clinicalSessionContext.user.is_program_admin === 1,
    });
    void touchClinicalUserActivityRemote(userId);
  } catch { /* profile IPC optional */ }
  migrateLocalPatientsClinicalSala();
}
