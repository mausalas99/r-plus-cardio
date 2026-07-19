/**
 * LAN patient entry merge/apply (census rows from sync-bundle).
 */
import { storage } from '../../storage.js';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  medPharmProfileByPatient,
  vpoByPatient,
  listadoProblemas,
  saveState,
} from '../../app-state.mjs';
import {
  mergeEventualidades,
  mergeHistoriaClinica,
  mergeLabHistorySets,
} from '../../lan-patient-merge.mjs';
import { mergePatientMonitoreoFromImported } from '../estado-actual-data.mjs';
import { mergeCensoPatientFields } from '../../patient-diagnosticos.mjs';
import { mergePatientRegistrationMeta } from '../../patient-registration-meta.mjs';
import { mergeTodoListsById } from '../../livesync-patient-ids.mjs';
import { clinicalSessionContext } from '../../clinical-session-context.mjs';
import {
  getClinicalScopeContextForEvaluate,
  isClinicalScopeReadyForLanPatientApply,
} from '../../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror } from '../../clinical-privileges.mjs';
import { filterPatientEntriesForLanTeamScope } from '../../lan-patient-team-scope.mjs';

/** @type {{
 *   runtime?: object,
 *   renderPatientListLanSilent?: () => void,
 * }} */
let entryDeps = {};

export function configureLanPatientEntries(deps) {
  if (deps && typeof deps === 'object') Object.assign(entryDeps, deps);
}

function lanRuntime() {
  return entryDeps.runtime || {};
}

export function lanJsonEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function assignLanScalarIfChanged(target, key, incoming, fallback) {
  var next = incoming != null && incoming !== '' ? incoming : fallback;
  if (String(target[key] || '') === String(next || '')) return false;
  target[key] = next;
  return true;
}

function filterIncomingPatientEntriesForScope(entries) {
  if (!isClinicalScopeReadyForLanPatientApply()) return [];
  var user = clinicalSessionContext.user;
  if (!user?.user_id) return [];
  return filterPatientEntriesForLanTeamScope(
    entries || [],
    user,
    getClinicalScopeContextForEvaluate(),
    clinicalSessionContext.guardiasMap
  );
}

export function touchPatientLanUpdatedAt(patientId) {
  var p = patients.find(function (x) {
    return x && x.id === patientId;
  });
  if (p) p.lanUpdatedAt = new Date().toISOString();
}

function saveEntryTodosOnLocalPatient(localPatientId, entry) {
  if (!localPatientId || !entry) return false;
  var incoming = Array.isArray(entry.todos) ? entry.todos : [];
  if (!incoming.length) return false;
  var merged = mergeTodoListsById(storage.getTodos(localPatientId), incoming);
  if (lanJsonEqual(storage.getTodos(localPatientId), merged)) return false;
  storage.saveTodos(localPatientId, merged);
  return true;
}

function applyLanPatientScalars(existing, p) {
  var changed = false;
  var scalarKeys = [
    'nombre', 'edad', 'sexo', 'area', 'servicio', 'cuarto', 'cama', 'peso', 'talla', 'viaAcceso', 'registro',
  ];
  for (var sk = 0; sk < scalarKeys.length; sk += 1) {
    var key = scalarKeys[sk];
    if (assignLanScalarIfChanged(existing, key, p[key], existing[key])) changed = true;
  }
  var censoBefore = JSON.stringify(existing);
  mergeCensoPatientFields(existing, p);
  if (JSON.stringify(existing) !== censoBefore) changed = true;
  const regBefore = existing.registeredByUserId;
  mergePatientRegistrationMeta(existing, p);
  if (existing.registeredByUserId !== regBefore) changed = true;
  if (p.fromLab && !existing.fromLab) {
    existing.fromLab = true;
    changed = true;
  }
  return changed;
}

function applyLanPatientCharts(existing, entry) {
  var changed = false;
  var nextNote = entry.note || {};
  if (!lanJsonEqual(notes[existing.id], nextNote)) {
    notes[existing.id] = nextNote;
    changed = true;
  }
  var nextInd = entry.indicaciones || {};
  if (!lanJsonEqual(indicaciones[existing.id], nextInd)) {
    indicaciones[existing.id] = nextInd;
    changed = true;
  }
  var nextLabs = Array.isArray(entry.labHistory) ? entry.labHistory : [];
  var mergedLabs = mergeLabHistorySets(labHistory[existing.id] || [], nextLabs);
  if (!lanJsonEqual(labHistory[existing.id], mergedLabs)) {
    labHistory[existing.id] = mergedLabs;
    changed = true;
  }
  return applyLanPatientMedArtifacts(existing, entry) || changed;
}

function applyLanPatientNested(existing, entry, p) {
  var changed = false;
  if (p.eventualidades && typeof p.eventualidades === 'object') {
    var mergedEv = mergeEventualidades(existing.eventualidades, p.eventualidades) || p.eventualidades;
    if (!lanJsonEqual(existing.eventualidades, mergedEv)) {
      existing.eventualidades = mergedEv;
      changed = true;
    }
  }
  if (p.historiaClinica && typeof p.historiaClinica === 'object') {
    var mergedHc = mergeHistoriaClinica(existing.historiaClinica, p.historiaClinica);
    if (mergedHc && !lanJsonEqual(existing.historiaClinica, mergedHc)) {
      existing.historiaClinica = mergedHc;
      changed = true;
    }
  }
  if (applyLanPatientCharts(existing, entry)) changed = true;
  var monBefore = JSON.stringify(existing);
  mergePatientMonitoreoFromImported(existing, p);
  if (JSON.stringify(existing) !== monBefore) changed = true;
  return changed;
}

function applyLanPatientMedArtifacts(existing, entry) {
  var changed = false;
  changed = applyLanMedRecetaField(existing, entry) || changed;
  changed = applyLanMedPharmField(existing, entry) || changed;
  changed = applyLanVpoField(existing, entry) || changed;
  if (entry.listadoProblemas) {
    if (!lanJsonEqual(listadoProblemas[existing.id], entry.listadoProblemas)) {
      listadoProblemas[existing.id] = entry.listadoProblemas;
      changed = true;
    }
  }
  return changed;
}

function applyLanMedRecetaField(existing, entry) {
  if (!Object.prototype.hasOwnProperty.call(entry, 'medReceta')) return false;
  if (entry.medReceta) {
    if (lanJsonEqual(medRecetaByPatient[existing.id], entry.medReceta)) return false;
    medRecetaByPatient[existing.id] = entry.medReceta;
    return true;
  }
  if (!medRecetaByPatient[existing.id]) return false;
  delete medRecetaByPatient[existing.id];
  return true;
}

function applyLanMedPharmField(existing, entry) {
  if (!Object.prototype.hasOwnProperty.call(entry, 'medPharmProfile')) return false;
  if (entry.medPharmProfile) {
    if (lanJsonEqual(medPharmProfileByPatient[existing.id], entry.medPharmProfile)) return false;
    medPharmProfileByPatient[existing.id] = entry.medPharmProfile;
    return true;
  }
  if (!medPharmProfileByPatient[existing.id]) return false;
  delete medPharmProfileByPatient[existing.id];
  return true;
}

function applyLanVpoField(existing, entry) {
  if (entry.vpo) {
    if (lanJsonEqual(vpoByPatient[existing.id], entry.vpo)) return false;
    vpoByPatient[existing.id] = entry.vpo;
    return true;
  }
  if (!vpoByPatient[existing.id]) return false;
  delete vpoByPatient[existing.id];
  return true;
}

function applyLanPatientEntryToExisting(existing, entry, opts) {
  if (!existing || !entry || !entry.patient) return false;
  var p = entry.patient;
  var changed = applyLanPatientScalars(existing, p);
  if (applyLanPatientNested(existing, entry, p)) changed = true;
  if (!opts.skipTodos && saveEntryTodosOnLocalPatient(existing.id, entry)) changed = true;
  return changed;
}

function findExistingPatient(entry) {
  var reg = String(entry.patient.registro || '').trim();
  var existing = reg ? lanRuntime().findPatientByRegistro(reg) : null;
  if (!existing && entry.patient.id) {
    existing = patients.find(function (p) {
      return p && p.id === entry.patient.id;
    });
  }
  return existing;
}

function seedNewPatientArtifacts(remoteId, entry) {
  notes[remoteId] = entry.note || {};
  indicaciones[remoteId] = entry.indicaciones || {};
  labHistory[remoteId] = Array.isArray(entry.labHistory) ? entry.labHistory : [];
  if (Object.prototype.hasOwnProperty.call(entry, 'medReceta') && entry.medReceta) {
    medRecetaByPatient[remoteId] = entry.medReceta;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'medPharmProfile') && entry.medPharmProfile) {
    medPharmProfileByPatient[remoteId] = entry.medPharmProfile;
  }
  if (entry.vpo) vpoByPatient[remoteId] = entry.vpo;
}

function attachOptionalPatientFields(newPat, patient) {
  if (patient.eventualidades && typeof patient.eventualidades === 'object') {
    newPat.eventualidades = patient.eventualidades;
  }
  if (patient.historiaClinica && typeof patient.historiaClinica === 'object') {
    newPat.historiaClinica = structuredClone(patient.historiaClinica);
  }
}

function createNewPatientShell(entry) {
  var remoteId = String(entry.patient.id || '').trim();
  var p = entry.patient;
  var newPat = {
    id: remoteId,
    nombre: lanRuntime().ensureUniquePatientName(p.nombre || 'PACIENTE SIN NOMBRE'),
    area: p.area || '',
    servicio: p.servicio || '',
    cuarto: p.cuarto || '',
    cama: p.cama || '',
    peso: p.peso || '',
    talla: p.talla || '',
    viaAcceso: p.viaAcceso || '',
    edad: p.edad || '',
    sexo: p.sexo || 'F',
    registro: p.registro || '',
    fromLab: !!p.fromLab,
  };
  mergePatientMonitoreoFromImported(newPat, p);
  mergeCensoPatientFields(newPat, p);
  mergePatientRegistrationMeta(newPat, p);
  attachOptionalPatientFields(newPat, p);
  patients.unshift(newPat);
  seedNewPatientArtifacts(remoteId, entry);
  return remoteId;
}

function addLanPatientFromEntry(entry, opts) {
  var remoteId = String(entry.patient.id || '').trim();
  var idTaken =
    remoteId &&
    patients.some(function (p) {
      return p && p.id === remoteId;
    });
  var newId;
  if (remoteId && !idTaken) {
    newId = createNewPatientShell(entry);
  } else {
    newId = lanRuntime().applyImportEntry(entry, 'duplicate', null);
  }
  if (entry.listadoProblemas && newId) listadoProblemas[newId] = entry.listadoProblemas;
  if (!opts.skipTodos) saveEntryTodosOnLocalPatient(newId, entry);
  return true;
}

function refreshLanPatientUiAfterApply() {
  if (typeof entryDeps.renderPatientListLanSilent === 'function') {
    entryDeps.renderPatientListLanSilent();
  }
  if (lanRuntime().getActiveId()) {
    try {
      lanRuntime().renderNoteForm();
    } catch { /* ignored */ }
    try {
      lanRuntime().renderLabHistoryPanel();
    } catch { /* ignored */ }
    try {
      lanRuntime().renderEstadoActualPanel({ force: true, syncHeavy: true });
    } catch { /* ignored */ }
  }
}

export function applyLanPatientEntries(entries, opts) {
  opts = opts || {};
  if (!entries || !entries.length) return { added: 0, updated: 0 };
  var scopedEntries = opts.skipTeamScopeFilter
    ? entries
    : filterIncomingPatientEntriesForScope(entries);
  if (!scopedEntries.length) return { added: 0, updated: 0 };
  var added = 0;
  var updated = 0;
  for (var i = 0; i < scopedEntries.length; i += 1) {
    var entry = scopedEntries[i];
    if (!entry || !entry.patient) continue;
    var existing = findExistingPatient(entry);
    if (existing) {
      if (applyLanPatientEntryToExisting(existing, entry, opts)) updated += 1;
    } else if (addLanPatientFromEntry(entry, opts)) {
      added += 1;
    }
  }
  if (added || updated) {
    saveState({ immediate: true });
    if (!shouldEnforceTeamPatientMirror()) {
      refreshLanPatientUiAfterApply();
    }
  }
  return { added: added, updated: updated };
}
