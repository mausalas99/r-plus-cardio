import { prefersReducedMotion } from './ui-motion.mjs';
import { consolidatedInnerTabButtonId, resolveConsolidatedTarget } from './expediente-tabs.mjs';
import { consolidatedInnerTabButtonId as mapConsolidatedId, granularInnerTabButtonId } from './ui-tab-motion-ids.mjs';

var resizeTimer = null;
var indicatorsReady = false;

function isTabVisible(tabEl) {
  if (!tabEl) return false;
  if (tabEl.offsetParent !== null) return true;
  var style = window.getComputedStyle(tabEl);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function ensureTabBarIndicator(barEl) {
  if (!barEl) return null;
  var pill = barEl.querySelector(':scope > .tab-bar-indicator');
  if (pill) return pill;
  pill = document.createElement('span');
  pill.className = 'tab-bar-indicator';
  pill.setAttribute('aria-hidden', 'true');
  barEl.insertBefore(pill, barEl.firstChild);
  return pill;
}

/** Ancho base CSS del indicador; el ancho real se logra con scaleX. */
export var TAB_INDICATOR_BASE_PX = 80;

/** Transform compuesto (translateX+scaleX): anima en GPU, sin layout por frame. */
export function tabIndicatorTransform(offsetPx, widthPx, basePx) {
  var base = basePx > 0 ? basePx : TAB_INDICATOR_BASE_PX;
  var x = Math.max(0, Number(offsetPx) || 0);
  var w = Math.max(0, Number(widthPx) || 0);
  return 'translateX(' + x + 'px) scaleX(' + w / base + ')';
}

export function syncTabBarIndicator(barEl, tabEl) {
  if (!barEl || !tabEl || !isTabVisible(tabEl)) {
    var pillHide = barEl && barEl.querySelector(':scope > .tab-bar-indicator');
    if (pillHide) pillHide.style.opacity = '0';
    return;
  }
  var pill = ensureTabBarIndicator(barEl);
  if (!pill) return;
  var barRect = barEl.getBoundingClientRect();
  var tabRect = tabEl.getBoundingClientRect();
  pill.style.transform = tabIndicatorTransform(tabRect.left - barRect.left, tabRect.width);
  pill.style.opacity = '1';
}

export function syncAppTabIndicator(tab) {
  if (tab === 'lan') tab = 'lab';
  var bar = document.getElementById('app-main-tablist');
  var btn = document.getElementById('apptab-' + tab);
  syncTabBarIndicator(bar, btn);
}

export function innerTabButtonId(tab, opts) {
  opts = opts || {};
  if (opts.consolidated) return mapConsolidatedId(tab);
  return granularInnerTabButtonId(tab);
}

function getExpedienteInnerTabBar() {
  return document.querySelector('.patient-expediente-classic > .exp-expediente-nav > .inner-tab-bar');
}

export function syncMedSubviewTabIndicator() {
  var bar = document.getElementById('med-subview-tabs-bar');
  if (!bar) return;
  var active = bar.querySelector('.inner-tab.active');
  syncTabBarIndicator(bar, active);
}

export function syncInnerTabIndicator(tab, opts) {
  opts = opts || {};
  var bar = getExpedienteInnerTabBar();
  var btnId =
    opts.consolidated && opts.settings
      ? consolidatedInnerTabButtonId(tab, opts.settings)
      : innerTabButtonId(tab, opts);
  var btn = document.getElementById(btnId);
  syncTabBarIndicator(bar, btn);
}

export function animateTabPanelEnter(panelEl) {
  if (!panelEl || prefersReducedMotion()) return;
  if (document.documentElement.classList.contains('motion-sobrio')) return;
  panelEl.classList.remove('tab-panel-enter', 'app-tab-panel-enter');
  panelEl.classList.add('tab-panel-enter');
  function onEnd() {
    panelEl.removeEventListener('animationend', onEnd);
    panelEl.classList.remove('tab-panel-enter');
  }
  panelEl.addEventListener('animationend', onEnd);
}

/** Hide a main tab panel without display:none (avoids full layout on Expediente ↔ Med). */
export const APP_TAB_PANEL_HIDDEN_CLASS = 'app-tab-panel-hidden';

function shouldAnimateAppTabPanel() {
  if (prefersReducedMotion()) return false;
  return !document.documentElement.classList.contains('motion-sobrio');
}

export function showAppTabPanel(panelEl, animate) {
  if (!panelEl) return;
  panelEl.classList.remove(APP_TAB_PANEL_HIDDEN_CLASS);
  panelEl.style.display = 'flex';
  panelEl.style.flex = '1';
  panelEl.style.overflow = 'hidden';
  panelEl.style.minHeight = '0';
  if (!animate || !shouldAnimateAppTabPanel()) return;
  var id = panelEl.id ? String(panelEl.id) : '';
  var enterClass = id.startsWith('appcontent-') ? 'app-tab-panel-enter' : 'tab-panel-enter';
  panelEl.classList.remove('app-tab-panel-enter', 'tab-panel-enter');
  panelEl.classList.add(enterClass);
  function onEnd() {
    panelEl.removeEventListener('animationend', onEnd);
    panelEl.classList.remove(enterClass);
  }
  panelEl.addEventListener('animationend', onEnd);
}

export function hideAppTabPanel(panelEl) {
  if (!panelEl) return;
  panelEl.classList.add(APP_TAB_PANEL_HIDDEN_CLASS);
  panelEl.classList.remove('tab-panel-enter', 'app-tab-panel-enter');
}

export function syncSubTabBarIndicator(barEl) {
  if (!barEl) return;
  var active =
    barEl.querySelector('.exp-segment-btn.active') ||
    barEl.querySelector('.manejo-subtab.manejo-subtab--active') ||
    barEl.querySelector('.manejo-subtab.active') ||
    barEl.querySelector('[aria-selected="true"]');
  syncTabBarIndicator(barEl, active);
}

export function syncAllSubTabIndicators() {
  document.querySelectorAll('.exp-segment-bar, .manejo-subtabs, .rpc-subtab-bar').forEach(function (bar) {
    if (bar.offsetParent === null && window.getComputedStyle(bar).display === 'none') return;
    syncSubTabBarIndicator(bar);
  });
}

/** Solo la barra de segmento activa (evita layout de todas las barras en cada clic). */
export function syncExpedienteSegmentIndicators(settings, granularTab) {
  var target = resolveConsolidatedTarget(granularTab, settings || {});
  if (target.tab === 'clinico') {
    syncSubTabBarIndicator(document.getElementById('exp-segment-clinico'));
    if (target.section === 'manejo') {
      syncSubTabBarIndicator(document.querySelector('.manejo-subtabs'));
    }
  } else if (target.tab === 'resultados') {
    syncSubTabBarIndicator(document.getElementById('exp-segment-resultados'));
  } else if (target.tab === 'salida') {
    syncSubTabBarIndicator(document.getElementById('exp-segment-salida'));
  }
}

function scheduleIndicatorSync() {
  var appTab = getActiveAppTabFromDom();
  syncAppTabIndicator(appTab);
  if (appTab === 'med') {
    syncMedSubviewTabIndicator();
    return;
  }
  if (isConsolidatedExpedienteTabsVisible()) {
    var bar = getExpedienteInnerTabBar();
    var conTabs = document.querySelectorAll('.exp-consolidated-tab');
    for (var i = 0; i < conTabs.length; i++) {
      if (conTabs[i].classList.contains('active')) {
        syncTabBarIndicator(bar, conTabs[i]);
        syncAllSubTabIndicators();
        return;
      }
    }
  }
  syncInnerTabIndicator(getActiveInnerTabFromDom());
  syncAllSubTabIndicators();
}

function getActiveAppTabFromDom() {
  var tabs = ['lab', 'nota', 'med', 'agenda'];
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.getElementById('apptab-' + tabs[i]);
    if (btn && btn.classList.contains('active')) return tabs[i];
  }
  return 'lab';
}

function isConsolidatedExpedienteTabsVisible() {
  var first = document.querySelector('.exp-consolidated-tab');
  return !!(first && first.style.display !== 'none');
}

function getActiveInnerTabFromDom() {
  if (isConsolidatedExpedienteTabsVisible()) {
    var conTabs = document.querySelectorAll('.exp-consolidated-tab');
    for (var c = 0; c < conTabs.length; c++) {
      if (conTabs[c].classList.contains('active')) return conTabs[c].id.replace(/^itab-/, '');
    }
  }
  var ids = ['datos', 'notas', 'indica', 'tend', 'cult', 'listado', 'todo', 'manejo', 'recetaHu'];
  for (var i = 0; i < ids.length; i++) {
    var btn = document.getElementById(innerTabButtonId(ids[i]));
    if (btn && btn.classList.contains('active')) return ids[i];
  }
  return 'todo';
}

export function initTabBarMotion() {
  if (indicatorsReady) {
    scheduleIndicatorSync();
    return;
  }
  ensureTabBarIndicator(document.getElementById('app-main-tablist'));
  ensureTabBarIndicator(getExpedienteInnerTabBar());
  ensureTabBarIndicator(document.getElementById('med-subview-tabs-bar'));
  document.querySelectorAll('.exp-segment-bar, .manejo-subtabs, .rpc-subtab-bar').forEach(function (bar) {
    ensureTabBarIndicator(bar);
  });
  document.documentElement.classList.add('tab-bar-indicators-ready');
  indicatorsReady = true;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleIndicatorSync, 100);
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(scheduleIndicatorSync);
  });
}
