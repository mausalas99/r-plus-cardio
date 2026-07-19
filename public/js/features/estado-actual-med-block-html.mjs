import { EA_MED_FIELD_LABELS, parseMedFieldItems } from './estado-actual-med-ui.mjs';
import { buildMedDropdownOptions, resolveManejoFechaActualizacion } from './estado-actual-meds.mjs';
import { advanceAbxMedTextForManejoDate, classifyMedicationSoapCategory } from '../med-receta-core.mjs';

import { escHtml, escAttr } from '../dom-escape.mjs';
function medCatPreviewText(items) {
  if (!items.length) return 'Sin medicamentos';
  const short = String(items[0] || '').trim();
  if (items.length === 1) return short || '—';
  return short + ' (+' + (items.length - 1) + ')';
}

function displayAbxLine(text, activeId, medRecetaByPatient) {
  const fecha = resolveManejoFechaActualizacion(activeId, medRecetaByPatient);
  if (!fecha || !text) return text;
  return advanceAbxMedTextForManejoDate(String(text), fecha);
}

function buildMedCategoryBadge(pendingVal, monitoreo, key, items) {
  if (pendingVal) return '<span class="ea-pendiente-badge">Propuesta</span>';
  if (monitoreo.confirmado && monitoreo.confirmado[key] && items.length) {
    return '<span class="ea-confirmed-badge">Confirmado</span>';
  }
  return '';
}

function buildMedCategoryItemsHtml(key, items) {
  return items
    .map(function (item, idx) {
      return (
        '<details class="ea-med-item">' +
        '<summary class="ea-med-item-summary">' +
        '<span class="ea-med-item-text">' + escHtml(item) + '</span>' +
        '<button type="button" class="ea-btn ea-btn--icon ea-med-item-remove" data-ea-med-remove="' + escAttr(key) +
        '" data-ea-med-idx="' + idx + '" aria-label="Quitar medicamento">×</button>' +
        '</summary></details>'
      );
    })
    .join('');
}

function buildMedCategoryPendingHtml(key, pendingVal) {
  if (!pendingVal) return '';
  return (
    '<div class="ea-med-pending">' +
    '<div class="ea-pendiente-preview" title="Propuesta pendiente">' + escHtml(pendingVal) + '</div>' +
    '<div class="ea-clinico-med-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" onclick="confirmEaMedField(\'' + key + '\')">Confirmar</button>' +
    '<button type="button" class="ea-btn ea-btn--ghost" onclick="discardEaMedProposal(\'' + key + '\')">Descartar</button>' +
    '</div></div>'
  );
}

/**
 * @param {string} key
 * @param {object} monitoreo
 * @param {string|null} activeId
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 */
export function buildMedCategoryBlockHtml(key, monitoreo, activeId, medRecetaByPatient) {
  const ec = monitoreo.estadoClinico || {};
  const pend = monitoreo.pendienteReceta || {};
  let items = parseMedFieldItems(ec[key]);
  let pendingVal = pend[key] != null ? String(pend[key]).trim() : '';
  if (key === 'abx') {
    items = items.map((line) => displayAbxLine(line, activeId, medRecetaByPatient));
    if (pendingVal) pendingVal = displayAbxLine(pendingVal, activeId, medRecetaByPatient);
  }
  const label = EA_MED_FIELD_LABELS[key] || key;
  const options = buildMedDropdownOptions(activeId, key, medRecetaByPatient, classifyMedicationSoapCategory);
  const selectOpts =
    '<option value="">+ Desde receta…</option>' +
    options.map((opt) => '<option value="' + escAttr(opt.value) + '">' + escHtml(opt.label) + '</option>').join('');
  const badge = buildMedCategoryBadge(pendingVal, monitoreo, key, items);
  const itemsHtml = buildMedCategoryItemsHtml(key, items);
  const pendingBlock = buildMedCategoryPendingHtml(key, pendingVal);
  const openAttr = items.length || pendingVal ? ' open' : '';

  return (
    '<details class="ea-med-cat" data-ea-med-cat="' + escAttr(key) + '"' + openAttr + '>' +
    '<summary class="ea-med-cat-summary">' +
    '<span class="ea-med-cat-title">' + escHtml(label) + '</span>' +
    '<span class="ea-med-cat-preview ea-muted">' + escHtml(medCatPreviewText(items)) + '</span>' +
    badge +
    '</summary>' +
    '<div class="ea-med-cat-body">' + pendingBlock +
    (itemsHtml ? '<div class="ea-med-item-list">' + itemsHtml + '</div>' : '') +
    '<div class="ea-med-add-row">' +
    '<select class="ea-input ea-med-add-select" data-ea-med-add-select="' + escAttr(key) + '">' + selectOpts + '</select>' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-med-manual-toggle" data-ea-med-manual-toggle="' + escAttr(key) + '">+ Manual</button>' +
    '</div>' +
    '<div class="ea-med-manual-panel" hidden data-ea-med-manual-panel="' + escAttr(key) + '">' +
    '<input type="text" class="ea-input" data-ea-med-manual-input="' + escAttr(key) + '" placeholder="Indicación manual">' +
    '<div class="ea-med-manual-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" data-ea-med-manual-save="' + escAttr(key) + '">Añadir</button>' +
    '<button type="button" class="ea-btn ea-btn--ghost" data-ea-med-manual-cancel="' + escAttr(key) + '">Cancelar</button>' +
    '</div></div></div></details>'
  );
}
