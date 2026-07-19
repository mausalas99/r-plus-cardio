import { HC_INTERROGADO_NEGADO } from '../../../lib/historia-clinica/defaults.mjs';
import { toClinicalHistoryText } from '../../../lib/historia-clinica/clinical-text.mjs';

export { HC_INTERROGADO_NEGADO };

/**
 * @param {object} value
 * @param {'pathology' | 'negado_default'} variant
 */
function readChecklistValue(value, variant) {
  const v = value || {};
  if (variant === 'pathology') {
    return {
      selectedIds: Array.isArray(v.conditions) ? v.conditions.slice() : [],
      detailText: v.descripcionDetallada || '',
      negado: false,
    };
  }
  const negado = v.negado !== false;
  const descripcion = v.descripcion || '';
  return {
    selectedIds: Array.isArray(v.checks) ? v.checks.slice() : [],
    detailText:
      descripcion ||
      (negado && !(v.checks && v.checks.length) ? HC_INTERROGADO_NEGADO : ''),
    negado,
  };
}

/**
 * @param {{ selectedIds: string[], detailText: string, negado?: boolean }} next
 * @param {'pathology' | 'negado_default'} variant
 */
function writeChecklistValue(next, variant) {
  if (variant === 'pathology') {
    return {
      conditions: next.selectedIds || [],
      descripcionDetallada: next.detailText || '',
    };
  }
  const hasChecks = (next.selectedIds || []).length > 0;
  const detail = String(next.detailText || '').trim();
  const isDefaultNegado =
    !hasChecks &&
    (!detail || detail.toLowerCase() === HC_INTERROGADO_NEGADO.toLowerCase());
  return {
    checks: next.selectedIds || [],
    descripcion: isDefaultNegado ? HC_INTERROGADO_NEGADO : next.detailText || '',
    negado: isDefaultNegado,
  };
}

/**
 * @param {HTMLElement} container
 * @param {{ id: string, variant?: 'pathology' | 'negado_default', options: Array<{id:string,label:string}> }} spec
 * @param {object} value
 * @param {(next: object) => void} onChange
 */
export function renderChecklistBlock(container, spec, value, onChange) {
  if (!container) return;
  const variant = spec.variant === 'pathology' ? 'pathology' : 'negado_default';
  const normalized = readChecklistValue(value, variant);
  const selected = new Set(normalized.selectedIds || []);
  const options = spec.options || [];

  let html =
    '<div class="hc-checklist-block" data-checklist-id="' + spec.id + '">';
  if (options.length) {
    html += '<div class="hc-checklist-options hc-checklist-options--grid">';
    options.forEach(function (opt) {
      const checked = selected.has(opt.id) ? ' checked' : '';
      html +=
        '<label class="hc-check-chip"><input type="checkbox" class="hc-check-chip-input" data-opt-id="' +
        opt.id +
        '"' +
        checked +
        '><span class="hc-check-chip-label">' +
        opt.label +
        '</span></label>';
    });
    html += '</div>';
  }
  html +=
    '<div class="field-group hc-checklist-detail-wrap"><label>Descripción</label>' +
    '<textarea class="hc-checklist-detail" rows="3" placeholder="' +
    (variant === 'negado_default' ? HC_INTERROGADO_NEGADO : 'Descripción detallada') +
    '">' +
    (normalized.detailText || '') +
    '</textarea></div></div>';

  container.innerHTML = html;

  function emit() {
    const nextIds = [];
    container.querySelectorAll('.hc-check-chip-input:checked').forEach(function (c) {
      const id = c.getAttribute('data-opt-id');
      if (id) nextIds.push(id);
    });
    const detailEl = container.querySelector('.hc-checklist-detail');
    const detailText = detailEl ? toClinicalHistoryText(detailEl.value) : '';
    if (detailEl && detailText !== detailEl.value) detailEl.value = detailText;
    const negado =
      variant === 'negado_default' &&
      nextIds.length === 0 &&
      (!String(detailText).trim() ||
        String(detailText).trim().toLowerCase() === HC_INTERROGADO_NEGADO.toLowerCase());
    onChange(
      writeChecklistValue(
        {
          selectedIds: nextIds,
          detailText:
            negado && variant === 'negado_default' ? HC_INTERROGADO_NEGADO : detailText,
          negado,
        },
        variant
      )
    );
  }

  container.querySelectorAll('.hc-check-chip-input').forEach(function (el) {
    el.onchange = emit;
  });

  const detail = container.querySelector('.hc-checklist-detail');
  if (detail) {
    detail.oninput = emit;
  }
}
