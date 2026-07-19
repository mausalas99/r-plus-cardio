/** Demo patient id check (shared across LAN, meds, pharm profile). */

/** @param {unknown} patientId */
export function isDemoPatientId(patientId) {
  return String(patientId || '').indexOf('demo-') === 0;
}
