import {
  PITCH_DEMO_PATIENT_ID,
  PITCH_DEMO_PATIENT_ID_LEGACY,
  readPitchSandboxBackup,
  restorePitchPatientsBackup,
} from './tour-pitch-sandbox.mjs';

/**
 * @param {import('./tour-pitch-seed-core.mjs').PitchDemoState} state
 * @returns {Array<object>|null}
 */
export function resolvePitchDemoRestorePatients(state) {
  const { patients, setPatients } = state;
  let restoredPatients = restorePitchPatientsBackup();
  if (!restoredPatients || !restoredPatients.length) {
    const sandbox = readPitchSandboxBackup();
    if (sandbox && Array.isArray(sandbox.patients) && sandbox.patients.length) {
      restoredPatients = sandbox.patients.slice();
    }
  }
  if (restoredPatients && restoredPatients.length) {
    setPatients(restoredPatients);
    return restoredPatients;
  }
  const filtered = patients.filter(function (p) {
    return (
      p &&
      p.id !== PITCH_DEMO_PATIENT_ID &&
      p.id !== PITCH_DEMO_PATIENT_ID_LEGACY &&
      !p.isDemo
    );
  });
  if (filtered.length) {
    setPatients(filtered);
    return filtered;
  }
  const sandbox = readPitchSandboxBackup();
  if (sandbox && Array.isArray(sandbox.patients) && sandbox.patients.length) {
    setPatients(sandbox.patients.slice());
    return sandbox.patients.slice();
  }
  setPatients(filtered);
  return filtered;
}
