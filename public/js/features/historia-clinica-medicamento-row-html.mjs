import { newMedicamentoRowId, normalizeMedicamentosList } from '../../../lib/historia-clinica/medicamento-entry.mjs';

/** @param {object} m @param {number} i @param {boolean} linked @param {boolean} canRemove */
export function buildMedicamentoRowHtml(m, i, linked, canRemove) {
  const ro = linked ? ' readonly tabindex="-1" title="No editable en este bloque"' : '';
  const tag = linked ? ' <span class="hc-tag">Vinculado</span>' : '';
  return (
    '<div class="hc-entry-row' + (linked ? ' hc-entry-row--linked' : '') + '" data-medicamento-idx="' + i + '">' +
    '<div class="field-group"><label>Medicamento' + tag + '</label>' +
    '<input type="text" data-med-field="medication" value="' + esc(m.medication || '') + '" placeholder="Nombre genérico o comercial"' + ro + '></div>' +
    '<div class="field-group"><label>Vía de administración</label>' +
    '<input type="text" data-med-field="route" value="' + esc(m.route || '') + '" placeholder="VO, IV, SC, inhalada…"' + ro + '></div>' +
    '<div class="field-group"><label>Dosis</label>' +
    '<input type="text" data-med-field="dosage" value="' + esc(m.dosage || '') + '" placeholder="ej. 850 mg"' + ro + '></div>' +
    '<div class="field-group"><label>Frecuencia</label>' +
    '<input type="text" data-med-field="frequency" value="' + esc(m.frequency || '') + '" placeholder="ej. c/12 h"' + ro + '></div>' +
    (canRemove && !linked
      ? '<button type="button" class="btn-remove" data-medicamento-remove="' + i + '" aria-label="Quitar">×</button>'
      : '') +
    '</div>'
  );
}

/**
 * @param {HTMLElement} host
 * @param {Array<object>} list
 * @param {(list: Array<object>) => void} onChange
 * @param {(m: object) => boolean} isReadOnly
 */

import { esc } from '../dom-escape.mjs';
export function wireMedicamentoRowEvents(host, list, onChange, isReadOnly) {
  function emit() {
    const next = [];
    host.querySelectorAll('[data-medicamento-idx]').forEach(function (row) {
      const idx = Number(row.getAttribute('data-medicamento-idx'));
      const base = list[idx] || {};
      if (isReadOnly(base)) {
        next.push(base);
        return;
      }
      /** @type {Record<string, string>} */
      const m = { id: base.id || newMedicamentoRowId('med') };
      row.querySelectorAll('[data-med-field]').forEach(function (el) {
        m[el.getAttribute('data-med-field')] = el.value;
      });
      next.push(m);
    });
    onChange(normalizeMedicamentosList(next));
  }

  host.querySelectorAll('[data-med-field]').forEach(function (el) {
    el.addEventListener('input', function () {
      const row = el.closest('[data-medicamento-idx]');
      const idx = Number(row.getAttribute('data-medicamento-idx'));
      if (isReadOnly(list[idx])) return;
      emit();
    });
  });

  host.querySelectorAll('[data-medicamento-remove]').forEach(function (btn) {
    btn.onclick = function () {
      list.splice(Number(btn.getAttribute('data-medicamento-remove')), 1);
      emit();
      return true;
    };
  });
}
