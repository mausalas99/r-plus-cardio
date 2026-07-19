import { createTendGroupModal } from '../tend-group-modal.mjs';
import { writeTendCardOrder } from '../tend-prefs.mjs';
import { guidedTourAdvanceAfter, getGuidedTourContext } from './settings-help/tour-flow.mjs';
import { loadChartJs } from '../vendor-loader.mjs';
import { isAbgAnalysisHidden } from './tendencias-lab-prefs.mjs';
import { aid, tendStore, esc } from './tendencias-state.mjs';
import { rt } from './tendencias-runtime-state.mjs';
import {
  tendParsedHistoryDesc,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendUnitForSeries,
  tendRefFromLabSet,
  tendRefForSeries,
  closeTendHiddenModal,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
} from './tendencias-series.mjs';
import { openTendDetail } from './tendencias-ui-detail.mjs';

var tendGroupModal = null;

export function closeTendGroupModal() {
  var ctx = getGuidedTourContext();
  var advanceTourAfterChart = ctx.active && ctx.stepId === 'sala_tend_chart';
  if (tendGroupModal) tendGroupModal.close();
  if (advanceTourAfterChart) guidedTourAdvanceAfter('sala_tend_chart');
}

var tendGroupModalInitPromise = null;

function initTendGroupModal() {
  if (tendGroupModal) return Promise.resolve(tendGroupModal);
  if (tendGroupModalInitPromise) return tendGroupModalInitPromise;
  tendGroupModalInitPromise = loadChartJs()
    .then(function (Chart) {
    if (tendGroupModal) return tendGroupModal;
    tendGroupModal = createTendGroupModal({
    onRequestClose: closeTendGroupModal,
    getActiveId: function () {
      return aid();
    },
    getHistory: function () {
      var pid = aid();
      return pid ? tendParsedHistoryDesc(pid) : [];
    },
    getSectionLabel: getTendSectionLabel,
    getCatalogSpecs: getTendCatalogSpecsForSection,
    buildMergedTrendSeriesCatalog: buildMergedTrendSeriesCatalog,
    tendUnitForSeries: tendUnitForSeries,
    tendRefFromLabSet: tendRefFromLabSet,
    tendRefForSeries: tendRefForSeries,
    buildColHeader: function (set) {
      return rt.buildLabSetDateLine(set);
    },
    esc: esc,
    Chart: Chart,
    showToast: function (a, b) {
      rt.showToast(a, b);
    },
  });
    return tendGroupModal;
  })
    .catch(function (err) {
      tendGroupModalInitPromise = null;
      console.error('[R+ Tendencias] tend-group Chart.js', err);
      rt.showToast('Gráfica no disponible (Chart.js no cargó). Recarga la app.', 'error');
      throw err;
    });
  return tendGroupModalInitPromise;
}

function openTendGroupModal(sectionKey) {
  void initTendGroupModal()
    .then(function (modal) {
      if (modal) modal.open(sectionKey);
    })
    .catch(function () {
      /* toast already shown in initTendGroupModal */
    });
}

function openTendGasoExtendedModal() {
  if (isAbgAnalysisHidden()) {
    rt.showToast('El análisis de gasometría no está disponible en R+.', 'info');
    return;
  }
  void initTendGroupModal().then(function (modal) {
    if (modal) modal.openGasoExtended();
  });
}

function setTendGroupTab(name) {
  initTendGroupModal();
  tendGroupModal.setTab(name);
}

function copyTendGroupTablePng() {
  initTendGroupModal();
  tendGroupModal.copyTablePng();
}

function copyTendGroupTableText() {
  initTendGroupModal();
  tendGroupModal.copyTableText();
}

function tendSectionChartSvg() {
  return (
    '<svg class="tend-section-chart-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 17l6-6 4 4 8-10"/>' +
    '<path d="M3 12l5-4 4 3 9-7"/>' +
    '</svg>'
  );
}

function destroyTendCardSortables() {
  tendStore._tendCardSortables.forEach(function (s) {
    try {
      if (s && typeof s.destroy === 'function') s.destroy();
    } catch (_e) { void _e; }
  });
  tendStore._tendCardSortables = [];
}

function syncTendCardOrderFromDom(sectionKey) {
  if (!aid() || !sectionKey) return;
  var zone = null;
  document.querySelectorAll('.tend-sort-zone[data-section-key]').forEach(function (el) {
    if (el.getAttribute('data-section-key') === sectionKey) zone = el;
  });
  if (!zone) return;
  var order = [];
  zone.querySelectorAll('.tend-card[data-series-key]').forEach(function (el) {
    var k = el.getAttribute('data-series-key');
    if (k) order.push(k);
  });
  if (order.length) writeTendCardOrder(aid(), sectionKey, order);
}

var _tendPointerDidDrag = false;
var TEND_CARD_DRAG_THRESHOLD_PX = 5;
var _tendenciasClickDelegationWired = false;
var _tendHiddenModalWired = false;

/** Modal «Analitos ocultos»: el panel usa stopPropagation; los clics deben escucharse en el panel, no en el backdrop. */
function ensureTendHiddenModalDelegation() {
  if (_tendHiddenModalWired) return;
  var hiddenBackdrop = document.getElementById('tend-hidden-modal-backdrop');
  if (!hiddenBackdrop) {
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureTendHiddenModalDelegation, {
        once: true,
      });
    }
    return;
  }
  _tendHiddenModalWired = true;
  hiddenBackdrop.addEventListener('click', onTendHiddenBackdropClick);
  var panel = hiddenBackdrop.querySelector('.tend-hidden-modal');
  if (panel) panel.addEventListener('click', onTendHiddenModalPanelClick);
  var resetBtn = hiddenBackdrop.querySelector('[data-tend-action="reset-hidden"]');
  if (!resetBtn) {
    resetBtn = hiddenBackdrop.querySelector('.modal-actions .btn-save');
    if (resetBtn) resetBtn.setAttribute('data-tend-action', 'reset-hidden');
  }
}

function onTendHiddenBackdropClick(ev) {
  if (ev.target === ev.currentTarget) closeTendHiddenModal();
}

function onTendHiddenModalPanelClick(ev) {
  var t = ev.target;
  if (!t || !t.closest) return;

  var resetBtn = t.closest('[data-tend-action="reset-hidden"]');
  if (resetBtn) {
    ev.preventDefault();
    tendResetAllHiddenSeries();
    return;
  }

  var chip = t.closest('.tend-hidden-chip');
  if (chip) {
    var seriesKey = chip.getAttribute('data-series-key');
    if (seriesKey) {
      var pipe = seriesKey.indexOf('|');
      if (pipe > 0) {
        ev.preventDefault();
        tendUnhideSeries(seriesKey.slice(0, pipe), seriesKey.slice(pipe + 1));
      }
    }
  }
}

/** Clics en Tendencias sin depender de onclick en window (módulos ES). */
function ensureTendenciasClickDelegation() {
  if (_tendenciasClickDelegationWired) return;
  var root = document.getElementById('tendencias-container');
  if (!root) {
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureTendenciasClickDelegation, {
        once: true,
      });
    }
    return;
  }
  _tendenciasClickDelegationWired = true;
  root.addEventListener('click', onTendenciasContainerClick);
}

function handleTendenciasToolbarClick(t, ev) {
  if (t.closest('.tend-toolbar-toggle')) {
    ev.preventDefault();
    toggleTendAbnormalOnlyFilter();
    return true;
  }
  if (t.closest('.tend-ocultos-trigger')) {
    ev.preventDefault();
    openTendHiddenModal();
    return true;
  }
  if (t.closest('[data-tend-action="gaso-extended"]')) {
    ev.preventDefault();
    openTendGasoExtendedModal();
    return true;
  }
  return false;
}

function handleTendenciasSectionClick(t, ev) {
  var sectionToggle = t.closest('.tend-section-toggle');
  if (sectionToggle) {
    var sectionEl = sectionToggle.closest('.tend-section');
    var sk = sectionEl && sectionEl.getAttribute('data-section');
    if (sk) toggleTendSection(ev, sk);
    return true;
  }
  var chartBtn = t.closest('.tend-section-chart-btn');
  if (chartBtn) {
    var sectionEl2 = chartBtn.closest('.tend-section');
    var sk2 = sectionEl2 && sectionEl2.getAttribute('data-section');
    if (sk2) openTendGroupModal(sk2);
    return true;
  }
  return false;
}

function handleTendenciasCardClick(t, ev) {
  var hideCardBtn = t.closest('.tend-card-hide-btn');
  if (hideCardBtn) {
    var hideCard = hideCardBtn.closest('.tend-card');
    var hideKey = hideCard && hideCard.getAttribute('data-series-key');
    if (hideKey) {
      var hidePipe = hideKey.indexOf('|');
      if (hidePipe > 0) {
        ev.preventDefault();
        ev.stopPropagation();
        tendHideSeriesFromCard(ev, hideKey.slice(0, hidePipe), hideKey.slice(hidePipe + 1));
      }
    }
    return true;
  }
  var card = t.closest('.tend-card');
  if (!card) return false;
  var key = card.getAttribute('data-series-key');
  if (!key) return false;
  var p = key.indexOf('|');
  if (p > 0) tendCardActivate(ev, key.slice(0, p), key.slice(p + 1));
  return true;
}

function onTendenciasContainerClick(ev) {
  var t = ev.target;
  if (!t || !t.closest) return;
  if (handleTendenciasToolbarClick(t, ev)) return;
  if (handleTendenciasSectionClick(t, ev)) return;
  handleTendenciasCardClick(t, ev);
}

function tendCardActivate(ev, sectionKey, fieldKey) {
  if (_tendPointerDidDrag) {
    _tendPointerDidDrag = false;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    return;
  }
  openTendDetail(sectionKey, fieldKey);
}

function findInsertInCardBounds(cards, clientX, clientY) {
  for (var i = 0; i < cards.length; i++) {
    var r = cards[i].getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
    if (clientX < r.left + r.width * 0.5) return cards[i];
    return cards[i + 1] || null;
  }
  return undefined;
}

function findInsertInRowGap(cards, clientX, clientY) {
  for (var i = 0; i < cards.length - 1; i++) {
    var ra = cards[i].getBoundingClientRect();
    var rb = cards[i + 1].getBoundingClientRect();
    var sameRow = Math.abs(ra.top - rb.top) < Math.min(ra.height, rb.height) * 0.45;
    if (!sameRow) continue;
    if (
      clientX > ra.right &&
      clientX < rb.left &&
      clientY >= Math.min(ra.top, rb.top) - 10 &&
      clientY <= Math.max(ra.bottom, rb.bottom) + 10
    ) {
      return cards[i + 1];
    }
  }
  return undefined;
}

function findTendInsertBeforeCard(cards, clientX, clientY) {
  var inBounds = findInsertInCardBounds(cards, clientX, clientY);
  if (inBounds !== undefined) return inBounds;
  var inGap = findInsertInRowGap(cards, clientX, clientY);
  if (inGap !== undefined) return inGap;
  for (var i = 0; i < cards.length; i++) {
    var rj = cards[i].getBoundingClientRect();
    if (clientY < rj.top + rj.height * 0.5) return cards[i];
  }
  return null;
}

function tendDragBeginVisuals(state) {
  if (!state || state.ghost) return;
  var card = state.card;
  var rect = card.getBoundingClientRect();
  var ghost = card.cloneNode(true);
  ghost.classList.add('tend-drag-hovercard');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText =
    'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width +
    'px;height:' + rect.height + 'px;margin:0;box-sizing:border-box;pointer-events:none;z-index:10060;transition:none;opacity:1';
  document.body.appendChild(ghost);
  card.classList.add('tend-card--sort-source');
  state.ghost = ghost;
  state.offsetX = state.startX - rect.left;
  state.offsetY = state.startY - rect.top;
}

function tendDragClearState(state) {
  if (!state) return;
  if (state.ghost && state.ghost.parentNode) state.ghost.parentNode.removeChild(state.ghost);
  state.card.classList.remove('tend-card--sort-source');
  state.card.style.width = '';
  state.card.style.maxWidth = '';
}

function tendDragHandleMove(state, zone, scrollRoot, zoneCards, e) {
  if (!state || e.pointerId !== state.pointerId) return;
  var dx = e.clientX - state.startX;
  var dy = e.clientY - state.startY;
  if (!state.moved) {
    if (dx * dx + dy * dy < TEND_CARD_DRAG_THRESHOLD_PX * TEND_CARD_DRAG_THRESHOLD_PX) return;
    state.moved = true;
    tendDragBeginVisuals(state);
  }
  if (!state.ghost) return;
  state.ghost.style.left = e.clientX - state.offsetX + 'px';
  state.ghost.style.top = e.clientY - state.offsetY + 'px';
  var cards = zoneCards().filter(function (c) { return c !== state.card; });
  var before = cards.length ? findTendInsertBeforeCard(cards, e.clientX, e.clientY) : null;
  if (before) zone.insertBefore(state.card, before);
  else zone.appendChild(state.card);
  if (!scrollRoot) return;
  var sr = scrollRoot.getBoundingClientRect();
  if (e.clientY < sr.top + 54) scrollRoot.scrollTop -= 9;
  else if (e.clientY > sr.bottom - 54) scrollRoot.scrollTop += 9;
}

function tendDragHandleUp(state, zone, sectionKey, e, cleanup) {
  if (!state || e.pointerId !== state.pointerId) return;
  cleanup();
  if (state.moved) {
    syncTendCardOrderFromDom(sectionKey);
    _tendPointerDidDrag = true;
  }
  tendDragClearState(state);
}

function createTendCardDragState(zone, scrollRoot, sectionKey) {
  var state = null;
  function zoneCards() {
    return Array.prototype.slice.call(zone.children).filter(function (el) {
      return el.classList && el.classList.contains('tend-card') && el.hasAttribute('data-series-key');
    });
  }
  function cleanupListeners() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
  }
  function onPointerMove(e) {
    tendDragHandleMove(state, zone, scrollRoot, zoneCards, e);
  }
  function onPointerUp(e) {
    tendDragHandleUp(state, zone, sectionKey, e, cleanupListeners);
    state = null;
  }
  function onPointerDown(e) {
    if (state || e.button !== 0) return;
    if (e.target.closest('button, a[href], input, textarea, select')) return;
    var card = e.target.closest('.tend-card');
    if (!card || !zone.contains(card)) return;
    state = {
      card: card,
      ghost: null,
      pointerId: e.pointerId,
      offsetX: 0,
      offsetY: 0,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }
  zone.addEventListener('pointerdown', onPointerDown);
  return {
    destroy: function () {
      zone.removeEventListener('pointerdown', onPointerDown);
      cleanupListeners();
      if (state) tendDragClearState(state);
      state = null;
    },
  };
}

/** Arrastre por puntero (clon fixed): evita conflictos Sortable + grid/transform en Electron. */
function mountTendCardPointerSort(zone, sectionKey) {
  var scrollRoot = document.getElementById('tendencias-container');
  return createTendCardDragState(zone, scrollRoot, sectionKey);
}

function mountTendCardSortables() {
  destroyTendCardSortables();
  if (!aid()) return;
  document.querySelectorAll('.tend-sort-zone[data-section-key]').forEach(function (zone) {
    var sectionKey = zone.getAttribute('data-section-key');
    if (!sectionKey || !zone.querySelector('.tend-card')) return;
    tendStore._tendCardSortables.push(mountTendCardPointerSort(zone, sectionKey));
  });
}

function syncTendHiddenModalIfOpen() {
  var bd = document.getElementById('tend-hidden-modal-backdrop');
  if (bd && bd.classList.contains('open')) {
    refreshTendHiddenModalContent();
  }
}

export function isTendGroupModalOpen() {
  return !!(tendGroupModal && tendGroupModal.isOpen());
}

export {
  initTendGroupModal,
  openTendGroupModal,
  openTendGasoExtendedModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  tendSectionChartSvg,
  destroyTendCardSortables,
  syncTendCardOrderFromDom,
  ensureTendHiddenModalDelegation,
  ensureTendenciasClickDelegation,
  tendCardActivate,
  mountTendCardSortables,
  syncTendHiddenModalIfOpen,
};
