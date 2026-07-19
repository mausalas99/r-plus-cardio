import {
  ensureDuracionKey,
  ensureDiagnosticosList,
  autofillVitalsFromMonitoreoIfEmpty,
  setDiagnosticosList,
  importDiagnosticosFromPaste,
} from '../vpo-data.mjs';
import { ensurePatientDiagnosticos } from '../patient-diagnosticos.mjs';

/**
 * @param {object} state
 * @param {object|null} patient
 */
export function hydrateVpoPatientDefaults(state, patient) {
  if (!state.edad && patient && patient.edad) {
    var m = String(patient.edad).match(/(\d+)/);
    if (m) state.edad = m[1];
  }
  ensureDuracionKey(state);
  ensureDiagnosticosList(state);
  if (patient && !state.diagnosticosTouched) {
    var vpoDxEmpty = !(state.diagnosticosList || []).some(function (d) {
      return String(d).trim();
    });
    if (vpoDxEmpty) {
      ensurePatientDiagnosticos(patient);
      var fromPat = (patient.diagnosticosList || []).filter(function (d) {
        return String(d).trim();
      });
      if (fromPat.length) setDiagnosticosList(state, fromPat.concat(['']));
    }
  }
  autofillVitalsFromMonitoreoIfEmpty(state, patient || null);
}

/**
 * @param {object} state
 * @param {function} esc
 * @param {function} vpoSection
 * @param {function} renderRiskScalesOnlyBody
 * @param {function} renderDiagnosticosSection
 * @param {function} renderFarmacosList
 */
export function buildVpoPanelInnerHtml(
  state,
  esc,
  vpoSection,
  renderRiskScalesOnlyBody,
  renderDiagnosticosSection,
  renderFarmacosList
) {
  var riesgoBody = renderRiskScalesOnlyBody(state);
  var ekgBody =
    '<div class="vpo-grid" style="margin-bottom:10px;">' +
    '<div class="field-group"><label>FC (lpm) para plantilla EKG</label><input class="ea-input" data-vpo-field="fcLpm" type="text" value="' +
    esc(state.fcLpm) +
    '"></div></div>' +
    '<div class="vpo-toolbar" style="margin-bottom:10px;">' +
    '<button type="button" class="btn-med-secondary" data-vpo-action="tomar-estado">Tomar FC de Estado actual</button>' +
    '</div>' +
    '<label class="ea-label">EKG</label><textarea class="ea-input" data-vpo-field="ekgText" rows="5">' +
    esc(state.ekgText) +
    '</textarea>' +
    '<label class="ea-label" style="margin-top:10px;display:block;">Rx tórax</label><textarea class="ea-input" data-vpo-field="rxText" rows="5">' +
    esc(state.rxText) +
    '</textarea>';

  return (
    '<div class="vpo-panel vpo-form rpc-form-stack">' +
    vpoSection('Riesgo preoperatorio', 'amber', true, riesgoBody) +
    vpoSection('EKG y Rx tórax', 'indigo', false, ekgBody) +
    vpoSection('Diagnósticos', 'rose', true, renderDiagnosticosSection(state)) +
    vpoSection(
      'Fármacos perioperatorios',
      'teal',
      false,
      '<p class="overview-hint">Fuente: receta SOME en Medicamentos.</p>' +
        '<div class="vpo-toolbar">' +
        '<button type="button" class="btn-med-secondary" data-vpo-action="tomar-meds">Tomar de Medicamentos (SOME)</button> ' +
        '<button type="button" class="btn-med-secondary" data-vpo-action="ir-med">Ir a Medicamentos</button></div>' +
        '<div class="vpo-farm-list">' +
        renderFarmacosList(state.farmacos) +
        '</div>'
    ) +
    '<div class="vpo-actions">' +
    '<button type="button" class="manejo-copy-btn primary" data-vpo-action="copy-full">Copiar valoración completa</button>' +
    '<button type="button" class="manejo-copy-btn" data-vpo-action="copy-ekg">Copiar EKG</button>' +
    '<button type="button" class="manejo-copy-btn" data-vpo-action="copy-rx">Copiar Rx</button>' +
    '<button type="button" class="manejo-copy-btn" data-vpo-action="copy-risk">Copiar riesgos</button>' +
    '<button type="button" class="manejo-copy-btn" data-vpo-action="copy-farm">Copiar fármacos</button>' +
    '</div></div>'
  );
}

/**
 * @param {HTMLElement} mount
 * @param {string} action
 * @param {object} state
 * @param {{
 *   showToast: function,
 *   scheduleSave: function,
 *   refreshDxListDom: function,
 *   commitDxList: function,
 * }} deps
 */
export function handleVpoDxDelegationAction(mount, action, state, deps) {
  if (action === 'dx-split-plus') {
    var ta = mount.querySelector('[data-vpo-dx-paste]');
    if (!importDiagnosticosFromPaste(state, ta ? ta.value : '')) {
      deps.showToast('Pega diagnósticos separados por +', 'error');
      return;
    }
    if (ta) ta.value = '';
    deps.scheduleSave();
    deps.refreshDxListDom(mount, state);
    deps.showToast('Diagnósticos separados', 'success');
    return;
  }

  if (action === 'dx-add-row') {
    if (!state.diagnosticosList) state.diagnosticosList = [''];
    if (state.diagnosticosList[state.diagnosticosList.length - 1]) {
      state.diagnosticosList.push('');
    }
    deps.commitDxList(mount, state);
    var lastInput = mount.querySelector(
      '[data-vpo-dx-idx="' + (state.diagnosticosList.length - 1) + '"]'
    );
    if (lastInput) lastInput.focus();
  }
}

/**
 * @param {HTMLElement} mount
 * @param {HTMLElement} removeBtn
 * @param {object} state
 * @param {{ commitDxList: function }} deps
 */
export function handleVpoDxRemoveRow(mount, removeBtn, state, deps) {
  var idx = parseInt(removeBtn.getAttribute('data-vpo-dx-remove'), 10);
  if (!state.diagnosticosList || state.diagnosticosList.length <= 1) return;
  state.diagnosticosList.splice(idx, 1);
  if (!state.diagnosticosList.length) state.diagnosticosList = [''];
  deps.commitDxList(mount, state);
}
