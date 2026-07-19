import {
  generoFieldSpecsForSex,
  normalizeGeneroBlock,
} from '../../../lib/historia-clinica/genero-options.mjs';
import { normalizeMedicamentosList } from '../../../lib/historia-clinica/medicamento-entry.mjs';
import { mountMedicamentoRows } from './historia-clinica-medicamento-rows.mjs';

import { esc } from '../dom-escape.mjs';
function ageBodyHtml(spec, val) {
  val = val && typeof val === 'object' ? val : {};
  return (
    '<input type="number" min="0" max="99" step="1" data-genero-part="edad" data-genero-id="' +
    esc(spec.id) +
    '" value="' +
    esc(val.edad || '') +
    '" placeholder="Edad en años">'
  );
}

function fumBodyHtml(spec, val) {
  val = val && typeof val === 'object' ? val : {};
  return (
    '<div class="hc-genero-inline">' +
    '<div class="field-group hc-genero-inline-field">' +
    '<label>FUM</label>' +
    '<input type="text" data-genero-part="fum" data-genero-id="' +
    esc(spec.id) +
    '" value="' +
    esc(val.fum || '') +
    '" placeholder="DD/MM/AA">' +
    '</div>' +
    '<div class="field-group hc-genero-inline-field">' +
    '<label>Ciclo</label>' +
    '<input type="text" data-genero-part="ciclo" data-genero-id="' +
    esc(spec.id) +
    '" value="' +
    esc(val.ciclo || '') +
    '" placeholder="Regular, 28 días…">' +
    '</div></div>'
  );
}

function gpacBodyHtml(spec, val) {
  val = val && typeof val === 'object' ? val : {};
  const cells = [
    ['g', 'Gestas (G)'],
    ['p', 'Partos (P)'],
    ['a', 'Abortos (A)'],
    ['c', 'Cesáreas (C)'],
  ];
  let html = '<div class="hc-genero-gpac">';
  cells.forEach(function (pair) {
    const key = pair[0];
    html +=
      '<div class="field-group hc-genero-gpac-cell">' +
      '<label>' +
      esc(pair[1]) +
      '</label>' +
      '<input type="number" min="0" max="99" step="1" data-genero-part="' +
      esc(key) +
      '" data-genero-id="' +
      esc(spec.id) +
      '" value="' +
      esc(val[key] || '') +
      '" placeholder="0">' +
      '</div>';
  });
  html +=
    '</div><div class="field-group hc-genero-gpac-notes">' +
    '<label>Notas adicionales</label>' +
    '<input type="text" data-genero-part="detalle" data-genero-id="' +
    esc(spec.id) +
    '" value="' +
    esc(val.detalle || '') +
    '" placeholder="Opcional">' +
    '</div>';
  return html;
}

function detailBodyHtml(spec, val) {
  val = val && typeof val === 'object' ? val : {};
  return (
    '<textarea rows="2" data-genero-part="detalle" data-genero-id="' +
    esc(spec.id) +
    '" placeholder="Describir si aplica…">' +
    esc(val.detalle || '') +
    '</textarea>'
  );
}

function bodyHtmlForSpec(spec, val) {
  switch (spec.kind) {
    case 'age':
      return ageBodyHtml(spec, val);
    case 'fum':
      return fumBodyHtml(spec, val);
    case 'gpac':
      return gpacBodyHtml(spec, val);
    case 'medications':
      return (
        '<div class="hc-genero-meds-host" data-genero-meds-id="' + esc(spec.id) + '"></div>'
      );
    case 'detail':
    default:
      return detailBodyHtml(spec, val);
  }
}

function readFieldFromDom(spec, row) {
  if (!row || spec.kind === 'medications') return {};
  const id = spec.id;
  /** @type {Record<string, string>} */
  const out = {};
  row.querySelectorAll('[data-genero-part][data-genero-id="' + id + '"]').forEach(function (el) {
    const part = el.getAttribute('data-genero-part');
    if (part) out[part] = el.value;
  });
  return out;
}

/**
 * @param {HTMLElement} container
 * @param {object} genero
 * @param {string | undefined} sexo
 * @param {(next: object) => void} onChange
 */
export function mountHistoriaGeneroPanel(container, genero, sexo, onChange) {
  if (!container) return;
  const specs = generoFieldSpecsForSex(sexo);
  genero = normalizeGeneroBlock(genero, sexo);
  /** @type {Record<string, Array<object>>} */
  const medsState = {};

  specs.forEach(function (spec) {
    if (spec.kind === 'medications') {
      const val = genero[spec.id] || {};
      medsState[spec.id] = normalizeMedicamentosList(val.medicamentos);
    }
  });

  let html = '<div class="hc-genero-panel">';
  specs.forEach(function (spec) {
    const val = genero[spec.id] || {};
    const full = spec.fullWidth ? ' hc-genero-field--full' : '';
    html +=
      '<div class="field-group hc-genero-field' +
      full +
      '" data-genero-field="' +
      esc(spec.id) +
      '">' +
      '<label>' +
      esc(spec.label) +
      '</label>' +
      bodyHtmlForSpec(spec, val) +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;

  function emit() {
    /** @type {Record<string, object>} */
    const next = {};
    specs.forEach(function (spec) {
      if (spec.kind === 'medications') {
        next[spec.id] = { medicamentos: medsState[spec.id] || [] };
        return;
      }
      const row = container.querySelector('[data-genero-field="' + spec.id + '"]');
      next[spec.id] = readFieldFromDom(spec, row);
    });
    onChange(normalizeGeneroBlock(next, sexo));
  }

  specs.forEach(function (spec) {
    if (spec.kind !== 'medications') return;
    const host = container.querySelector('[data-genero-meds-id="' + spec.id + '"]');
    if (!host) return;
    mountMedicamentoRows(host, {
      list: medsState[spec.id],
      addLabel: '+ Agregar anticonceptivo / TH',
      emptyHint: 'Medicamento, vía, dosis y frecuencia (anticonceptivos o terapia hormonal).',
      onChange: function (list) {
        medsState[spec.id] = list;
        emit();
      },
    });
  });

  container.querySelectorAll('[data-genero-part]').forEach(function (el) {
    el.addEventListener('input', emit);
  });
}
