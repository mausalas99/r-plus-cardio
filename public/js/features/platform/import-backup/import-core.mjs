/** Patient import conflict resolution and entry application. */
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  setPatients,
  setNotes,
  setIndicaciones,
  setLabHistory,
  setMedRecetaByPatient,
  setMedPharmProfileByPatient,
  saveState,
} from '../../../app-state.mjs';
import { mergePatientMonitoreoFromImported } from '../../estado-actual-data.mjs';
import { mergeCensoPatientFields } from '../../../patient-diagnosticos.mjs';
import { mergePatientRegistrationMeta } from '../../../patient-registration-meta.mjs';
import {
  renderPatientList,
  selectPatient,
  findPatientByRegistro,
  generatePatientId,
  ensureUniquePatientName,
} from '../../patients.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';

const rt = getPlatformRuntime();

function askConflictAction(label) {
  if (typeof window !== 'undefined' && window.__rpcPreferImportOverwrite === true) {
    return 'overwrite';
  }
  var answer = prompt('Conflicto detectado para "' + label + '". Escribe: O = sobrescribir, D = duplicar, C = cancelar.', 'O');
  var v = String(answer || '').trim().toUpperCase();
  if (v === 'O') return 'overwrite';
  if (v === 'D') return 'duplicate';
  return 'cancel';
}

function copyImportClinicalData(patientId, entry) {
  notes[patientId] = entry.note || {};
  indicaciones[patientId] = entry.indicaciones || {};
  labHistory[patientId] = Array.isArray(entry.labHistory) ? entry.labHistory : [];
  if (entry.medReceta) medRecetaByPatient[patientId] = entry.medReceta;
  else delete medRecetaByPatient[patientId];
  if (entry.medPharmProfile) medPharmProfileByPatient[patientId] = entry.medPharmProfile;
  else delete medPharmProfileByPatient[patientId];
}

/** IC / HC fields stored on the patient object (Cardionotas + Sala). */
function mergePatientClinicalBlobFromImported(target, source) {
  if (!target || !source || typeof source !== 'object') return;
  var keys = [
    'cardio',
    'historiaClinica',
    'eventualidades',
    'icLabs',
    'fenotipo',
    'etiologia',
    'residente',
    'fimiFecha',
    'diagnosticos',
    'ekg',
  ];
  keys.forEach(function (key) {
    if (!(key in source) || source[key] == null) return;
    try {
      target[key] = JSON.parse(JSON.stringify(source[key]));
    } catch (_e) {
      target[key] = source[key];
    }
  });
}

function applyImportOverwrite(existing, entry) {
  existing.nombre = entry.patient.nombre || existing.nombre;
  existing.edad = entry.patient.edad || existing.edad;
  existing.sexo = entry.patient.sexo || existing.sexo;
  existing.area = entry.patient.area || existing.area;
  existing.servicio = entry.patient.servicio || existing.servicio;
  existing.cuarto = entry.patient.cuarto || existing.cuarto;
  existing.cama = entry.patient.cama || existing.cama;
  if (entry.patient.viaAcceso) existing.viaAcceso = entry.patient.viaAcceso;
  mergeCensoPatientFields(existing, entry.patient);
  mergePatientRegistrationMeta(existing, entry.patient);
  existing.registro = entry.patient.registro || existing.registro;
  mergePatientMonitoreoFromImported(existing, entry.patient);
  mergePatientClinicalBlobFromImported(existing, entry.patient);
  copyImportClinicalData(existing.id, entry);
  return existing.id;
}

function applyImportDuplicate(entry) {
  var newId = generatePatientId();
  var newPatient = {
    id: newId,
    nombre: ensureUniquePatientName(entry.patient.nombre || 'PACIENTE SIN NOMBRE'),
    area: entry.patient.area || '',
    servicio: entry.patient.servicio || '',
    cuarto: entry.patient.cuarto || '',
    cama: entry.patient.cama || '',
    edad: entry.patient.edad || '',
    sexo: entry.patient.sexo || 'F',
    registro: entry.patient.registro || '',
    fromLab: !!entry.patient.fromLab,
  };
  mergePatientMonitoreoFromImported(newPatient, entry.patient);
  mergeCensoPatientFields(newPatient, entry.patient);
  mergePatientRegistrationMeta(newPatient, entry.patient);
  mergePatientClinicalBlobFromImported(newPatient, entry.patient);
  patients.unshift(newPatient);
  copyImportClinicalData(newId, entry);
  return newId;
}

function applyImportEntry(entry, action, existing) {
  if (action === 'overwrite' && existing) return applyImportOverwrite(existing, entry);
  return applyImportDuplicate(entry);
}

function importEntriesWithConflicts(entries, actionLabel) {
  var out = { imported: 0, overwritten: 0, duplicated: 0, cancelled: false };
  var patientsBefore = JSON.parse(JSON.stringify(patients));
  var notesBefore = JSON.parse(JSON.stringify(notes));
  var indicacionesBefore = JSON.parse(JSON.stringify(indicaciones));
  var labHistoryBefore = JSON.parse(JSON.stringify(labHistory));
  var medRecetaBefore = JSON.parse(JSON.stringify(medRecetaByPatient));
  var medPharmBefore = JSON.parse(JSON.stringify(medPharmProfileByPatient));
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    if (!entry || !entry.patient) continue;
    var reg = String(entry.patient.registro || '').trim();
    var exists = findPatientByRegistro(reg);
    if (exists) {
      var action = askConflictAction(entry.patient.nombre || reg || 'sin nombre');
      if (action === 'cancel') {
        out.cancelled = true;
        break;
      }
      applyImportEntry(entry, action, exists);
      if (action === 'overwrite') out.overwritten += 1;
      if (action === 'duplicate') out.duplicated += 1;
    } else {
      applyImportEntry(entry, 'duplicate', null);
      out.imported += 1;
    }
  }
  if (out.cancelled) {
    setPatients(patientsBefore);
    setNotes(notesBefore);
    setIndicaciones(indicacionesBefore);
    setLabHistory(labHistoryBefore);
    setMedRecetaByPatient(medRecetaBefore);
    setMedPharmProfileByPatient(medPharmBefore);
  } else {
    saveState();
    renderPatientList();
  }
  addAuditEntry(actionLabel, out.cancelled ? 'cancelled' : 'ok', out.imported + out.overwritten + out.duplicated,
    'new:' + out.imported + ',overwrite:' + out.overwritten + ',duplicate:' + out.duplicated);
  return out;
}

function patientExportPayloadToEntry(payload) {
  return {
    patient: payload.patient,
    note: payload.note || {},
    indicaciones: payload.indicaciones || {},
    labHistory: Array.isArray(payload.labHistory) ? payload.labHistory : [],
    medReceta: payload.medReceta || null,
    medPharmProfile: payload.medPharmProfile || null,
  };
}

function applySinglePatientExportPayload(payload) {
  var imported = payload.patient || {};
  var registro = String(imported.registro || '').trim();
  var existsByRegistro = findPatientByRegistro(registro);
  var entry = patientExportPayloadToEntry(payload);

  if (existsByRegistro) {
    applyImportEntry(entry, 'overwrite', existsByRegistro);
    rt.setActiveId(existsByRegistro.id);
    return registro;
  }

  var newId = applyImportEntry(entry, 'duplicate', null);
  rt.setActiveId(newId);
  return registro;
}

function importPatientExportPayloads(payloads, sourceLabel) {
  if (!payloads || !payloads.length) {
    rt.showToast('No hay pacientes para importar.', 'error');
    return false;
  }

  if (payloads.length > 1) {
    var names = payloads
      .map(function (p) {
        return (p.patient && p.patient.nombre) || 'Sin nombre';
      })
      .join(', ');
    if (
      !confirm(
        'Se importarán ' +
          payloads.length +
          ' pacientes: ' +
          names +
          '. Si ya existen por registro, se preguntará qué hacer con cada uno. ¿Continuar?'
      )
    ) {
      return false;
    }
    if (typeof pushUndoSnapshot === 'function') {
      rt.pushUndoSnapshot('Importar pacientes demo (' + payloads.length + ')');
    }
    var entries = payloads.map(patientExportPayloadToEntry);
    var res = importEntriesWithConflicts(entries, 'backup-patient-import');
    if (res.cancelled) {
      rt.showToast('Importación cancelada', 'error');
      return false;
    }
    rt.showToast(
      'Pacientes importados: ' + (res.imported + res.overwritten + res.duplicated),
      'success'
    );
    if (rt.getActiveId()) selectPatient(rt.getActiveId());
    return true;
  }

  var payload = payloads[0];
  var imported = payload.patient || {};
  var registro = String(imported.registro || '').trim();
  var existsByRegistro = findPatientByRegistro(registro);
  var msg = existsByRegistro
    ? ('Ya existe un paciente con el registro ' + registro + '. Esto sobrescribirá su nota, indicaciones y labs. ¿Continuar?')
    : ('Se importará el paciente "' + (imported.nombre || 'Sin nombre') + '". ¿Continuar?');
  if (!confirm(msg)) return false;

  applySinglePatientExportPayload(payload);
  saveState();
  renderPatientList();
  if (rt.getActiveId()) selectPatient(rt.getActiveId());
  addAuditEntry('backup-patient-import', 'ok', 1, (sourceLabel || '') + registro);
  rt.showToast('Paciente importado correctamente.', 'success');
  return true;
}

export {
  askConflictAction,
  applyImportEntry,
  importEntriesWithConflicts,
  patientExportPayloadToEntry,
  applySinglePatientExportPayload,
  importPatientExportPayloads,
};
