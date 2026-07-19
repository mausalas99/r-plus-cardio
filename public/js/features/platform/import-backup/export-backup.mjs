/** Full, patient, and range backup export actions. */
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  saveState,
} from '../../../app-state.mjs';
import { isTourDemoPatientId } from '../../../tour-demo-patient.mjs';
import { formatDateSlug, downloadJsonPayload } from '../shared.mjs';
import { addAuditEntry } from '../audit.mjs';
import { safeExportSlug } from '../offline.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { buildFullBackupPayload } from './backup-payload.mjs';
import { parseDateRangePrompt, patientInDateRange } from './date-utils.mjs';
import { buildPatientEntry } from '../../patients.mjs';

const rt = getPlatformRuntime();

async function exportDataBackup() {
  await saveState({ immediate: true });
  var payload = buildFullBackupPayload();
  var n = (payload.data.patients || []).length;
  downloadJsonPayload(payload, 'R-plus-respaldo-' + formatDateSlug(new Date()) + '.json');
  addAuditEntry('backup-full-export', 'ok', n, '');
  if (n === 0) {
    rt.showToast(
      'Respaldo descargado sin pacientes. Si esperabas datos, revisa la lista y exporta de nuevo.',
      'error'
    );
  } else {
    rt.showToast('Respaldo descargado (' + n + ' paciente' + (n === 1 ? '' : 's') + ')', 'success');
  }
}

function exportActivePatientBackup() {
  var aid = rt.getActiveId();
  if (!aid) {
    rt.showToast('Selecciona un paciente en la lista.', 'error');
    return;
  }
  if (isTourDemoPatientId(aid, patients)) {
    rt.showToast('El paciente de demostración no se exporta.', 'error');
    return;
  }
  var patient = patients.find(function(p) { return p.id === aid; });
  if (!patient) return;
  saveState();
  var payload = {
    format: 'r-plus-patient-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: window.__RPC_APP_VERSION__ || null,
    patient: patient,
    note: notes[aid] || null,
    indicaciones: indicaciones[aid] || null,
    labHistory: labHistory[aid] || [],
    medReceta: medRecetaByPatient[aid] || null,
    medPharmProfile: medPharmProfileByPatient[aid] || null,
  };
  downloadJsonPayload(payload, 'R-plus-paciente-' + safeExportSlug(patient.nombre) + '-' + formatDateSlug(new Date()) + '.json');
  addAuditEntry('backup-patient-export', 'ok', 1, String(patient.registro || ''));
  rt.showToast('Paciente exportado', 'success');
}

function exportRangeBackupPrompt() {
  var raw = prompt('Rango de fechas (dd/mm/yyyy - dd/mm/yyyy):', '');
  if (raw == null) return;
  var range = parseDateRangePrompt(raw);
  if (!range) {
    rt.showToast('Rango inválido. Usa dd/mm/yyyy - dd/mm/yyyy', 'error');
    return;
  }
  var entries = [];
  patients.forEach(function(p) {
    var entry = buildPatientEntry(p.id);
    if (entry && patientInDateRange(entry, range)) entries.push(entry);
  });
  if (!entries.length) {
    rt.showToast('No hay pacientes en ese rango.', 'error');
    return;
  }
  var payload = {
    format: 'r-plus-range-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    from: range.fromLabel,
    to: range.toLabel,
    entries: entries
  };
  downloadJsonPayload(payload, 'R-plus-rango-' + formatDateSlug(new Date()) + '.json');
  addAuditEntry('range-export', 'ok', entries.length, payload.from + ' a ' + payload.to);
  rt.showToast('Rango exportado', 'success');
}

export { exportDataBackup, exportActivePatientBackup, exportRangeBackupPrompt };
