import { activePatient, esc } from './runtime.mjs';
import { mountApnpHabits, mountChecklists } from './mount-widgets.mjs';
import {
  compileHistoriaTeaser,
  renderLabsStep,
  renderLecturaView,
  renderStep1,
  renderStep2,
  renderStepperHeader,
} from './render-html.mjs';
import { hcState } from './state.mjs';
import { wirePanel } from './wire.mjs';

export function renderPanel(root) {
  var patient = activePatient();
  if (!patient) {
    root.innerHTML = '<p class="tend-empty">Selecciona un paciente.</p>';
    return;
  }
  var mobile = window.matchMedia('(max-width: 768px)').matches;

  var toolbar =
    '<div class="hc-toolbar">' +
    (!hcState.editMode && !mobile
      ? '<button type="button" class="btn-generate" id="hc-edit-toggle">Editar historia</button>' +
        '<button type="button" class="btn-med-secondary" id="hc-copy">Copiar historia</button>'
      : '') +
    (hcState.editMode && !mobile
      ? '<button type="button" class="btn-generate" id="hc-save">Guardar</button>' +
        '<button type="button" class="btn-med-secondary" id="hc-cancel-edit">Cancelar</button>'
      : '') +
    '</div>';

  if (mobile) {
    var teaser = compileHistoriaTeaser(patient, 3);
    root.innerHTML =
      toolbar +
      '<div class="hc-summary"><pre class="hc-mobile-teaser">' +
      esc(teaser.slice(0, 600)) +
      '</pre><p class="profile-hint">Abre en escritorio para editar la historia completa.</p></div>';
    wirePanel(root, patient, renderPanel);
    return;
  }

  if (!hcState.editMode) {
    root.innerHTML = toolbar;
    var lecturaMount = document.createElement('div');
    root.appendChild(lecturaMount);
    renderLecturaView(lecturaMount, patient);
    wirePanel(root, patient, renderPanel);
    return;
  }

  var stepBody =
    hcState.step === 1
      ? renderStep1()
      : hcState.step === 2
        ? renderStep2()
        : renderLabsStep(patient);
  root.innerHTML =
    toolbar +
    renderStepperHeader() +
    stepBody +
    '<div class="hc-step-footer">' +
    (hcState.step > 1 ? '<button type="button" class="btn-med-secondary" id="hc-prev">Anterior</button>' : '') +
    (hcState.step < 3
      ? '<button type="button" class="btn-generate" id="hc-next">Siguiente</button>'
      : '<button type="button" class="btn-generate" id="hc-save">Guardar</button>') +
    '</div>';

  mountApnpHabits(root, patient);
  mountChecklists(root, patient);
  wirePanel(root, patient, renderPanel);
}
