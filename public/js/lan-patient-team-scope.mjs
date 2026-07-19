import {
  shouldEnforceTeamPatientMirror,
  shouldUseElevatedPatientCensus,
} from './clinical-privileges.mjs';
import { isPatientReadableInClinicalScope } from './clinico-access.mjs';
import { patientForScopeEvaluate } from './features/patients-clinical-filter.mjs';
import { isPatientVisibleOnMobileTeamMirror } from './mobile-team-patient-scope.mjs';

/**
 * Whether a patient chart should sync over LAN for the current clinical user.
 * @param {object|null|undefined} user
 * @param {object|null|undefined} patient
 * @param {object|null|undefined} activeGuardia
 * @param {object|null|undefined} context
 */
export function isPatientInLanTeamSyncScope(user, patient, activeGuardia = null, context = null) {
  if (!user?.user_id || !patient?.id) return false;
  if (shouldEnforceTeamPatientMirror()) {
    return isPatientVisibleOnMobileTeamMirror(user, patient, context, activeGuardia);
  }
  if (shouldUseElevatedPatientCensus(user)) return true;
  return isPatientReadableInClinicalScope(user, patient, activeGuardia, context);
}

/**
 * @param {object[]} entries
 * @param {object|null|undefined} user
 * @param {object|null|undefined} context
 * @param {Map<string, object>|null|undefined} guardiasMap
 */
export function filterPatientEntriesForLanTeamScope(entries, user, context, guardiasMap) {
  if (!user?.user_id) return [];
  return (entries || []).filter((entry) => {
    const patient = entry?.patient;
    if (!patient?.id) return false;
    const mapped = patientForScopeEvaluate(patient);
    const activeGuardia =
      guardiasMap && typeof guardiasMap.get === 'function'
        ? guardiasMap.get(String(patient.id)) || null
        : null;
    return isPatientInLanTeamSyncScope(user, mapped, activeGuardia, context);
  });
}
