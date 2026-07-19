import { patients, saveState } from '../app-state.mjs';
import { migratePatientsClinicalSala } from '../clinico-access.mjs';
import { readRpcSettings } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';

/** @returns {number} patients tagged with sala */
export function migrateLocalPatientsClinicalSala() {
  const user = clinicalSessionContext.user;
  const settings = readRpcSettings();
  const sala =
    String(user?.sala || '').trim() || String(settings.clinicalSala || '').trim();
  if (!sala) return 0;

  const actor = user ? { ...user, sala } : { sala };
  const migrated = migratePatientsClinicalSala(patients, actor);
  if (migrated > 0) {
    void saveState({ immediate: true });
    if (typeof document !== 'undefined') {
      void import('../features/patients.mjs')
        .then((mod) => mod.renderPatientList({ silent: true }))
        .catch(() => {});
    }
  }
  return migrated;
}

export function getClinicalUser() {
  return clinicalSessionContext.user;
}

export function unlockClinicalSessionOverlay() {
  const overlay = document.getElementById('rpc-clinical-session-lock');
  if (overlay) overlay.classList.remove('active-lock-view-overlay');
}
