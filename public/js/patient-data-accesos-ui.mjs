import { accesoFechaToDateInputValue } from './patient-date-fields.mjs';
import { refreshRpcDateFields } from './rpc-date-picker.mjs';
import { ensurePatientAccesos, syncLegacyAccesoFields } from './patient-accesos.mjs';
import { patients, saveState } from './app-state.mjs';

import { esc } from './dom-escape.mjs';
function activePatient(patientId) {
  return patients.find(function (p) {
    return String(p.id) === String(patientId);
  });
}

function accesoRows(patient) {
  ensurePatientAccesos(patient);
  var list = (patient.accesosList || []).slice();
  return list.length ? list : [{ via: '', fecha: '' }];
}

function viaSelectHtml(index, via) {
  var v = String(via || '');
  return (
    '<select class="ea-input patient-acceso-via" onchange="onPatientAccesoVia(' +
    index +
    ",this.value)\" aria-label=\"Vía de acceso\">" +
    '<option value=""' +
    (!v ? ' selected' : '') +
    '>— Vía —</option>' +
    '<option value="periferica"' +
    (v === 'periferica' ? ' selected' : '') +
    '>EV periférica</option>' +
    '<option value="cvc"' +
    (v === 'cvc' ? ' selected' : '') +
    '>CVC / catéter central</option>' +
    '<option value="picc"' +
    (v === 'picc' ? ' selected' : '') +
    '>PICC</option>' +
    '</select>'
  );
}

function renderAccesosListHtml(patient) {
  var rows = accesoRows(patient);
  return rows
    .map(function (row, i) {
      var canRemove = rows.length > 1;
      return (
        '<div class="patient-acceso-row list-row">' +
        '<div class="field-group" style="margin:0;">' +
        viaSelectHtml(i, row.via) +
        '</div>' +
        '<div class="field-group" style="margin:0;">' +
        '<input type="date" class="rpc-date-input patient-acceso-fecha" value="' +
        esc(accesoFechaToDateInputValue(row.fecha)) +
        '" oninput="onPatientAccesoFecha(' +
        i +
        ',this.value)" aria-label="Fecha acceso">' +
        '</div>' +
        '<button type="button" class="btn-remove" onclick="removePatientAccesoRow(' +
        i +
        ')"' +
        (canRemove ? '' : ' style="visibility:hidden"') +
        ' aria-label="Quitar acceso">×</button>' +
        '</div>'
      );
    })
    .join('');
}

/** @param {Record<string, unknown>} patient */
export function buildPatientAccesosSectionHtml(patient) {
  ensurePatientAccesos(patient);
  return (
    '<div class="patient-accesos-block">' +
    '<div class="vpo-toolbar" style="margin-top:2px;">' +
    '<span class="ea-label" style="flex:1;">Accesos</span>' +
    '<button type="button" class="btn-add-row" onclick="addPatientAccesoRow()">+ Agregar acceso</button>' +
    '</div>' +
    '<div class="patient-accesos-list" id="patient-accesos-list">' +
    renderAccesosListHtml(patient) +
    '</div></div>'
  );
}

function refreshAccesosListDom(patientId) {
  var patient = activePatient(patientId);
  var listEl = document.getElementById('patient-accesos-list');
  if (!patient || !listEl) return;
  listEl.innerHTML = renderAccesosListHtml(patient);
  refreshRpcDateFields(listEl);
}

function currentPatientId() {
  var wrap = document.getElementById('patient-data-form');
  return wrap && wrap.dataset.patientId ? wrap.dataset.patientId : null;
}

function touchAccesos(patient, mutator) {
  if (!patient) return;
  ensurePatientAccesos(patient);
  mutator(patient);
  syncLegacyAccesoFields(patient);
  saveState();
}

export function onPatientAccesoVia(index, value) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  touchAccesos(patient, function (p) {
    p.accesosList[index].via = String(value || '').trim();
  });
}

export function onPatientAccesoFecha(index, value) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  touchAccesos(patient, function (p) {
    p.accesosList[index].fecha = String(value || '').trim();
  });
}

export function addPatientAccesoRow() {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient) return;
  touchAccesos(patient, function (p) {
    p.accesosList.push({ via: '', fecha: '' });
  });
  refreshAccesosListDom(pid);
}

export function removePatientAccesoRow(index) {
  var pid = currentPatientId();
  var patient = activePatient(pid);
  if (!patient || !Array.isArray(patient.accesosList)) return;
  if (patient.accesosList.length <= 1) return;
  touchAccesos(patient, function (p) {
    p.accesosList.splice(index, 1);
    ensurePatientAccesos(p);
  });
  refreshAccesosListDom(pid);
}

export const patientDataAccesosWindowHandlers = {
  onPatientAccesoVia,
  onPatientAccesoFecha,
  addPatientAccesoRow,
  removePatientAccesoRow,
};
