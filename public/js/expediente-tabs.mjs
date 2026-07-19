/**
 * Consolidated expediente tabs (Sala + Interconsulta; granular fallback unused).
 */
import { isModeSala } from './mode-features.mjs';
import { isMobileWeb } from './mobile-web.mjs';
import { filterSalidaSectionsForCardionotas } from './features/cardio/cardionotas-gates.mjs';
import { openPatientDatosModal, openPatientDatosModalForPatient } from './patient-datos-modal.mjs';

export const CONSOLIDATED_TABS_SALA = ['paciente', 'clinico', 'resultados', 'manejo', 'salida'];
export const CONSOLIDATED_TABS_INTER = ['paciente', 'clinico', 'resultados', 'salida'];

/** @deprecated alias of CONSOLIDATED_TABS_INTER for backward compatibility */
export const CONSOLIDATED_TABS = CONSOLIDATED_TABS_INTER;

const CLINICO_GRANULAR_TABS = [
  'notas',
  'indica',
  'historia',
  'estadoActual',
  'eventualidades',
  'vpo',
];
export const COMPOSITE_PANE_IDS = ['paciente', 'clinico', 'resultados', 'manejo', 'salida'];

/** @deprecated Manejo eliminado — siempre oculto. */
export function isClinicoTabHidden(settings) {
  return isModeSala(settings);
}

/** @deprecated Manejo eliminado — siempre oculto. */
export function isManejoSectionHidden(_settings) {
  return true;
}

export function isClinicoCompositeVisible(settings) {
  if (!isModeSala(settings)) return true;
  // Sala: Clínico always hosts Historia ingreso; Manejo is optional via segment bar.
  return true;
}

export function getConsolidatedTabs(settings) {
  var tabs = isModeSala(settings) ? CONSOLIDATED_TABS_SALA.slice() : CONSOLIDATED_TABS_INTER.slice();
  if (!isClinicoCompositeVisible(settings)) {
    tabs = tabs.filter(function (tab) {
      return tab !== 'clinico';
    });
  }
  if (isMobileWeb()) {
    tabs = tabs.filter(function (tab) {
      return tab !== 'salida';
    });
  }
  return tabs;
}

export const CLINICO_SECTIONS_ALL = ['notas', 'indica', 'historia', 'vpo'];
export const CLINICO_SECTIONS_SALA = ['estadoActual', 'historia', 'eventualidades'];
export const RESULTADOS_SECTIONS = ['tend', 'cult'];
export const SALIDA_SECTIONS_SALA = ['icHoja', 'listado', 'vpo', 'recetaHu'];

/** @deprecated use getClinicoSections(settings) */
export const CLINICO_SECTIONS = CLINICO_SECTIONS_ALL;

const GRANULAR_PANE_ORDER = [
  'datos',
  'notas',
  'indica',
  'historia',
  'tend',
  'cult',
  'icHoja',
  'listado',
  'todo',
  'vpo',
  'estadoActual',
  'eventualidades',
  'recetaHu',
];

let layoutMode = null;

function granularToConsolidatedMap(settings) {
  var sala = isModeSala(settings);
  var map = {
    datos: { tab: 'paciente', section: null },
    todo: { tab: 'paciente', section: null },
    notas: { tab: 'clinico', section: 'notas' },
    indica: { tab: 'clinico', section: 'indica' },
    historia: { tab: 'clinico', section: 'historia' },
    tend: { tab: 'resultados', section: 'tend' },
    cult: { tab: 'resultados', section: 'cult' },
    recetaHu: { tab: 'salida', section: sala ? 'recetaHu' : null },
    listado: { tab: sala ? 'salida' : 'paciente', section: sala ? 'listado' : null },
    icHoja: sala ? { tab: 'salida', section: 'icHoja' } : { tab: 'paciente', section: null },
    vpo: sala ? { tab: 'salida', section: 'vpo' } : { tab: 'clinico', section: 'vpo' },
  };
  if (sala) {
    map.estadoActual = { tab: 'clinico', section: 'estadoActual' };
    map.eventualidades = { tab: 'clinico', section: 'eventualidades' };
  }
  return map;
}

function paneMountSpec(granularTab, settings) {
  var sala = isModeSala(settings);
  if (granularTab === 'vpo') {
    return sala
      ? { composite: 'salida', selector: '.exp-segment-body--salida' }
      : { composite: 'clinico', selector: '.exp-segment-body--clinico' };
  }
  var map = {
    datos: { composite: null, selector: null },
    todo: { composite: 'paciente', selector: '.exp-pendientes-mount' },
    notas: { composite: 'clinico', selector: '.exp-segment-body--clinico' },
    indica: { composite: 'clinico', selector: '.exp-segment-body--clinico' },
    historia: { composite: 'clinico', selector: '.exp-segment-body--clinico' },
    tend: { composite: 'resultados', selector: '.exp-segment-body--resultados' },
    cult: { composite: 'resultados', selector: '.exp-segment-body--resultados' },
    listado: sala ? { composite: 'salida', selector: '.exp-segment-body--salida' } : { composite: null, selector: null },
    icHoja: sala ? { composite: 'salida', selector: '.exp-segment-body--salida' } : { composite: null, selector: null },
    recetaHu: { composite: 'salida', selector: '.exp-segment-body--salida' },
    estadoActual: sala
      ? { composite: 'clinico', selector: '.exp-segment-body--clinico' }
      : { composite: null, selector: null },
    eventualidades: sala
      ? { composite: 'clinico', selector: '.exp-segment-body--clinico' }
      : { composite: null, selector: null },
  };
  return map[granularTab] || null;
}

export function getClinicoSections(settings) {
  if (isModeSala(settings)) {
    return ['estadoActual', 'historia', 'eventualidades'];
  }
  return ['notas', 'indica', 'vpo'];
}

export function getSalidaSections(settings) {
  if (isMobileWeb()) return [];
  if (!isModeSala(settings)) return [];
  return filterSalidaSectionsForCardionotas(SALIDA_SECTIONS_SALA);
}

export function resolveConsolidatedTarget(granularTab, settings) {
  if (granularTab === 'manejo') {
    return isModeSala(settings)
      ? { tab: 'manejo', section: null }
      : { tab: 'clinico', section: 'notas' };
  }
  var map = granularToConsolidatedMap(settings || {});
  var target = map[granularTab] || { tab: 'paciente', section: null };
  if (isMobileWeb() && target.tab === 'salida') {
    if (!isModeSala(settings) && granularTab === 'vpo') {
      return { tab: 'clinico', section: 'vpo' };
    }
    return isModeSala(settings)
      ? { tab: 'clinico', section: 'historia' }
      : { tab: 'paciente', section: null };
  }
  return target;
}

export function consolidatedTabForGranular(granularTab, settings) {
  if (granularTab === 'manejo') {
    return isModeSala(settings) ? 'manejo' : 'clinico';
  }
  return resolveConsolidatedTarget(granularTab, settings).tab;
}

import { migrateGranularInner as migrateGranularInnerImpl } from './expediente-tabs-migrate.mjs';

export function migrateGranularInner(granularTab, settings) {
  return migrateGranularInnerImpl(granularTab, settings, granularToConsolidatedMap(settings || {}));
}

export function defaultGranularForConsolidatedTab(compositeTab, settings) {
  var sala = isModeSala(settings);
  var clinicoDefault = 'notas';
  if (sala) clinicoDefault = 'estadoActual';
  var defaults = {
    paciente: 'todo',
    clinico: clinicoDefault,
    resultados: 'tend',
    manejo: 'manejo',
    salida: isMobileWeb()
      ? sala
        ? 'historia'
        : 'todo'
      : sala
        ? 'icHoja'
        : 'recetaHu',
  };
  return defaults[compositeTab] || 'todo';
}

export function consolidatedInnerTabButtonId(tab, settings) {
  var tabs = getConsolidatedTabs(settings || {});
  if (tabs.includes(tab)) return 'itab-' + tab;
  return 'itab-' + consolidatedTabForGranular(tab, settings);
}

function paneEl(granularTab) {
  return document.getElementById('itab-content-' + granularTab);
}

function compositeEl(name) {
  return document.getElementById('itab-content-' + name);
}

function mountPaneInComposite(granularTab, settings) {
  var pane = paneEl(granularTab);
  var spec = paneMountSpec(granularTab, settings);
  if (!pane || !spec || !spec.composite) return;
  var composite = compositeEl(spec.composite);
  if (!composite) return;
  var mount = composite.querySelector(spec.selector);
  if (mount && pane.parentElement !== mount) mount.appendChild(pane);
  pane.classList.remove('tab-content');
  pane.classList.add('exp-segment-panel');
}

function mountConsolidatedNested(settings) {
  GRANULAR_PANE_ORDER.forEach(function (tab) {
    mountPaneInComposite(tab, settings);
  });
  getConsolidatedTabs(settings || {}).forEach(function (tab) {
    var composite = compositeEl(tab);
    if (composite) composite.classList.add('tab-content', 'exp-composite-pane');
  });
}

export function syncConsolidatedSegmentBarVisibility(settings) {
  var sala = isModeSala(settings);
  var clinicoBar = document.getElementById('exp-segment-clinico');
  if (clinicoBar) {
    clinicoBar.style.display = !isClinicoCompositeVisible(settings) ? 'none' : '';
    ['notas', 'indica', 'historia', 'estadoActual', 'eventualidades', 'vpo'].forEach(
      function (section) {
        var btn = clinicoBar.querySelector('[data-exp-segment="' + section + '"]');
        if (!btn) return;
        if (section === 'historia') {
          btn.style.display = sala ? '' : 'none';
        } else if (section === 'estadoActual' || section === 'eventualidades') {
          btn.style.display = sala ? '' : 'none';
        } else if (section === 'vpo') {
          btn.style.display = sala ? 'none' : '';
        } else {
          btn.style.display = sala ? 'none' : '';
        }
      }
    );
  }
  var salidaBar = document.getElementById('exp-segment-salida');
  if (salidaBar) {
    var salidaSections = getSalidaSections(settings);
    salidaBar.style.display = sala && salidaSections.length ? '' : 'none';
    ['icHoja', 'listado', 'vpo', 'recetaHu'].forEach(function (section) {
      var btn = salidaBar.querySelector('[data-exp-segment="' + section + '"]');
      if (!btn) return;
      btn.style.display = sala && salidaSections.indexOf(section) >= 0 ? '' : 'none';
    });
  }
  var estadoActualTab = document.getElementById('itab-estadoActual');
  if (estadoActualTab) estadoActualTab.style.display = 'none';
}

export function applyExpedientePaneLayout(settings) {
  var sala = isModeSala(settings);
  syncConsolidatedSegmentBarVisibility(settings || {});
  var next = sala ? 'consolidated-sala' : 'consolidated-inter';
  if (layoutMode === next) return;
  layoutMode = next;
  mountConsolidatedNested(settings || {});
  syncConsolidatedSegmentBarVisibility(settings || {});
}

export function resetExpedientePaneLayoutCache() {
  layoutMode = null;
}

export function syncConsolidatedSegmentBars(granularTab, settings) {
  var target = resolveConsolidatedTarget(granularTab, settings);
  var sections = getClinicoSections(settings);

  function syncBar(barEl, sectionIds, compositeTab) {
    if (!barEl) return;
    sectionIds.forEach(function (section) {
      var btn = barEl.querySelector('[data-exp-segment="' + section + '"]');
      if (!btn) return;
      var on = target.tab === compositeTab && target.section === section;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  }

  syncBar(document.getElementById('exp-segment-clinico'), sections, 'clinico');
  syncBar(document.getElementById('exp-segment-resultados'), RESULTADOS_SECTIONS, 'resultados');
  syncBar(document.getElementById('exp-segment-salida'), getSalidaSections(settings), 'salida');
}

export function getConsolidatedCompositeState(granularTab, settings) {
  var target = resolveConsolidatedTarget(granularTab, settings);
  var visibleTabs = getConsolidatedTabs(settings || {});
  /** @type {Record<string, { visible: boolean, active: boolean }>} */
  var state = {};
  COMPOSITE_PANE_IDS.forEach(function (tab) {
    var visible = visibleTabs.indexOf(tab) >= 0;
    state[tab] = { visible: visible, active: visible && tab === target.tab };
  });
  return state;
}

export function syncConsolidatedPaneVisibility(granularTab, settings, opts) {
  opts = opts || {};
  var target = resolveConsolidatedTarget(granularTab, settings);
  var compositeState = getConsolidatedCompositeState(granularTab, settings);
  COMPOSITE_PANE_IDS.forEach(function (tab) {
    var composite = compositeEl(tab);
    if (!composite) return;
    var pane = compositeState[tab];
    composite.hidden = !pane.visible;
    composite.classList.toggle('active', pane.active);
  });
  var datosActions = document.getElementById('exp-paciente-datos-actions');
  if (datosActions) {
    datosActions.hidden = !(compositeState.paciente && compositeState.paciente.active);
  }
  var driveActions = document.getElementById('exp-clinico-drive-actions');
  if (driveActions) {
    driveActions.hidden = !(
      isModeSala(settings) &&
      compositeState.clinico &&
      compositeState.clinico.active
    );
  }
  CLINICO_GRANULAR_TABS.forEach(function (section) {
    var pane = paneEl(section);
    if (!pane) return;
    var allowed = getClinicoSections(settings).indexOf(section) >= 0;
    var onClinico = target.tab === 'clinico' && target.section === section;
    var onSalida = target.tab === 'salida' && target.section === section && section === 'vpo';
    pane.classList.toggle('active', allowed && (onClinico || onSalida));
  });
  RESULTADOS_SECTIONS.forEach(function (section) {
    var pane = paneEl(section);
    if (pane) {
      pane.classList.toggle('active', target.tab === 'resultados' && target.section === section);
    }
  });
  var datosPane = paneEl('datos');
  var todoPane = paneEl('todo');
  var salidaSections = getSalidaSections(settings);
  if (salidaSections.length) {
    salidaSections.forEach(function (section) {
      var pane = paneEl(section);
      if (pane) pane.classList.toggle('active', target.tab === 'salida' && target.section === section);
    });
  } else {
    var recetaPane = paneEl('recetaHu');
    if (recetaPane) recetaPane.classList.toggle('active', target.tab === 'salida' && granularTab === 'recetaHu');
  }
  if (datosPane) {
    var datosInModal = !!datosPane.closest('#exp-datos-modal-mount');
    datosPane.classList.toggle('active', datosInModal);
    datosPane.hidden = !datosInModal;
  }
  if (todoPane) todoPane.classList.toggle('active', target.tab === 'paciente');
  if (granularTab === 'datos') {
    if (opts.datosPatientId != null && opts.datosPatientId !== '') {
      openPatientDatosModalForPatient(opts.datosPatientId);
    } else {
      openPatientDatosModal();
    }
  }
}
