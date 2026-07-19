import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  listadoProblemas,
  vpoByPatient,
  saveState,
} from '../app-state.mjs';
import { storage } from '../storage.js';
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { stampPatientClinicalSala } from '../clinico-access.mjs';
import { stampPatientRegistrationMeta } from '../patient-registration-meta.mjs';
import { clearPatientDeleteTombstoneForAdmit } from './lan-sync.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import { emptyCardio } from '../../../lib/cardio/patient-cardio.mjs';
import {
  adoptTourPatientOnCommit,
  DEMO_PATIENT_ID,
  DEMO_REGISTRO,
  findTourDemoPatientByRegistro,
  shouldSelectTourPrimaryAfterLabCommit,
  shouldTourStayOnLabAfterLabCommit,
} from '../tour-demo-patient.mjs';
import {
  assignPatientToTeamClinical,
  readPatientRegistrationTeamId,
} from '../patient-team-assign-ui.mjs';
import { readPatientRegistrationSala } from '../patient-sala-ui.mjs';
import { closePatientDatosModal } from '../patient-datos-modal.mjs';
import { resumeLabBulkPreviewModalIfSuspended } from './lab-bulk-preview-modal.mjs';
import { ensureMonitoreo } from './estado-actual-data.mjs';
import { closeModalAnimated } from '../ui-motion.mjs';
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';


var pendingAddPatientSavedCallback = null;
var pendingAddPatientFromBulkPreview = false;

export function setPendingAddPatientSavedCallback(cb) {
  pendingAddPatientSavedCallback = cb;
}

export function setPendingAddPatientFromBulkPreview(v) {
  pendingAddPatientFromBulkPreview = !!v;
}

export function clearPendingAddPatientCallbacks() {
  pendingAddPatientSavedCallback = null;
  pendingAddPatientFromBulkPreview = false;
}

export function getPendingAddPatientFromBulkPreview() {
  return pendingAddPatientFromBulkPreview;
}

function dismissAddPatientModal() {
  clearPendingAddPatientCallbacks();
  closeModalAnimated(document.getElementById('modal'));
}

async function assignTeamFromRegistrationModal(patientId) {
  var teamId = readPatientRegistrationTeamId();
  if (!teamId) return { ok: false, error: 'no_team' };
  var res = await assignPatientToTeamClinical(patientId, teamId);
  if (!res.ok) {
    rt.showToast('Paciente guardado, pero no se pudo asignar al equipo', 'warn');
  }
  return res;
}

/** Tras alta desde vista previa multipaciente: quedarse en Lab con la preview abierta. */
function completeBulkPreviewPatientRegistration(patientId) {
  patientsBridge.selectPatient(patientId, { bypassIncomingBlock: true });
  closePatientDatosModal();
  if (rt.getActiveAppTab() !== 'lab') {
    rt.switchAppTab('lab');
  }
  resumeLabBulkPreviewModalIfSuspended();
  rt.showToast('Paciente registrado. Pulsa Procesar todo en la vista previa.', 'success');
}

function patientAdmissionTimestamp() {
  var today = new Date();
  return {
    fecha:
      String(today.getDate()).padStart(2, '0') +
      '/' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '/' +
      today.getFullYear(),
    hora:
      String(today.getHours()).padStart(2, '0') + ':' + String(today.getMinutes()).padStart(2, '0'),
  };
}

function buildPatientDraft(nombre, registro, edad, sexo, area, servicio, cuarto, cama, isFromLab) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    nombre: nombre,
    registro: registro,
    edad: edad,
    sexo: sexo,
    area: area,
    servicio: servicio,
    cuarto: cuarto,
    cama: cama,
    fromLab: !!isFromLab,
    cardio: emptyCardio(),
  };
}

function initPatientNotesAndIndicaciones(patientId, fecha, hora) {
  notes[patientId] = {
    fecha: fecha,
    hora: hora,
    interrogatorio: '',
    evolucion: '',
    estudios: '',
    diagnosticos: [''],
    tratamiento: [''],
    ta: '',
    fr: '',
    fc: '',
    temp: '',
    peso: '',
    medico: '',
    profesor: '',
  };
  indicaciones[patientId] = {
    fecha: fecha,
    hora: hora,
    medicos: '',
    dieta: '',
    cuidados: '',
    estudios: '',
    medicamentos: '',
    interconsultas: '',
    otros: [],
  };
}

function handleDuplicateDemoPatient(patient) {
  if (!patient.isDemo) return false;
  var existingDemo = patients.find(function (x) {
    return x && x.id === patient.id;
  });
  if (!existingDemo) return false;
  var onSavedDup = pendingAddPatientSavedCallback;
  pendingAddPatientSavedCallback = null;
  dismissAddPatientModal();
  rt.showToast(existingDemo.nombre + ' ya está en el censo', 'info');
  if (onSavedDup) {
    try {
      onSavedDup(existingDemo);
    } catch (e) {
      console.error(e);
    }
  }
  return true;
}

function resolveTourActivePatientId(patientId) {
  if (!shouldSelectTourPrimaryAfterLabCommit(patientId, patients)) return patientId;
  var perez = findTourDemoPatientByRegistro(patients, DEMO_REGISTRO);
  return perez ? perez.id : patientId;
}

async function finalizeMobilePatientCommit(patient, fromBulkPreview) {
  var assignRes = await assignTeamFromRegistrationModal(patient.id);
  if (!assignRes?.ok) {
    var dropIdx = patients.findIndex(function (p) {
      return p && String(p.id) === String(patient.id);
    });
    if (dropIdx >= 0) patients.splice(dropIdx, 1);
    rt.showToast(
      'En R+ Móvil solo ves pacientes asignados a tu equipo (p. ej. Dra. Melissa). Regístralos en la Mac o asígnalos allí.',
      'warn'
    );
    return;
  }
  rt.showToast('Paciente agregado', 'success');
  try {
    var access = await import('../clinical-access-runtime.mjs');
    if (typeof access.finalizeMobileLanPatientCensus === 'function') {
      await access.finalizeMobileLanPatientCensus();
    }
  } catch (_e) { void _e; }
  var activeId = resolveTourActivePatientId(patient.id);
  if (fromBulkPreview) completeBulkPreviewPatientRegistration(activeId);
  else patientsBridge.selectPatient(activeId, { bypassIncomingBlock: true });
}

async function finalizeDesktopPatientCommit(patient, fromBulkPreview) {
  await assignTeamFromRegistrationModal(patient.id);
  patientsBridge.renderPatientList();
  var activeId = resolveTourActivePatientId(patient.id);
  if (fromBulkPreview) completeBulkPreviewPatientRegistration(activeId);
  else {
    patientsBridge.selectPatient(activeId, { bypassIncomingBlock: true });
    rt.showToast('Paciente agregado', 'success');
  }
}

function resolvePendingLabAfterCommit(isFromLab, fromBulkPreview) {
  var stayOnLabForTour = isFromLab && shouldTourStayOnLabAfterLabCommit();
  if (isFromLab && !stayOnLabForTour && !fromBulkPreview) {
    var pendingLab = rt.consumeActiveLab ? rt.consumeActiveLab() : null;
    if (rt.clearLabOutputUi) rt.clearLabOutputUi();
    rt.switchAppTab('nota');
    return pendingLab;
  }
  if (isFromLab && stayOnLabForTour) return null;
  return null;
}

export function commitPatientFromModal(nombre, registro, edad, sexo, area, servicio, cuarto, cama, isFromLab) {
  var ts = patientAdmissionTimestamp();
  var patient = buildPatientDraft(nombre, registro, edad, sexo, area, servicio, cuarto, cama, isFromLab);
  var adoptResult = adoptTourPatientOnCommit(patient, registro);
  patient = adoptResult.patient;
  if (handleDuplicateDemoPatient(patient)) return;
  var registrationTeamId = readPatientRegistrationTeamId();
  stampPatientClinicalSala(patient, clinicalSessionContext.user, {
    teamId: registrationTeamId,
    teams: clinicalSessionContext.teams || [],
  });
  const registrationSala = readPatientRegistrationSala();
  if (registrationSala) patient.sala = registrationSala;
  stampPatientRegistrationMeta(patient, clinicalSessionContext.user);
  clearPatientDeleteTombstoneForAdmit(patient.id, patient.registro);
  initPatientNotesAndIndicaciones(patient.id, ts.fecha, ts.hora);
  rt.applyDefaultsToNewPatient(patient.id);
  rt.applyDefaultsToNewIndicaciones(patient.id);
  patients.push(patient);
  saveState();
  var onSaved = pendingAddPatientSavedCallback;
  pendingAddPatientSavedCallback = null;
  var fromBulkPreview = pendingAddPatientFromBulkPreview;
  pendingAddPatientFromBulkPreview = false;
  dismissAddPatientModal();
  var pendingLab = resolvePendingLabAfterCommit(isFromLab, fromBulkPreview);
  if (isMobileWeb()) void finalizeMobilePatientCommit(patient, fromBulkPreview);
  else void finalizeDesktopPatientCommit(patient, fromBulkPreview);
  if (adoptResult.afterCommit) {
    try {
      adoptResult.afterCommit(patient);
    } catch (e) {
      console.error(e);
    }
  }
  if (onSaved) {
    try {
      onSaved(patient);
    } catch (e) {
      console.error(e);
    }
  }
  if (pendingLab) {
    rt.restoreActiveLab(pendingLab);
    rt.enviarLabsANota();
    rt.consumeActiveLab();
  }
}

export function generatePatientId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function buildPatientEntry(patientId) {
  var patient = patients.find(function (p) {
    return p.id === patientId;
  });
  if (!patient || patient.id === DEMO_PATIENT_ID) return null;
  var patientSnap = { ...patient };
  ensureMonitoreo(patientSnap);
  if (patient.monitoreo != null && typeof patient.monitoreo === 'object') {
    patientSnap.monitoreo = structuredClone(patient.monitoreo);
  }
  if (patientSnap.historiaClinica != null && typeof patientSnap.historiaClinica === 'object') {
    const hc = structuredClone(patientSnap.historiaClinica);
    delete hc.pendingLanSync;
    delete hc.lanSyncPending;
    patientSnap.historiaClinica = hc;
  }
  return {
    patient: patientSnap,
    note: notes[patientId] || {},
    indicaciones: indicaciones[patientId] || {},
    labHistory: Array.isArray(labHistory[patientId]) ? labHistory[patientId] : [],
    medReceta: medRecetaByPatient[patientId] || null,
    medPharmProfile: medPharmProfileByPatient[patientId] || null,
    vpo: vpoByPatient[patientId] || null,
    listadoProblemas: listadoProblemas[patientId] || null,
    todos: storage.getTodos(patientId),
  };
}

export function findPatientByRegistro(registro) {
  var r = String(registro || '').trim();
  if (!r) return null;
  return (
    patients.find(function (p) {
      return String(p.registro || '').trim() === r;
    }) || null
  );
}

export function ensureUniquePatientName(base) {
  var desired = String(base || '').trim() || 'PACIENTE SIN NOMBRE';
  var normalized = desired.toUpperCase();
  var has = patients.some(function (p) {
    return String(p.nombre || '').trim().toUpperCase() === normalized;
  });
  if (!has) return desired;
  var i = 2;
  while (i < 9999) {
    var candidate = desired + ' (' + i + ')';
    var exists = patients.some(function (p) {
      return String(p.nombre || '').trim().toUpperCase() === candidate.toUpperCase();
    });
    if (!exists) return candidate;
    i += 1;
  }
  return desired + ' (COPIA)';
}
