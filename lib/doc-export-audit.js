'use strict';

function safeRegistro(patient) {
  const r = patient && patient.registro;
  if (r) return String(r).slice(0, 64);
  return null;
}

function logDocExport({ type, patient, status, bytes, error }) {
  const payload = {
    type,
    registro: safeRegistro(patient),
    status,
    bytes: bytes ?? null,
    error: error ? String(error).slice(0, 200) : null,
  };
  const line = JSON.stringify(payload);
  if (status >= 400) console.error('[doc-export]', line);
  else console.log('[doc-export]', line);
}

module.exports = { logDocExport };
