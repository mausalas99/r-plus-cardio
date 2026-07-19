import { VPO_OFFICIAL_CALCULATOR_DISCLAIMER, VPO_SUGGESTED_SCALES } from '../vpo-text.mjs';
import { ensureScaleResults } from '../vpo-data.mjs';

import { esc } from '../dom-escape.mjs';
export function renderRiskScalesOnlyBody(state) {
  ensureScaleResults(state);
  const sr = state.scaleResults;
  return (
    '<p class="overview-hint">' + esc(VPO_OFFICIAL_CALCULATOR_DISCLAIMER) + '</p>' +
    '<div class="field-group" style="margin-top:10px;">' +
    '<label class="ea-label">Introducción (texto previo a escalas)</label>' +
    '<textarea class="ea-input" data-vpo-field="valoracionIntro" rows="2">' + esc(state.valoracionIntro) + '</textarea></div>' +
    '<p class="ea-label vpo-scales-grid-title">Resultado por escala (calculadora externa)</p>' +
    '<div class="vpo-scales-results">' +
    VPO_SUGGESTED_SCALES.map(function (s) {
      return (
        '<label class="vpo-scale-cell" title="' + esc(s.hint) + '">' +
        '<span class="vpo-scale-label">' + esc(s.label) + '</span>' +
        '<input type="text" class="ea-input" data-vpo-scale="' + esc(s.key) + '" value="' + esc(sr[s.key]) + '" placeholder="Resultado…" autocomplete="off">' +
        '</label>'
      );
    }).join('') +
    '</div>'
  );
}

export function vpoSection(title, tone, open, body) {
  return (
    '<details class="vpo-section ea-card"' + (open ? ' open' : '') + '>' +
    '<summary class="card-header card-header--tone-' + tone + '">' + esc(title) + '</summary>' +
    '<div class="vpo-section-body">' + body + '</div></details>'
  );
}

export function buildVpoEkgRxBody(state) {
  return (
    '<div class="vpo-grid" style="margin-bottom:10px;">' +
    '<div class="field-group"><label>FC (lpm) para plantilla EKG</label><input class="ea-input" data-vpo-field="fcLpm" type="text" value="' + esc(state.fcLpm) + '"></div></div>' +
    '<div class="vpo-toolbar" style="margin-bottom:10px;"><button type="button" class="btn-med-secondary" data-vpo-action="tomar-estado">Tomar FC de Estado actual</button></div>' +
    '<label class="ea-label">EKG</label><textarea class="ea-input" data-vpo-field="ekgText" rows="5">' + esc(state.ekgText) + '</textarea>' +
    '<label class="ea-label" style="margin-top:10px;display:block;">Rx tórax</label><textarea class="ea-input" data-vpo-field="rxText" rows="5">' + esc(state.rxText) + '</textarea>'
  );
}
