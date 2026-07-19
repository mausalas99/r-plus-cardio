import {
  ERC_CONDITION_ID,
  CKD_STAGES,
  normalizeErcDetail,
} from '../../../../lib/historia-clinica/erc-detail.mjs';
import { esc } from './runtime.mjs';
import { flexibleDateHtml } from './flex-date.mjs';

export function conditionCardHtml(row, app) {
  const det = (app.conditionDetails && app.conditionDetails[row.id]) || {};
  if (row.id === ERC_CONDITION_ID) {
    const erc = normalizeErcDetail(det);
    const stageOpts = CKD_STAGES.map(function (s) {
      return (
        '<option value="' +
        esc(s.id) +
        '"' +
        (erc.stage === s.id ? ' selected' : '') +
        '>' +
        esc(s.label) +
        '</option>'
      );
    }).join('');
    return (
      '<details class="card hc-app-cond-card hc-app-cond-card--erc" open data-cond-id="' +
      esc(row.id) +
      '">' +
      '<summary class="card-header">' +
      esc(row.label) +
      '</summary><div class="card-body">' +
      '<div class="hc-grid">' +
      '<div class="field-group"><label>Estadio (KDIGO)</label>' +
      '<select data-erc-field="stage">' +
      stageOpts +
      '</select></div>' +
      '<div class="field-group"><label>Fecha de diagnóstico</label>' +
      flexibleDateHtml('erc-dx', erc.diagnosedAt) +
      '</div>' +
      '<div class="field-group hc-entry-row-span"><label>Diagnóstico / etiología</label>' +
      '<input type="text" data-erc-field="diagnosis" value="' +
      esc(erc.diagnosis) +
      '" placeholder="Ej. nefropatía diabética, NAE, riñón poliquístico"></div>' +
      '<div class="field-group hc-entry-row-span"><label>Tratamiento (no farmacológico)</label>' +
      '<input type="text" data-erc-field="treatment" value="' +
      esc(erc.treatment) +
      '" placeholder="Dieta, restricción hídrica, diálisis…"></div>' +
      '</div>' +
      '<div class="hc-erc-meds-block">' +
      '<p class="profile-hint">Medicamentos del tratamiento — se agregan automáticamente a <strong>Medicamentos actuales</strong>.</p>' +
      '<div id="hc-erc-meds-list" class="hc-app-special-body"></div>' +
      '<button type="button" class="btn-add-row" id="hc-erc-add-med">+ Agregar medicamento</button>' +
      '</div></div></details>'
    );
  }
  return (
    '<details class="card hc-app-cond-card" open data-cond-id="' +
    esc(row.id) +
    '">' +
    '<summary class="card-header">' +
    esc(row.label) +
    (row.custom ? ' <span class="hc-tag">Personalizada</span>' : '') +
    '</summary><div class="card-body hc-grid">' +
    '<div class="field-group"><label>Fecha de diagnóstico</label>' +
    flexibleDateHtml('dx-' + row.id, det.diagnosedAt) +
    '</div>' +
    '<div class="field-group"><label>Tratamiento</label>' +
    '<input type="text" data-cond-field="treatment" value="' +
    esc(det.treatment || '') +
    '" placeholder="Tratamiento actual o previo"></div></div></details>'
  );
}
