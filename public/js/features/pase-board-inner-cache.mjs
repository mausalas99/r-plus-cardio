/**
 * Expediente inner-tab render cache, warm-up, and preload.
 */
import { isModeSala } from '../mode-features.mjs';
import { buildEaMonitoreoRevision } from './estado-actual-data.mjs';
import { medRecetaByPatient, patients } from '../app-state.mjs';
import { getLabHistoryRevision } from '../lab-history-cache.mjs';
import { scheduleIdle } from '../deferred-work.mjs';
import {
  consolidatedTabForGranular,
  consolidatedInnerTabButtonId,
  defaultGranularForConsolidatedTab,
  migrateGranularInner,
} from '../expediente-tabs.mjs';
import {
  renderEstadoActualPanel,
} from './estado-actual-panel.mjs';
import { renderVpo } from './vpo.mjs';
import { ensureChartsLoaded } from '../lazy-feature-routes.mjs';
import { renderNoteForm, renderIndicaForm } from './notes-indicaciones.mjs';
import {
  renderHistoriaClinicaPanel,
} from './historia-clinica-panel.mjs';
import { renderEventualidadesPanel } from './eventualidades-panel.mjs';
import { renderManejoPanel } from './cardio/manejo-panel.mjs';
import { renderIcHojaExportPanel } from './cardio/ic-hoja-export.mjs';
import {
  renderPatientDataPane,
  renderCultivosTable,
  renderListadoForm,
} from './expediente.mjs';
import { renderTodoForm } from './todos.mjs';
import { renderRecetaHu } from './receta-hu.mjs';
import { rt } from './pase-board-runtime.mjs';
import {
  syncConsolidatedPaneVisibility,
  syncConsolidatedSegmentBars,
} from '../expediente-tabs.mjs';
import { syncInnerTabIndicator } from '../ui-tab-motion.mjs';
import { renderExpedienteGroupRow } from './expediente-group-row-ui.mjs';

/** Evita re-render completo al volver a una pestaña ya pintada (mismo paciente). */
var innerTabRenderCache = Object.create(null);
var expedientePreloadTimer = null;
var expedientePreloadTab = null;
var expedienteTabPreloadWired = false;

export function invalidateInnerTabRenderCache(tab) {
  if (tab) {
    delete innerTabRenderCache[tab];
    return;
  }
  innerTabRenderCache = Object.create(null);
}

export function granularMountIsEmpty(tab) {
  if (tab === "estadoActual") {
    var ea = document.getElementById("exp-pane-estado-actual");
    return !!ea && !ea.querySelector(".estado-actual-panel");
  }
  if (tab === "eventualidades") {
    var ev = document.getElementById("exp-pane-eventualidades");
    return !!ev && !ev.querySelector(".ev-panel");
  }
  if (tab === "manejo") {
    var mj = document.getElementById("exp-pane-manejo");
    return !!mj && !mj.querySelector(".manejo-panel");
  }
  if (tab === "todo") {
    var tf = document.getElementById("todo-form");
    if (!tf) return true;
    return !tf.querySelector(".todo-add-row") && !tf.querySelector(".todo-list");
  }
  if (tab === "datos") {
    var pdf = document.getElementById("patient-data-form");
    if (!pdf) return true;
    return !String(pdf.innerHTML || "").trim();
  }
  return false;
}

function estadoActualCacheSuffix(patientId) {
  var p = patients.find(function (x) {
    return String(x.id) === String(patientId);
  });
  if (!p || !p.monitoreo) return "0";
  return buildEaMonitoreoRevision(p.monitoreo, patientId, medRecetaByPatient);
}

function innerTabRenderCacheKey(tab) {
  var pid = String(rt.getActiveId() || "");
  var settings = rt.getSettings();
  var key =
    String(tab || "") +
    "|" +
    pid +
    "|M" +
    (settings && settings.appMode ? settings.appMode : "sala");
  if (tab === "tend" || tab === "cult") {
    key += "|L" + getLabHistoryRevision(pid);
  }
  if (tab === "estadoActual") {
    key += "|E" + estadoActualCacheSuffix(pid);
  }
  return key;
}

export function isInnerTabContentFresh(tab, settings) {
  tab = migrateGranularInner(tab, settings);
  return innerTabRenderCache[tab] === innerTabRenderCacheKey(tab);
}

function markInnerTabRendered(tab) {
  innerTabRenderCache[tab] = innerTabRenderCacheKey(tab);
}

var _expedienteWarmQueued = false;
var _expedienteWarmGen = 0;

export function cancelExpedienteWarm() {
  _expedienteWarmGen += 1;
  _expedienteWarmQueued = false;
  if (expedientePreloadTimer) {
    clearTimeout(expedientePreloadTimer);
    expedientePreloadTimer = null;
    expedientePreloadTab = null;
  }
}

export function expedienteCompositeTab(granularTab, settings) {
  return consolidatedTabForGranular(granularTab, settings);
}


/** Precalienta Estado actual + Tendencias en idle (Sala). */
export function warmExpedienteHeavyTabs() {
  if (_expedienteWarmQueued || typeof document === "undefined") return;
  if (!isModeSala(rt.getSettings())) return;
  if (!rt.getActiveId() || rt.getActiveAppTab() !== "nota") return;
  _expedienteWarmQueued = true;
  var warmGen = _expedienteWarmGen;
  scheduleIdle(function () {
    _expedienteWarmQueued = false;
    if (warmGen !== _expedienteWarmGen) return;
    if (!rt.getActiveId() || rt.getActiveAppTab() !== "nota") return;
    var settings = rt.getSettings();
    var active = migrateGranularInner(rt.getActiveInner() || "todo", settings);
    ["estadoActual", "tend"].forEach(function (tab) {
      if (tab === active) return;
      if (isInnerTabContentFresh(tab, settings)) return;
      renderGranularInnerTab(tab);
    });
  }, 1200);
}

function resolvePreloadGranularTab(el) {
  if (!el || !el.id) return null;
  var settings = rt.getSettings();
  if (el.classList.contains('exp-consolidated-tab')) {
    var composite = el.id.replace(/^itab-/, '');
    return defaultGranularForConsolidatedTab(composite, settings);
  }
  if (el.classList.contains('exp-segment-btn')) {
    var section = el.getAttribute('data-exp-segment');
    if (section) return migrateGranularInner(section, settings);
  }
  return null;
}

function scheduleExpedienteTabPreload(granularTab) {
  if (!granularTab) return;
  if (innerTabRenderCache[granularTab] === innerTabRenderCacheKey(granularTab)) return;
  if (expedientePreloadTab === granularTab && expedientePreloadTimer) return;
  if (expedientePreloadTimer) clearTimeout(expedientePreloadTimer);
  expedientePreloadTab = granularTab;
  expedientePreloadTimer = setTimeout(function () {
    expedientePreloadTimer = null;
    expedientePreloadTab = null;
    if (innerTabRenderCache[granularTab] === innerTabRenderCacheKey(granularTab)) return;
    renderGranularInnerTab(granularTab);
  }, 70);
}

export function initExpedienteTabPreload() {
  if (expedienteTabPreloadWired || typeof document === 'undefined') return;
  expedienteTabPreloadWired = true;
  document.addEventListener(
    'pointerenter',
    function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;
      var btn = target.closest('.exp-consolidated-tab, .exp-segment-btn');
      if (!btn) return;
      scheduleExpedienteTabPreload(resolvePreloadGranularTab(btn));
    },
    true
  );
}

function renderHeavyInnerTab(tab, run, opts) {
  if (opts && opts.force) {
    run(function () {});
    return;
  }
  run(markInnerTabRendered.bind(null, tab));
}

export function syncConsolidatedInnerTabButtons(granularTab, settings) {
  var composite = consolidatedInnerTabButtonId(granularTab, settings).replace(/^itab-/, "");
  document.querySelectorAll(".exp-consolidated-tab").forEach(function (btn) {
    var id = btn.id || "";
    var name = id.replace(/^itab-/, "");
    btn.classList.toggle("active", name === composite);
  });
}

function renderEstadoActualInnerTab(tab, opts) {
  renderHeavyInnerTab(tab, function (done) {
    renderEstadoActualPanel({ onReady: done, syncHeavy: !!opts.force });
  }, opts);
}

function renderTendInnerTab(tab, opts) {
  renderHeavyInnerTab(tab, function (done) {
    void ensureChartsLoaded().then(function (mods) {
      mods.tendencias.renderTendencias({ onReady: done, syncHeavy: !!opts.force });
    });
  }, opts);
}

function renderHistoriaInnerTab(tab, opts) {
  renderHeavyInnerTab(tab, function (done) {
    renderHistoriaClinicaPanel({ onReady: done });
  }, opts);
}

function renderLightGranularTab(tab) {
  if (tab === 'datos' || tab === 'todo') renderPatientDataPane();
  if (tab === 'cult') renderCultivosTable();
  if (tab === 'icHoja') renderIcHojaExportPanel(document.getElementById('ic-hoja-export-mount'));
  if (tab === 'listado') renderListadoForm();
  if (tab === 'todo') renderTodoForm();
  if (tab === 'recetaHu') renderRecetaHu();
  markInnerTabRendered(tab);
}

var GRANULAR_TAB_RENDERERS = {
  estadoActual: renderEstadoActualInnerTab,
  vpo: function (tab) {
    renderVpo();
    markInnerTabRendered(tab);
  },
  tend: renderTendInnerTab,
  notas: function (tab) {
    renderNoteForm();
    markInnerTabRendered(tab);
  },
  indica: function (tab) {
    renderIndicaForm();
    markInnerTabRendered(tab);
  },
  historia: renderHistoriaInnerTab,
  eventualidades: function (tab) {
    renderEventualidadesPanel(document.getElementById('exp-pane-eventualidades'));
    markInnerTabRendered(tab);
  },
  manejo: function (tab) {
    renderManejoPanel(document.getElementById('exp-pane-manejo'));
    markInnerTabRendered(tab);
  },
};

export function renderGranularInnerTab(tab, opts) {
  opts = opts || {};
  if (!opts.force && innerTabRenderCache[tab] === innerTabRenderCacheKey(tab)) return;

  var renderer = GRANULAR_TAB_RENDERERS[tab];
  if (renderer) {
    renderer(tab, opts);
    return;
  }
  renderLightGranularTab(tab);
}

export function syncInnerTabVisualOnly() {
  var settings = rt.getSettings();
  var tab = migrateGranularInner(rt.getActiveInner() || "todo", settings);
  syncConsolidatedInnerTabButtons(tab, settings);
  syncConsolidatedPaneVisibility(tab, settings);
  syncConsolidatedSegmentBars(tab, settings);
  renderExpedienteGroupRow(tab, settings);
  syncInnerTabIndicator(tab, { consolidated: true, settings: settings });
}
