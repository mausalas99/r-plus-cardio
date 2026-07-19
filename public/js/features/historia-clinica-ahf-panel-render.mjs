import { AHF_RELATIVES } from '../../../lib/historia-clinica/ahf-relatives.mjs';
import { syncAhfConditionsFromEntries } from '../../../lib/historia-clinica/compile-ahf.mjs';

import { esc } from '../dom-escape.mjs';
export function catalogOptions(map) {
  return Object.keys(map || {}).map(function (id) {
    return { id, label: map[id] };
  });
}

export function defaultAhf() {
  return {
    conditions: [],
    customConditions: [],
    entries: [],
    descripcionDetallada: '',
  };
}

export function ensureAhf(ahf) {
  return syncAhfConditionsFromEntries(Object.assign(defaultAhf(), ahf || {}));
}

export function newEntryId() {
  return 'ahf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export function conditionLabel(id, catalog, customConditions) {
  if (catalog && catalog[id]) return catalog[id];
  const c = (customConditions || []).find(function (row) {
    return row && row.id === id;
  });
  return (c && c.label) || id;
}

export function entriesForCondition(ahf, conditionId) {
  return (ahf.entries || []).filter(function (e) {
    return e && e.conditionId === conditionId;
  });
}

export function blankAhfEntry(conditionId) {
  return {
    id: newEntryId(),
    conditionId,
    relativeId: '',
    diagnosis: '',
    treatment: '',
    vitalStatus: 'desconocido',
  };
}

export function relativeSelectHtml(entryId, value) {
  let html =
    '<select class="hc-ahf-relative" data-entry-id="' +
    esc(entryId) +
    '">';
  html += '<option value="">— Familiar —</option>';
  AHF_RELATIVES.forEach(function (rel) {
    html +=
      '<option value="' +
      esc(rel.id) +
      '"' +
      (value === rel.id ? ' selected' : '') +
      '>' +
      esc(rel.label) +
      '</option>';
  });
  return html + '</select>';
}

export function entryRowHtml(entry) {
  const e = entry || {};
  const id = e.id || newEntryId();
  const vital = e.vitalStatus || 'desconocido';
  const deadFields = vital === 'fallecido';
  return (
    '<div class="hc-ahf-entry" data-entry-id="' +
    esc(id) +
    '">' +
    '<div class="field-group"><label>Familiar</label>' +
    relativeSelectHtml(id, e.relativeId) +
    '</div>' +
    '<div class="field-group"><label>Diagnóstico</label>' +
    '<input type="text" data-ahf-field="diagnosis" value="' +
    esc(e.diagnosis || '') +
    '"></div>' +
    '<div class="field-group"><label>Tratamiento</label>' +
    '<input type="text" data-ahf-field="treatment" value="' +
    esc(e.treatment || '') +
    '"></div>' +
    '<div class="field-group"><label>Estado</label>' +
    '<select data-ahf-field="vitalStatus">' +
    '<option value="vivo"' +
    (vital === 'vivo' ? ' selected' : '') +
    '>Vivo/a</option>' +
    '<option value="fallecido"' +
    (vital === 'fallecido' ? ' selected' : '') +
    '>Fallecido/a</option>' +
    '<option value="desconocido"' +
    (vital === 'desconocido' ? ' selected' : '') +
    '>No especificado</option>' +
    '</select></div>' +
    '<div class="hc-ahf-death-fields' +
    (deadFields ? '' : ' hc-ahf-death-fields--hidden') +
    '">' +
    '<div class="field-group"><label>Edad al fallecer</label>' +
    '<input type="number" min="0" max="120" data-ahf-field="ageAtDeath" value="' +
    esc(e.ageAtDeath != null ? e.ageAtDeath : '') +
    '"></div>' +
    '<div class="field-group"><label>Causa de muerte</label>' +
    '<input type="text" data-ahf-field="causeOfDeath" value="' +
    esc(e.causeOfDeath || '') +
    '"></div></div>' +
    '<button type="button" class="btn-remove" data-ahf-remove aria-label="Quitar familiar">×</button>' +
    '</div>'
  );
}

export function buildAhfPanelHtml(ahf, catalog) {
  const options = catalogOptions(catalog);
  const activeIds = new Set(ahf.conditions || []);

  let html = '<div class="hc-ahf-panel">';

  html += '<div class="hc-checklist-options hc-checklist-options--grid">';
  options.forEach(function (opt) {
    const checked = activeIds.has(opt.id) ? ' checked' : '';
    html +=
      '<label class="hc-check-chip"><input type="checkbox" class="hc-check-chip-input" data-ahf-cond="' +
      esc(opt.id) +
      '"' +
      checked +
      '><span class="hc-check-chip-label">' +
      esc(opt.label) +
      '</span></label>';
  });
  html += '</div>';

  html +=
    '<div class="hc-app-custom-row">' +
    '<div class="field-group" style="flex:1"><label>Otra enfermedad familiar</label>' +
    '<input type="text" id="hc-ahf-custom-label" placeholder="Nombre de la enfermedad"></div>' +
    '<button type="button" class="btn-med-secondary" id="hc-ahf-add-custom">Agregar</button></div>';

  const positiveIds = (ahf.conditions || []).slice();
  if (positiveIds.length) {
    html += '<div class="hc-ahf-conditions-detail">';
    positiveIds.forEach(function (cid) {
      const entries = entriesForCondition(ahf, cid);
      html +=
        '<details class="card hc-ahf-cond-card" open data-cond-id="' +
        esc(cid) +
        '"><summary class="card-header">' +
        esc(conditionLabel(cid, catalog, ahf.customConditions)) +
        '</summary><div class="card-body hc-ahf-entries" data-cond-id="' +
        esc(cid) +
        '">';
      if (entries.length) {
        entries.forEach(function (entry) {
          html += entryRowHtml(entry);
        });
      } else {
        html += '<p class="profile-hint">Agrega al menos un familiar para esta enfermedad.</p>';
      }
      html +=
        '</div><button type="button" class="btn-add-row" data-ahf-add-relative="' +
        esc(cid) +
        '">+ Agregar familiar</button></details>';
    });
    html += '</div>';
  }

  html +=
    '<div class="field-group"><label>Notas adicionales</label>' +
    '<textarea rows="3" data-ahf-field="descripcionDetallada">' +
    esc(ahf.descripcionDetallada) +
    '</textarea></div></div>';

  return html;
}
