// Patient demographics pane (Datos tab)
import { patients } from '../../app-state.mjs';
import { isModeSala } from '../../mode-features.mjs';
import { buildPatientAccesosSectionHtml } from '../../patient-data-accesos-ui.mjs';
import { buildPatientTeamAssignSectionHtml, wirePatientTeamAssignRefresh } from '../../patient-team-assign-ui.mjs';
import { buildPatientSalaFieldHtml } from '../../patient-sala-ui.mjs';
import { buildPatientIngresoFechasHtml } from '../../patient-data-ingreso-ui.mjs';
import { refreshRpcDateFields } from '../../rpc-date-picker.mjs';
import { buildPatientCensoDatosSectionsHtml } from '../../patient-data-censo-ui.mjs';
import { rt, aid, esc } from './expediente-runtime.mjs';

function buildPatientDemographicsFieldsHtml(patient) {
  return (
    '<div style="display:flex;flex-direction:column;gap:10px;">' +
    buildPatientTeamAssignSectionHtml(patient) +
    buildPatientSalaFieldHtml(patient) +
    '<div class="field-group"><label>Nombre</label><input type="text" value="' + esc(patient.nombre) + '" oninput="updatePatient(\'nombre\',this.value)" style="text-transform:uppercase;"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 100px 60px;gap:10px;">' +
    '<div class="field-group"><label>Registro</label><input type="text" value="' + esc(patient.registro) + '" oninput="updatePatient(\'registro\',this.value)"></div>' +
    '<div class="field-group"><label>Edad</label><input type="text" value="' + esc(patient.edad) + '" oninput="updatePatient(\'edad\',this.value)"></div>' +
    '<div class="field-group"><label>Sexo</label><select onchange="updatePatient(\'sexo\',this.value)"><option value="M"' + (patient.sexo==='M'?' selected':'') + '>M</option><option value="F"' + (patient.sexo==='F'?' selected':'') + '>F</option></select></div></div>' +
    buildPatientIngresoFechasHtml(patient, rt.getSettings()) +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
    '<div class="field-group"><label>Peso (kg)</label><input type="text" inputmode="decimal" value="' + esc(patient.peso || '') + '" placeholder="60" oninput="updatePatient(\'peso\',this.value)"></div>' +
    '<div class="field-group"><label>Talla (m)</label><input type="text" inputmode="decimal" value="' + esc(patient.talla || '') + '" placeholder="1.60" oninput="updatePatient(\'talla\',this.value)"></div></div>' +
    buildPatientAccesosSectionHtml(patient) +
    '<div class="field-group"><label>Área</label><input type="text" value="' + esc(patient.area) + '" oninput="updatePatient(\'area\',this.value)" style="text-transform:uppercase;"></div>' +
    '<div class="field-group"><label>Servicio</label><input type="text" value="' + esc(patient.servicio) + '" oninput="updatePatient(\'servicio\',this.value)" style="text-transform:uppercase;"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
    '<div class="field-group"><label>Cuarto</label><input type="text" value="' + esc(patient.cuarto) + '" oninput="updatePatient(\'cuarto\',this.value)"></div>' +
    '<div class="field-group"><label>Cama</label><input type="text" value="' + esc(patient.cama) + '" oninput="updatePatient(\'cama\',this.value)"></div></div>' +
    (isModeSala(rt.getSettings()) ? buildPatientCensoDatosSectionsHtml(patient) : '') +
    '</div>'
  );
}

/** @param {Record<string, unknown>} patient @param {{ embedded?: boolean }} [opts] */
function buildPatientDemographicsCardHtml(patient, opts) {
  var fields = buildPatientDemographicsFieldsHtml(patient);
  if (opts && opts.embedded) {
    return '<div class="exp-datos-fields">' + fields + '</div>';
  }
  return (
    '<div class="card"><div class="card-header"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Datos del Paciente</div><div class="card-body">' +
    fields +
    '</div></div>'
  );
}

/** Demographics editable en pestaña Datos (#patient-data-form). */
function renderPatientDataPane(patientIdOverride) {
  var wrap = document.getElementById('patient-data-form');
  if (!wrap) return;
  var targetId =
    patientIdOverride != null && patientIdOverride !== '' ? patientIdOverride : aid();
  if (!targetId) {
    wrap.innerHTML = '';
    return;
  }
  var patient = patients.find(function (p) {
    return String(p.id) === String(targetId);
  });
  if (!patient) {
    wrap.innerHTML = '';
    return;
  }
  wrap.dataset.patientId = String(patient.id);
  var datosMount = wrap.closest('.exp-datos-modal-body') || wrap.closest('#exp-datos-modal-mount');
  if (datosMount) datosMount.dataset.patientId = String(patient.id);
  wrap.innerHTML = buildPatientDemographicsCardHtml(patient, { embedded: true });
  refreshRpcDateFields(wrap);
  wirePatientTeamAssignRefresh();
}

export { buildPatientDemographicsCardHtml, renderPatientDataPane };
