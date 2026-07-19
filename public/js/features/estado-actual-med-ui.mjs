import { MED_FIELD_KEYS, ensureMonitoreo } from './estado-actual-data.mjs';
import { buildMedDropdownOptions, resolveManejoFechaActualizacion } from './estado-actual-meds.mjs';
import { handleMedGridClick } from './estado-actual-med-grid-click.mjs';
import { advanceAbxMedTextForManejoDate, classifyMedicationSoapCategory } from '../med-receta-core.mjs';

/** @type {Record<string, string>} */
export const EA_MED_FIELD_LABELS = {
  analgesia: 'Analgesia',
  antiemeticos: 'Antieméticos',
  sedacion: 'Sedación / delirium',
  antiepilepticos: 'Antiepilépticos',
  antiparkinsonianos: 'Antiparkinsonianos',
  antidotos: 'Antídotos',
  viaAerea: 'Vía aérea',
  abx: 'Antibióticos',
  transfusiones: 'Transfusiones',
  antihta: 'Antihipertensivos',
  diureticos: 'Diuréticos',
  antitromboticos: 'Tromboprofilaxis',
  anticoagulacion: 'Anticoagulación',
  antiarritmicos: 'Antiarrítmicos',
  estatinas: 'Estatinas',
  vasop: 'Vasopresores',
  nm: 'NM (soporte, crónicos, etc.)',
};

/**
 * @param {unknown} raw
 * @returns {string[]}
 */

import { escHtml, escAttr } from '../dom-escape.mjs';
export function parseMedFieldItems(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(' | ')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/**
 * @param {string[]} items
 * @returns {string}
 */
export function serializeMedFieldItems(items) {
  return (items || [])
    .map(function (s) {
      return String(s).trim();
    })
    .filter(Boolean)
    .join(' | ');
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {string} key
 * @param {string} text
 */
export function addMedFieldItem(monitoreo, key, text) {
  if (!monitoreo || !key || !text || !String(text).trim()) return;
  if (!monitoreo.estadoClinico || typeof monitoreo.estadoClinico !== 'object') {
    monitoreo.estadoClinico = {};
  }
  var items = parseMedFieldItems(/** @type {Record<string, unknown>} */ (monitoreo.estadoClinico)[key]);
  var next = String(text).trim();
  if (items.indexOf(next) === -1) items.push(next);
  /** @type {Record<string, string>} */ (monitoreo.estadoClinico)[key] = serializeMedFieldItems(items);
  if (!monitoreo.confirmado || typeof monitoreo.confirmado !== 'object') monitoreo.confirmado = {};
  /** @type {Record<string, boolean>} */ (monitoreo.confirmado)[key] = true;
  if (monitoreo.pendienteReceta && typeof monitoreo.pendienteReceta === 'object') {
    /** @type {Record<string, string>} */ (monitoreo.pendienteReceta)[key] = '';
  }
}

/**
 * @param {Record<string, unknown>} monitoreo
 * @param {string} key
 * @param {number} index
 */
export function removeMedFieldItem(monitoreo, key, index) {
  if (!monitoreo || !monitoreo.estadoClinico) return;
  var items = parseMedFieldItems(monitoreo.estadoClinico[key]);
  if (index < 0 || index >= items.length) return;
  items.splice(index, 1);
  monitoreo.estadoClinico[key] = serializeMedFieldItems(items);
  if (!monitoreo.confirmado) monitoreo.confirmado = {};
  monitoreo.confirmado[key] = items.length > 0;
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function medCatPreviewText(items) {
  if (!items.length) return 'Sin medicamentos';
  var first = items[0];
  var short = first.length > 52 ? first.slice(0, 49) + '…' : first;
  if (items.length === 1) return short;
  return short + ' (+' + (items.length - 1) + ')';
}

/**
 * @param {string} key
 * @param {ReturnType<typeof import('./estado-actual-data.mjs').emptyMonitoreo>} monitoreo
 * @param {string | null} activeId
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 * @returns {string}
 */
function displayAbxLine(text, activeId, medRecetaByPatient) {
  var fecha = resolveManejoFechaActualizacion(activeId, medRecetaByPatient);
  if (!fecha || !text) return text;
  return advanceAbxMedTextForManejoDate(String(text), fecha);
}

function prepareMedBlockData(key, monitoreo, activeId, medRecetaByPatient) {
  var ec = monitoreo.estadoClinico || {};
  var pend = monitoreo.pendienteReceta || {};
  var items = parseMedFieldItems(ec[key]);
  var pendingVal = pend[key] != null ? String(pend[key]).trim() : '';
  if (key === 'abx') {
    items = items.map(function (line) {
      return displayAbxLine(line, activeId, medRecetaByPatient);
    });
    if (pendingVal) pendingVal = displayAbxLine(pendingVal, activeId, medRecetaByPatient);
  }
  return { items: items, pendingVal: pendingVal };
}

function medCategoryBadgeHtml(pendingVal, monitoreo, key, items) {
  if (pendingVal) return '<span class="ea-pendiente-badge">Propuesta</span>';
  if (monitoreo.confirmado && monitoreo.confirmado[key] && items.length) {
    return '<span class="ea-confirmed-badge">Confirmado</span>';
  }
  return '';
}

function medSelectOptionsHtml(key, options) {
  return (
    '<option value="">+ Desde receta…</option>' +
    options
      .map(function (opt) {
        return '<option value="' + escAttr(opt.value) + '">' + escHtml(opt.label) + '</option>';
      })
      .join('')
  );
}

function medItemsListHtml(items, key) {
  return items
    .map(function (item, idx) {
      return (
        '<details class="ea-med-item">' +
        '<summary class="ea-med-item-summary">' +
        '<span class="ea-med-item-text">' +
        escHtml(item) +
        '</span>' +
        '<button type="button" class="ea-btn ea-btn--icon ea-med-item-remove" data-ea-med-remove="' +
        escAttr(key) +
        '" data-ea-med-idx="' +
        idx +
        '" aria-label="Quitar medicamento">×</button>' +
        '</summary></details>'
      );
    })
    .join('');
}

function medPendingBlockHtml(key, pendingVal) {
  if (!pendingVal) return '';
  return (
    '<div class="ea-med-pending">' +
    '<div class="ea-pendiente-preview" title="Propuesta pendiente">' +
    escHtml(pendingVal) +
    '</div>' +
    '<div class="ea-clinico-med-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" onclick="confirmEaMedField(\'' +
    key +
    '\')">Confirmar</button>' +
    '<button type="button" class="ea-btn ea-btn--ghost" onclick="discardEaMedProposal(\'' +
    key +
    '\')">Descartar</button>' +
    '</div></div>'
  );
}

function medManualPanelHtml(key) {
  return (
    '<div class="ea-med-manual-panel" hidden data-ea-med-manual-panel="' +
    escAttr(key) +
    '">' +
    '<input type="text" class="ea-input" data-ea-med-manual-input="' +
    escAttr(key) +
    '" placeholder="Indicación manual">' +
    '<div class="ea-med-manual-actions">' +
    '<button type="button" class="ea-btn ea-btn--success" data-ea-med-manual-save="' +
    escAttr(key) +
    '">Añadir</button>' +
    '<button type="button" class="ea-btn ea-btn--ghost" data-ea-med-manual-cancel="' +
    escAttr(key) +
    '">Cancelar</button>' +
    '</div></div>'
  );
}

export function renderMedCategoryBlock(key, monitoreo, activeId, medRecetaByPatient) {
  var block = prepareMedBlockData(key, monitoreo, activeId, medRecetaByPatient);
  var items = block.items;
  var pendingVal = block.pendingVal;
  var label = EA_MED_FIELD_LABELS[key] || key;
  var options = buildMedDropdownOptions(activeId, key, medRecetaByPatient, classifyMedicationSoapCategory);
  var itemsHtml = medItemsListHtml(items, key);
  var openAttr = items.length || pendingVal ? ' open' : '';

  return (
    '<details class="ea-med-cat" data-ea-med-cat="' +
    escAttr(key) +
    '"' +
    openAttr +
    '>' +
    '<summary class="ea-med-cat-summary">' +
    '<span class="ea-med-cat-title">' +
    escHtml(label) +
    '</span>' +
    '<span class="ea-med-cat-preview ea-muted">' +
    escHtml(medCatPreviewText(items)) +
    '</span>' +
    medCategoryBadgeHtml(pendingVal, monitoreo, key, items) +
    '</summary>' +
    '<div class="ea-med-cat-body">' +
    medPendingBlockHtml(key, pendingVal) +
    (itemsHtml ? '<div class="ea-med-item-list">' + itemsHtml + '</div>' : '') +
    '<div class="ea-med-add-row">' +
    '<select class="ea-input ea-med-add-select" data-ea-med-add-select="' +
    escAttr(key) +
    '">' +
    medSelectOptionsHtml(key, options) +
    '</select>' +
    '<button type="button" class="ea-btn ea-btn--ghost ea-med-manual-toggle" data-ea-med-manual-toggle="' +
    escAttr(key) +
    '">+ Manual</button>' +
    '</div>' +
    medManualPanelHtml(key) +
    '</div></details>'
  );
}

/**
 * @param {ReturnType<typeof import('./estado-actual-data.mjs').emptyMonitoreo>} monitoreo
 * @param {string | null} activeId
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 * @returns {string}
 */
export function renderMedCategoryGrid(monitoreo, activeId, medRecetaByPatient) {
  return MED_FIELD_KEYS.map(function (key) {
    return renderMedCategoryBlock(key, monitoreo, activeId, medRecetaByPatient);
  }).join('');
}

/**
 * @param {HTMLElement | null} mount
 * @param {string} key
 * @param {ReturnType<typeof import('./estado-actual-data.mjs').emptyMonitoreo>} monitoreo
 * @param {string | null} activeId
 * @param {Record<string, { items?: unknown[] }>} medRecetaByPatient
 */
export function refreshMedCategoryBlock(mount, key, monitoreo, activeId, medRecetaByPatient) {
  if (!mount || !key) return;
  var grid = mount.querySelector('.ea-clinico-med-grid');
  if (!grid) return;
  var existing = grid.querySelector('[data-ea-med-cat="' + key + '"]');
  var html = renderMedCategoryBlock(key, monitoreo, activeId, medRecetaByPatient);
  if (existing) {
    var wasOpen = existing.open;
    existing.outerHTML = html;
    var next = grid.querySelector('[data-ea-med-cat="' + key + '"]');
    if (next && (wasOpen || parseMedFieldItems(monitoreo.estadoClinico && monitoreo.estadoClinico[key]).length)) {
      next.open = true;
    }
  }
}

/**
 * @param {{ patient?: { monitoreo?: unknown }, monitoreo?: Record<string, unknown> }} ctx
 */
function liveMonitoreoFromCtx(ctx) {
  if (ctx.patient) {
    ensureMonitoreo(ctx.patient);
    return /** @type {Record<string, unknown>} */ (ctx.patient.monitoreo);
  }
  return ctx.monitoreo || {};
}

/**
 * @param {HTMLElement | null} mount
 * @param {{ monitoreo?: Record<string, unknown>, patient?: { monitoreo?: unknown }, medRecetaByPatient: Record<string, { items?: unknown[] }>, getActiveId(): string | null, saveState(): void, syncTextarea(): void }} ctx
 */
export function wireMedCategoryGrid(mount, ctx) {
  if (!mount) return;
  var grid = mount.querySelector('.ea-clinico-med-grid');
  if (!grid || grid.dataset.eaMedGridWired === '1') return;
  grid.dataset.eaMedGridWired = '1';

  grid.addEventListener('change', function (ev) {
    var target = /** @type {HTMLElement | null} */ (ev.target);
    if (!target) return;
    var addKey = target.getAttribute('data-ea-med-add-select');
    if (!addKey || !('value' in target) || !/** @type {HTMLSelectElement} */ (target).value) return;
    var val = String(/** @type {HTMLSelectElement} */ (target).value);
    var monitoreo = liveMonitoreoFromCtx(ctx);
    addMedFieldItem(monitoreo, addKey, val);
    /** @type {HTMLSelectElement} */ (target).value = '';
    ctx.saveState();
    ctx.syncTextarea();
    refreshMedCategoryBlock(mount, addKey, monitoreo, ctx.getActiveId(), ctx.medRecetaByPatient);
  });

  grid.addEventListener('click', function (ev) {
    handleMedGridClick(ev, grid, mount, ctx, liveMonitoreoFromCtx, function (blockMount, key, monitoreo) {
      refreshMedCategoryBlock(blockMount, key, monitoreo, ctx.getActiveId(), ctx.medRecetaByPatient);
    });
  });
}
