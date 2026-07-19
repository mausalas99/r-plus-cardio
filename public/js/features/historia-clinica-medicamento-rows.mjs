import {
  newMedicamentoRowId,
  normalizeMedicamentosList,
} from '../../../lib/historia-clinica/medicamento-entry.mjs';

import { esc } from '../dom-escape.mjs';
function emptyHint(text) {
  return '<p class="hc-empty-hint">' + esc(text) + '</p>';
}

/** @param {object} m @param {number} i @param {(m: object) => boolean} isReadOnly @param {boolean} canRemove */
function renderMedicamentoRowHtml(m, i, isReadOnly, canRemove) {
  const linked = isReadOnly(m);
  const ro = linked ? ' readonly tabindex="-1" title="No editable en este bloque"' : '';
  const tag = linked ? ' <span class="hc-tag">Vinculado</span>' : '';
  return (
    '<div class="hc-entry-row' +
    (linked ? ' hc-entry-row--linked' : '') +
    '" data-medicamento-idx="' +
    i +
    '">' +
    '<div class="field-group"><label>Medicamento' +
    tag +
    '</label>' +
    '<input type="text" data-med-field="medication" value="' +
    esc(m.medication || '') +
    '" placeholder="Nombre genérico o comercial"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Vía de administración</label>' +
    '<input type="text" data-med-field="route" value="' +
    esc(m.route || '') +
    '" placeholder="VO, IV, SC, inhalada…"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Dosis</label>' +
    '<input type="text" data-med-field="dosage" value="' +
    esc(m.dosage || '') +
    '" placeholder="ej. 850 mg"' +
    ro +
    '></div>' +
    '<div class="field-group"><label>Frecuencia</label>' +
    '<input type="text" data-med-field="frequency" value="' +
    esc(m.frequency || '') +
    '" placeholder="ej. c/12 h"' +
    ro +
    '></div>' +
    (canRemove && !linked
      ? '<button type="button" class="btn-remove" data-medicamento-remove="' +
        i +
        '" aria-label="Quitar">×</button>'
      : '') +
    '</div>'
  );
}

/** @param {Array<object>} list @param {{ emptyHint?: string, addLabel?: string, allowRemove?: boolean, readOnlyFilter?: (m: object) => boolean }} opts */
function buildMedicamentoRowsHtml(list, opts) {
  const emptyText =
    opts.emptyHint || 'Medicamento, vía, dosis y frecuencia de cada fármaco activo.';
  const canRemove = opts.allowRemove !== false;
  const isReadOnly =
    typeof opts.readOnlyFilter === 'function'
      ? opts.readOnlyFilter
      : function () {
          return false;
        };
  let html = '<div class="hc-medicamentos-list">';
  if (!list.length) {
    html += emptyHint(emptyText);
  } else {
    html += list.map((m, i) => renderMedicamentoRowHtml(m, i, isReadOnly, canRemove)).join('');
  }
  html += '</div>';
  html +=
    '<button type="button" class="btn-add-row hc-medicamentos-add">' +
    esc(opts.addLabel || '+ Agregar medicamento') +
    '</button>';
  return { html, isReadOnly, canRemove };
}

/** @param {HTMLElement} host @param {Array<object>} list @param {object} opts */
function wireMedicamentoRowEvents(host, list, opts) {
  const isReadOnly =
    typeof opts.readOnlyFilter === 'function'
      ? opts.readOnlyFilter
      : function () {
          return false;
        };

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
    opts.onChange(normalizeMedicamentosList(next));
  }

  function rerender() {
    mountMedicamentoRows(host, Object.assign({}, opts, { list: list }));
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
      rerender();
      emit();
    };
  });

  const addBtn = host.querySelector('.hc-medicamentos-add');
  if (addBtn) {
    addBtn.onclick = function () {
      list.push({
        id: newMedicamentoRowId('med'),
        medication: '',
        route: '',
        dosage: '',
        frequency: '',
      });
      rerender();
      emit();
      const rows = host.querySelectorAll('[data-medicamento-idx]');
      const last = rows[rows.length - 1];
      const med = last && last.querySelector('[data-med-field="medication"]');
      if (med) med.focus();
    };
  }
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   list: Array<object>,
 *   onChange: (list: Array<object>) => void,
 *   emptyHint?: string,
 *   addLabel?: string,
 *   allowRemove?: boolean,
 *   readOnlyFilter?: (m: object) => boolean,
 * }} opts
 */
export function mountMedicamentoRows(host, opts) {
  if (!host) return;
  opts = opts || {};
  const list = normalizeMedicamentosList(opts.list);
  const built = buildMedicamentoRowsHtml(list, opts);
  host.innerHTML = built.html;
  wireMedicamentoRowEvents(host, list, opts);
}
