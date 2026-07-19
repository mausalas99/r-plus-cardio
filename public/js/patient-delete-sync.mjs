/** Borrado de paciente diferido (ventana para deshacer antes de sync LAN). */

const DEFAULT_FLUSH_MS = 30000;

/** @type {Map<string, { patient: object, timeoutId: ReturnType<typeof setTimeout>|null, onCommit: (p: object) => void }>} */
const pending = new Map();

/**
 * @param {string} patientId
 * @param {object} patient
 * @param {(p: object) => void} onCommit
 * @param {number} [delayMs]
 */
export function stagePatientDelete(patientId, patient, onCommit, delayMs) {
  const pid = String(patientId || '').trim();
  if (!pid || !patient || typeof onCommit !== 'function') return;
  cancelStagedPatientDelete(pid);
  const delay = delayMs != null ? delayMs : DEFAULT_FLUSH_MS;
  const entry = {
    patient: { ...patient },
    timeoutId: null,
    onCommit: onCommit,
  };
  entry.timeoutId = setTimeout(function () {
    flushOne(pid);
  }, delay);
  pending.set(pid, entry);
}

export function hasStagedDelete(patientId) {
  return pending.has(String(patientId || '').trim());
}

export function cancelStagedPatientDelete(patientId) {
  const pid = String(patientId || '').trim();
  const entry = pending.get(pid);
  if (!entry) return;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  pending.delete(pid);
}

function flushOne(patientId) {
  const pid = String(patientId || '').trim();
  const entry = pending.get(pid);
  if (!entry) return;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  pending.delete(pid);
  try {
    entry.onCommit(entry.patient);
  } catch (_e) { void _e; }
}

export function flushStagedPatientDeletes() {
  const ids = Array.from(pending.keys());
  ids.forEach(flushOne);
}

/** Cancela todos los borrados en espera (p. ej. antes de deshacer con recarga). */
export function cancelAllStagedPatientDeletes() {
  const ids = Array.from(pending.keys());
  ids.forEach(cancelStagedPatientDelete);
}
