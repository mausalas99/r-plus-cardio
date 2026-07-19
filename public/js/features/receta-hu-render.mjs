import { formatRecetaHuFecha } from '../receta-hu-core.mjs';
import { rt, aid, esc, getDraft, activePatient } from './receta-hu-shared.mjs';
import { resetExportButtonState } from './receta-hu-button-state.mjs';
import { bindRecetaHuEvents } from './receta-hu-events.mjs';
import {
  renderMedList,
  renderLabList,
  renderProximaCitaList,
  renderConsultServiceSelect,
} from './receta-hu-list-render.mjs';

export { resetExportButtonState } from './receta-hu-button-state.mjs';

function ensureRecetaHuShell(root) {
  var pid = aid();
  if (root.dataset.mounted === '1' && root.dataset.patientId === pid) return;

  root.innerHTML =
    '<div class="receta-hu-root">' +
    '<div class="receta-hu-sheet">' +
    '<div class="receta-hu-head">' +
    '<div><h3 class="receta-hu-title">Receta médica HU</h3>' +
    '<p class="receta-hu-sub">Formato oficial <strong>000-061-R-06-12</strong>. Firma a mano al imprimir.</p></div>' +
    '<button type="button" class="btn-generate rpc-doc-export" id="btn-receta-hu-export" data-receta-hu-action="export">Exportar PDF</button>' +
    '</div>' +
    '<section class="receta-hu-section">' +
    '<h4 class="receta-hu-section-title">Paciente</h4>' +
    '<div class="receta-hu-meta" id="receta-hu-patient-meta"></div>' +
    '<label class="receta-hu-field"><span>Fecha</span><input type="text" class="receta-hu-input" id="receta-hu-fecha" placeholder="dd/mm/aaaa"></label>' +
    '</section>' +
    '<section class="receta-hu-section">' +
    '<h4 class="receta-hu-section-title">Medicamentos</h4>' +
    '<div class="receta-hu-compose receta-hu-compose-med">' +
    '<input type="text" class="receta-hu-input" id="receta-hu-compose-med-n" placeholder="Medicamento" aria-label="Medicamento">' +
    '<input type="text" class="receta-hu-input" id="receta-hu-compose-med-p" placeholder="Presentación" aria-label="Presentación">' +
    '<input type="text" class="receta-hu-input" id="receta-hu-compose-med-d" placeholder="Dosis" aria-label="Dosis">' +
    '<button type="button" class="btn-add-inline" data-receta-hu-action="add-med">Agregar</button>' +
    '</div>' +
    '<div id="receta-hu-meds-list" class="receta-hu-added-list"></div>' +
    '</section>' +
    '<section class="receta-hu-section">' +
    '<h4 class="receta-hu-section-title">Exámenes de laboratorio y/o gabinete</h4>' +
    '<p class="receta-hu-hint-inline">Solo el nombre del estudio — para que el paciente acuda a tomarlos.</p>' +
    '<div class="receta-hu-compose receta-hu-compose-lab">' +
    '<input type="text" class="receta-hu-input" id="receta-hu-compose-lab" placeholder="Nombre del estudio" aria-label="Estudio de laboratorio">' +
    '<button type="button" class="btn-add-inline" data-receta-hu-action="add-lab">Agregar</button>' +
    '</div>' +
    '<div id="receta-hu-labs-added" class="receta-hu-added-list"></div>' +
    '</section>' +
    '<section class="receta-hu-section">' +
    '<h4 class="receta-hu-section-title">Cuidados higiénicos dietéticos</h4>' +
    '<textarea class="receta-hu-textarea" id="receta-hu-cuidados" rows="4" placeholder="Texto libre…"></textarea>' +
    '</section>' +
    '<section class="receta-hu-section">' +
    '<h4 class="receta-hu-section-title">Consultas de seguimiento</h4>' +
    '<p class="receta-hu-hint-inline">Puedes agregar varias consultas; en el PDF aparecen una debajo de otra.</p>' +
    '<div class="receta-hu-proxima-grid receta-hu-compose-proxima">' +
    '<label class="receta-hu-field"><span>Plazo</span><input type="text" class="receta-hu-input" id="receta-hu-compose-proxima-plazo" placeholder="2 semanas"></label>' +
    '<label class="receta-hu-field"><span>Consulta de</span><select class="receta-hu-input" id="receta-hu-consult-servicio"></select></label>' +
    '<button type="button" class="btn-add-inline btn-add-inline-muted" data-receta-hu-action="add-service">+ Servicio</button>' +
    '</div>' +
    '<label class="receta-hu-field"><span>Texto en receta</span><input type="text" class="receta-hu-input" id="receta-hu-compose-proxima-texto" placeholder="Acudir en 2 semanas a consulta de Nefrología"></label>' +
    '<div class="receta-hu-compose receta-hu-compose-proxima-fecha">' +
    '<label class="receta-hu-field receta-hu-field-grow"><span>Fecha (opcional, campo derecho del PDF)</span><input type="text" class="receta-hu-input" id="receta-hu-compose-proxima-fecha" placeholder="dd/mm/aaaa"></label>' +
    '<button type="button" class="btn-add-inline" data-receta-hu-action="add-proxima">Agregar consulta</button>' +
    '</div>' +
    '<div id="receta-hu-proximas-list" class="receta-hu-added-list"></div>' +
    '</section>' +
    '<p class="receta-hu-foot">Médico y cédula se toman de <strong>Mi Perfil</strong>.</p>' +
    '</div></div>';

  root.dataset.mounted = '1';
  root.dataset.patientId = pid || '';
  root.dataset.eventsBound = '0';
  bindRecetaHuEvents(root);
}

function populateRecetaHuPatientMeta(root, patient) {
  var meta = root.querySelector('#receta-hu-patient-meta');
  if (!meta || !patient) return;
  meta.innerHTML =
    '<span><strong>' +
    esc(patient.nombre) +
    '</strong></span>' +
    (patient.registro ? '<span>Reg. ' + esc(patient.registro) + '</span>' : '') +
    (patient.servicio ? '<span>Serv. ' + esc(patient.servicio) + '</span>' : '');
}

function populateRecetaHuDraftFields(root, draft) {
  var fechaEl = root.querySelector('#receta-hu-fecha');
  if (fechaEl) fechaEl.value = draft.fecha || formatRecetaHuFecha(new Date());
  var cuidadosEl = root.querySelector('#receta-hu-cuidados');
  if (cuidadosEl) cuidadosEl.value = draft.cuidados;
  renderMedList(root, draft.meds);
  renderLabList(root, draft.labs);
  renderProximaCitaList(root, draft.proximasCitas);
  renderConsultServiceSelect(root, draft);
}

function populateRecetaHuDoctorFoot(root, st) {
  var docHint = root.querySelector('.receta-hu-foot');
  if (!docHint) return;
  docHint.innerHTML =
    'Médico: <strong>' +
    esc(st.doctorName || '—') +
    '</strong> · Cédula: <strong>' +
    esc(st.cedulaProfesional || '—') +
    '</strong> (<a href="#" data-receta-hu-action="open-profile">Mi Perfil</a>)';
}

export function renderRecetaHu() {
  var root = document.getElementById('receta-hu-container');
  if (!root) return;

  var pid = aid();
  if (!pid) {
    root.innerHTML = '<p class="receta-hu-hint">Selecciona un paciente para llenar la receta HU.</p>';
    root.dataset.mounted = '';
    return;
  }

  if (root.dataset.patientId && root.dataset.patientId !== pid) {
    root.dataset.mounted = '';
    root.dataset.eventsBound = '0';
  }

  var patient = activePatient();
  var draft = getDraft(pid);
  var st = rt.getSettings();

  ensureRecetaHuShell(root);
  bindRecetaHuEvents(root);
  populateRecetaHuPatientMeta(root, patient);
  populateRecetaHuDraftFields(root, draft);
  populateRecetaHuDoctorFoot(root, st);
  resetExportButtonState();
  if (typeof rt.syncOfflineButtonStates === 'function') rt.syncOfflineButtonStates();
}
