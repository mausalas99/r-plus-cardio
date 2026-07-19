/**
 * Expediente inner-tab navigation (nota sub-tabs).
 */
import {
  isPaseMode,
  getUiDensity,
  setUiDensity,
  markOpenedDetailFromPaseBoard,
} from './chrome.mjs';
import { isModeSala } from '../mode-features.mjs';
import {
  invalidateHistoriaClinicaPanel,
} from './historia-clinica-panel.mjs';
import { invalidateEventualidadesPanel } from './eventualidades-panel.mjs';
import { eaHasCopyableContent, invalidateEaPanelCache, syncEaCopyFab } from './estado-actual-panel.mjs';
import { renderEstadoActualBar } from './soap-estado.mjs';
import {
  scrollActiveRondaCardIntoView,
  setRoundOverviewMode,
  syncRoundExpedienteLayout,
} from './patients.mjs';
import {
  animateTabPanelEnter,
  initTabBarMotion,
  syncInnerTabIndicator,
  syncExpedienteSegmentIndicators,
  syncAllSubTabIndicators,
} from '../ui-tab-motion.mjs';
import {
  applyExpedientePaneLayout,
  consolidatedInnerTabButtonId,
  defaultGranularForConsolidatedTab,
  isClinicoCompositeVisible,
  migrateGranularInner,
  resetExpedientePaneLayoutCache,
  syncConsolidatedPaneVisibility,
  syncConsolidatedSegmentBars,
} from '../expediente-tabs.mjs';
import { wirePatientDatosModalOnce } from '../patient-datos-modal.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import {
  renderExpedienteGroupRow,
  wireGroupRowBreakpointResync,
} from './expediente-group-row-ui.mjs';
import { syncHeaderContext } from './header-context.mjs';
import { cancelDeferredIdleWork, scheduleAfterPaint } from '../deferred-work.mjs';
import { rt } from './pase-board-runtime.mjs';
import { renderPaseBoard } from './pase-board-render.mjs';
import { switchAppTab } from './pase-board-app-tabs.mjs';
import { invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';
import {
  cancelExpedienteWarm,
  warmExpedienteHeavyTabs,
  initExpedienteTabPreload,
  invalidateInnerTabRenderCache,
  renderGranularInnerTab,
  syncConsolidatedInnerTabButtons,
  isInnerTabContentFresh,
  granularMountIsEmpty,
  expedienteCompositeTab,
  syncInnerTabVisualOnly,
} from './pase-board-inner-cache.mjs';

const PASE_SECTION_ROUTES = {
  labs: { app: 'lab' },
  lab: { app: 'lab' },
  pendientes: { app: 'nota', inner: 'todo' },
  todo: { app: 'nota', inner: 'todo' },
  agenda: { app: 'agenda' },
  cultivos: { app: 'nota', inner: 'cult' },
  cult: { app: 'nota', inner: 'cult' },
  tend: { app: 'nota', inner: 'tend' },
  tendencias: { app: 'nota', inner: 'tend' },
  med: { app: 'med' },
  medicamentos: { app: 'med' },
  recetahu: { app: 'nota', inner: 'recetaHu' },
  'receta-hu': { app: 'nota', inner: 'recetaHu' },
  receta_hu: { app: 'nota', inner: 'recetaHu' },
  expediente: { app: 'nota', inner: 'notas' },
  nota: { app: 'nota', inner: 'notas' },
};

function navigatePaseSection(route) {
  switchAppTab(route.app);
  if (route.inner) switchInnerTab(route.inner);
}

export function openPaseSectionInNormal(which) {
  var w = String(which || '').toLowerCase();
  var wasPase = isPaseMode();
  if (getUiDensity() !== 'normal') {
    setUiDensity('normal');
  }
  if (wasPase) markOpenedDetailFromPaseBoard();
  var route = PASE_SECTION_ROUTES[w] || PASE_SECTION_ROUTES.nota;
  navigatePaseSection(route);
  if (getUiDensity() === 'normal') {
    requestAnimationFrame(function () {
      scrollActiveRondaCardIntoView();
    });
  }
}

/** Tras cambiar Sala ↔ Interconsulta: remonta pestañas del expediente y repinta contenido. */
export function refreshExpedienteForAppModeChange() {
  cancelExpedienteWarm();
  cancelDeferredIdleWork();
  invalidatePaseBoardCache();
  invalidateEaPanelCache();
  invalidateHistoriaClinicaPanel();
  invalidateEventualidadesPanel();
  invalidateInnerTabRenderCache();
  var settings = rt.getSettings();
  var tab = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  if (tab !== rt.getActiveInner()) rt.setActiveInner(tab);
  resetExpedientePaneLayoutCache();
  renderInnerTabs();
  syncInnerTabVisualOnly();
}

/** Tras cambiar de paciente: repinta solo la pestaña interna activa (sin reset de layout). */
export function refreshExpedienteAfterPatientSelect(opts) {
  opts = opts || {};
  cancelExpedienteWarm();
  cancelDeferredIdleWork();
  invalidatePaseBoardCache();
  invalidateEaPanelCache();
  invalidateHistoriaClinicaPanel();
  var settings = rt.getSettings();
  var tab = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  var forceRender = !!opts.patientChanged || granularMountIsEmpty(tab);
  if (forceRender || !isInnerTabContentFresh(tab, settings)) {
    renderGranularInnerTab(tab, forceRender ? { force: true } : undefined);
  }
  warmExpedienteHeavyTabs();
}

export function switchConsolidatedTab(compositeTab) {
  var settings = rt.getSettings();
  if (compositeTab === "clinico" && !isClinicoCompositeVisible(settings)) {
    compositeTab = "paciente";
  }
  var current = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  var currentComposite = consolidatedInnerTabButtonId(current, settings).replace(/^itab-/, "");
  var targetGranular = defaultGranularForConsolidatedTab(compositeTab, settings);
  if (currentComposite === compositeTab) {
    if (compositeTab === "clinico" && current !== targetGranular) {
      switchInnerTab(targetGranular);
      return;
    }
    syncConsolidatedInnerTabButtons(current, settings);
    syncConsolidatedPaneVisibility(current, settings);
    syncConsolidatedSegmentBars(current, settings);
    renderExpedienteGroupRow(current, settings);
    syncInnerTabIndicator(current, { consolidated: true, settings: settings });
    if (granularMountIsEmpty(current)) {
      renderGranularInnerTab(current, { force: true });
    }
    return;
  }
  switchInnerTab(targetGranular);
}

var EXPEDIENTE_INNER_TABS = {
  datos: 1,
  notas: 1,
  indica: 1,
  tend: 1,
  cult: 1,
  listado: 1,
  todo: 1,
  historia: 1,
  estadoActual: 1,
  eventualidades: 1,
  recetaHu: 1,
};

function isExpedienteInnerTab(tab) {
  return !!EXPEDIENTE_INNER_TABS[tab];
}

function tryPaseRecetaRedirect(tab) {
  if (!isExpedienteInnerTab(tab) || !isPaseMode() || getUiDensity() === 'normal') return false;
  if (tab !== 'recetaHu') return false;
  openPaseSectionInNormal('recetaHu');
  return true;
}

function ensureNotaAppTabForInner(tab) {
  if (isExpedienteInnerTab(tab) && rt.getActiveAppTab() !== 'nota') {
    switchAppTab('nota');
  }
}

function scheduleInnerTabPaint(tab, settings, opts, prevInner, prevComposite, nextComposite) {
  var needsContentRender =
    (prevInner !== tab || opts.forceRender) &&
    (opts.forceRender || !isInnerTabContentFresh(tab, settings));
  if (needsContentRender) {
    var targetTab = tab;
    var forceRender = !!opts.forceRender;
    if (prevInner !== tab && prevComposite !== nextComposite) {
      var panelEl = document.getElementById(
        'itab-content-' + consolidatedInnerTabButtonId(tab, settings).replace(/^itab-/, '')
      );
      animateTabPanelEnter(panelEl);
    }
    if (prevInner !== tab) {
      syncExpedienteSegmentIndicators(settings, tab);
    }
    scheduleAfterPaint(function () {
      if (migrateGranularInner(rt.getActiveInner() || 'todo', settings) !== targetTab) return;
      renderGranularInnerTab(targetTab, forceRender ? { force: true } : undefined);
      syncExpedienteSegmentIndicators(settings, targetTab);
      syncInnerTabIndicator(targetTab, { consolidated: true, settings: settings });
    });
    return;
  }
  if (prevInner !== tab) {
    syncExpedienteSegmentIndicators(settings, tab);
    return;
  }
  if (granularMountIsEmpty(tab)) {
    scheduleAfterPaint(function () {
      if (migrateGranularInner(rt.getActiveInner() || 'todo', settings) !== tab) return;
      invalidateInnerTabRenderCache(tab);
      renderGranularInnerTab(tab, { force: true });
      syncExpedienteSegmentIndicators(settings, tab);
    });
  }
}

export function switchInnerTab(tab, opts) {
  opts = opts || {};
  cancelExpedienteWarm();
  cancelDeferredIdleWork();
  var settings = rt.getSettings();
  tab = migrateGranularInner(tab, settings);
  var prevInner = migrateGranularInner(rt.getActiveInner() || 'todo', settings);
  if (tab === 'estadoActual') syncEaCopyFab(eaHasCopyableContent());
  else if (prevInner === 'estadoActual') syncEaCopyFab(false);
  var prevComposite = expedienteCompositeTab(prevInner, settings);
  var nextComposite = expedienteCompositeTab(tab, settings);
  if (tryPaseRecetaRedirect(tab)) return;
  ensureNotaAppTabForInner(tab);
  if (isPaseMode() && rt.getActiveAppTab() === 'nota' && !opts.preserveRoundOverview) {
    setRoundOverviewMode(false);
  }
  rt.setActiveInner(tab);
  syncConsolidatedInnerTabButtons(tab, settings);
  syncConsolidatedPaneVisibility(tab, settings, opts);
  syncConsolidatedSegmentBars(tab, settings);
  renderExpedienteGroupRow(tab, settings);
  syncHeaderContext(rt);
  if (granularMountIsEmpty(tab)) {
    opts.forceRender = true;
    invalidateInnerTabRenderCache(tab);
  }
  scheduleInnerTabPaint(tab, settings, opts, prevInner, prevComposite, nextComposite);
  if (prevInner !== tab && isModeSala(settings) && (tab === 'estadoActual' || tab === 'tend')) {
    warmExpedienteHeavyTabs();
  }
  syncRoundExpedienteLayout();
  syncInnerTabIndicator(tab, { consolidated: true, settings: settings });
}

export function renderInnerTabs() {
  var settings = rt.getSettings();
  var sala = isModeSala(settings);
  function show(id, visible) {
    var el = document.getElementById(id);
    if (el) el.style.display = visible ? "" : "none";
  }
  function setOrder(id, order) {
    var el = document.getElementById(id);
    if (el) el.style.order = String(order);
  }
  resetExpedientePaneLayoutCache();
  document.querySelectorAll(".exp-consolidated-tab").forEach(function (el) {
    var hideSalida = isMobileWeb() && el.id === "itab-salida";
    el.style.display = !hideSalida ? "" : "none";
  });
  applyExpedientePaneLayout(settings);

  var showClinico = isClinicoCompositeVisible(settings);
  show("itab-clinico", showClinico);
  var clinicoPane = document.getElementById("itab-content-clinico");
  if (clinicoPane) clinicoPane.hidden = !showClinico;
  var order = 1;
  setOrder("itab-paciente", order++);
  if (showClinico) setOrder("itab-clinico", order++);
  setOrder("itab-resultados", order++);
  if (sala && !isMobileWeb()) setOrder("itab-salida", order++);
  show("itab-salida", sala && !isMobileWeb());
  wirePatientDatosModalOnce();
  wireGroupRowBreakpointResync(syncInnerTabVisualOnly);
  var activeInner = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  if (activeInner !== rt.getActiveInner()) rt.setActiveInner(activeInner);
  syncInnerTabVisualOnly();
  invalidateInnerTabRenderCache();
  renderGranularInnerTab(activeInner, { force: true });

  renderEstadoActualBar();
  var active = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  syncInnerTabIndicator(active, { consolidated: true, settings: settings });
  syncAllSubTabIndicators();
  initExpedienteTabPreload();
}

export function getActiveInnerTab() {
  var v = rt.getActiveInner();
  return v || null;
}

export const windowHandlers = {
  switchAppTab,
  openPaseSectionInNormal,
  renderPaseBoard,
  switchInnerTab,
  switchConsolidatedTab,
  initTabBarMotion,
};
