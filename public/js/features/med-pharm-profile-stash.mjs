import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import { profileHasMonthData } from '../med-pharm-profile-core.mjs';
import { getProfile, isDemoPatientId } from './med-pharm-profile-state.mjs';

/** Guarda el pegado SOME del modal antes de cambiar de paciente. */
export function stashMedPharmPasteForPatient(patientId) {
  if (!patientId || isDemoPatientId(patientId)) return;
  var ta = document.getElementById('med-pharm-paste');
  if (!ta) return;
  var raw = (ta.value || '').trim();
  var profile = getProfile(patientId);
  if (!raw) {
    if (profile && profile.draftPaste) {
      delete profile.draftPaste;
      if (!profileHasMonthData(profile)) delete medPharmProfileByPatient[patientId];
      else saveState();
    }
    return;
  }
  if (!profile) profile = { months: {} };
  profile.draftPaste = raw;
  medPharmProfileByPatient[patientId] = profile;
  saveState();
}
