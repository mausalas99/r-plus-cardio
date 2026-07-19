import { parseDiagnosticosText } from './patient-diagnosticos.mjs';
import {
  ensurePatientDiagnosticos,
  applyPatientDiagnosticosList,
  migratePatientDiagnosticosFromVpo,
} from './patient-diagnosticos.mjs';
import { formatCensoMedsFromReceta } from './censo-meds-format.mjs';
import { patients, medRecetaByPatient, vpoByPatient, saveState } from './app-state.mjs';

import { esc } from './dom-escape.mjs';
function activePatient(patientId) {
  return patients.find(function (p) {
    return String(p.id) === String(patientId);
  });
}

function dxRows(patient) {
  var list = (patient.diagnosticosList || []).slice();
  return list.length ? list : [''];
}

function renderDxListHtml(patient) {
  var rows = dxRows(patient);
  return rows
    .map(function (dx, i) {
      var canRemove = rows.length > 1;
      return (
        '<div class="vpo-dx-row list-row">' +
        '<input type="text" class="ea-input" value="' +
        esc(dx) +
        '" placeholder="Diagnóstico ' +
        (i + 1) +
        '" oninput="onPatientDxInput(' +
        i +
        ', this.value)" style="text-transform:uppercase;">' +
        '<button type="button" class="btn-remove" onclick="removePatientDxRow(' +
        i +
        ')"' +
        (canRemove ? '' : ' style="visibility:hidden"') +
        ' aria-label="Eliminar">×</button></div>'
      );
    })
    .join('');
}

/** @param {Record<string, unknown>} patient */
export function buildPatientCensoDatosSectionsHtml(patient) {
  migratePatientDiagnosticosFromVpo(patient, vpoByPatient[patient.id]);
  ensurePatientDiagnosticos(patient);
  return (
    '<div class="card" style="margin-top:10px;"><div class="card-header">Diagnósticos (censo)</div><div class="card-body">' +
    '<div class="vpo-toolbar">' +
    '<button type="button" class="btn-add-row" onclick="addPatientDxRow()">+ Agregar diagnóstico</button>' +
    '</div>' +
    '<div class="vpo-dx-list" id="patient-dx-list">' +
    renderDxListHtml(patient) +
    '</div>' +
    '<div class="vpo-dx-paste" style="margin-top:8px;">' +
    '<span class="ea-label">Pegar con « + » entre diagnósticos</span>' +
    '<textarea class="ea-input" id="patient-dx-paste" rows="2" placeholder="DX1 + DX2…"></textarea>' +
    '<button type="button" class="btn-med-secondary" onclick="splitPatientDxPaste()">Separar por +</button>' +
    '</div></div></div>' +
    '<div class="card" style="margin-top:10px;"><div class="card-header">Censo — ATB / Medicamentos</div><div class="card-body">' +
    '<div class="vpo-toolbar">' +
    '<button type="button" class="btn-med-secondary" onclick="censoTomarDeMedicamentos()">Tomar de Medicamentos</button>' +
    '</div>' +
    '<textarea class="ea-input" id="patient-censo-meds" rows="6" placeholder="Texto para columna ATB/Meds del PDF…" oninput="updatePatientCensoMeds(this.value)">' +
    esc(patient.censoMedsText || '') +
    '</textarea></div></div>'
  );
}

function refreshDxListDom(patientId) {
  var patient = activePatient(patientId);
  var listEl = document.getElementById('patient-dx-list');
  if (!patient || !listEl) return;
  listEl.innerHTML = renderDxListHtml(patient);
}

function currentPatientId() {
  var wrap = document.getElementById('patient-data-form');
  return wrap && wrap.dataset.patientId ? wrap.dataset.patientId : null;
}

export function onPatientDxInput(index, value) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  if (!Array.isArray(patient.diagnosticosList)) patient.diagnosticosList = [''];
  patient.diagnosticosList[index] = String(value || '').toUpperCase();
  ensurePatientDiagnosticos(patient);
  saveState();
}

export function addPatientDxRow() {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  if (!Array.isArray(patient.diagnosticosList)) patient.diagnosticosList = [''];
  patient.diagnosticosList.push('');
  saveState();
  refreshDxListDom(pid);
}

export function removePatientDxRow(index) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient || !Array.isArray(patient.diagnosticosList)) return;
  if (patient.diagnosticosList.length <= 1) return;
  patient.diagnosticosList.splice(index, 1);
  applyPatientDiagnosticosList(patient, patient.diagnosticosList);
  saveState();
  refreshDxListDom(pid);
}

export function splitPatientDxPaste() {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  var ta = document.getElementById('patient-dx-paste');
  if (!patient || !ta) return;
  var parsed = parseDiagnosticosText(ta.value);
  if (!parsed.length) return;
  applyPatientDiagnosticosList(patient, parsed.concat(['']));
  saveState();
  refreshDxListDom(pid);
}

export function updatePatientCensoMeds(value) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  patient.censoMedsText = String(value || '');
  saveState();
}

export function censoTomarDeMedicamentos() {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  var text = formatCensoMedsFromReceta(medRecetaByPatient[pid]);
  patient.censoMedsText = text;
  var ta = document.getElementById('patient-censo-meds');
  if (ta) ta.value = text;
  saveState();
}

export const patientDataCensoWindowHandlers = {
  onPatientDxInput,
  addPatientDxRow,
  removePatientDxRow,
  splitPatientDxPaste,
  updatePatientCensoMeds,
  censoTomarDeMedicamentos,
};
