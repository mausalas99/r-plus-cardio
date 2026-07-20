// Mapa de pasos del tour guiado a su zona objetivo en la UI.
// Pura: no toca DOM. La capa de UI usa estos descriptores para hacer
// scroll/foco/spotlight y decidir si esperar acción del usuario.

import {
  getSalaTourSteps as curriculumSalaSteps,
  getInterconsultaTourSteps as curriculumIcSteps,
  getGuardiaV7TourSteps as curriculumGuardiaV7Steps,
  getQuickRouteTourSteps as curriculumQuickRouteSteps,
} from './onboarding-curriculum.mjs';

// Pasos cuyo avance depende de que el usuario presione un botón real
// (no se muestra "Siguiente" en el dock).
const ACTION_STEPS = new Set([
  'lab_parse',
  'ic_nota',
  'ic_indica',
  'estado_actual_registro',
  'servicio_default',
  'gv7_guardia_toggle',
  'gv7_lan_wifi',
  'gv7_mobile_link',
  'livesync_desktop',
]);

// Descriptores de objetivo por paso. Selectores son CSS queries
// resueltos por la capa de UI con document.querySelector(). Los IDs
// reales viven en index.html / app.js.
const TARGETS = {
  map_sidebar:       { appTab: null,   selector: 'aside',                                     focus: false,
                       spotlightClass: 'tour-spotlight-action' },
  map_tabs:          { appTab: null,   selector: '#main-area',                                focus: false,
                       spotlightClass: 'tour-spotlight-action' },
  map_lab_teaser:    { appTab: 'lab',  selector: '#lab-input',                                focus: false,
                       spotlightClass: 'tour-spotlight-action' },
  lab_bulk_separator: { appTab: 'lab', selector: '#btn-lab-patient-separator, #lab-input', focus: false,
                       spotlightClass: 'tour-spotlight-action' },
  servicio_default:  { appTab: null,   selector: '#settings-default-servicio',               focus: true,
                       openProfile: true },
  lab_parse:         { appTab: 'lab',  selector: '#btn-procesar, #lab-input',                focus: false },
  lab_view:          { appTab: 'lab',  selector: '#lab-output-section',                      focus: false },
  ic_expediente_tabs: {
    appTab: 'nota',
    selector: '.inner-tab-bar',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_expediente_tabs: {
    appTab: 'nota',
    selector: '.inner-tab-bar',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  historia_clinica: {
    appTab: 'nota',
    innerTab: 'historia',
    selector: '#exp-segment-historia, #historia-clinica-mount',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  eventualidades: {
    appTab: 'nota',
    innerTab: 'eventualidades',
    selector: '#exp-segment-eventualidades, #itab-content-eventualidades',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_tend:         { appTab: 'nota', innerTab: 'tend',    selector: '#tendencias-container', focus: false },
  sala_tend_chart:   { appTab: 'nota', innerTab: 'tend',    selector: '#tendencias-container .tend-section-chart-btn',
                       focus: false, spotlightClass: 'tour-spotlight-action' },
  sala_soap:         { appTab: 'nota', innerTab: 'notas',   selector: '#btn-soap-template',  focus: false,
                       spotlightClass: 'tour-spotlight-soap' },
  estado_actual: {
    appTab: 'nota',
    innerTab: 'estadoActual',
    selector: '#ea-snapshot, #ea-charts-summary, #ea-historial',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  estado_actual_registro: {
    appTab: 'nota',
    innerTab: 'estadoActual',
    selector:
      '#ea-registro-backdrop.open .ea-vitals-grid, #ea-registro-backdrop.open .ea-glu-section, #ea-registro-backdrop.open .ea-io-grid',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
    openEaRegistro: true,
  },
  estado_actual_review: {
    appTab: 'nota',
    innerTab: 'estadoActual',
    selector: '#ea-snapshot, #ea-charts-summary, #ea-historial, .ea-estado-clinico',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_med:          { appTab: 'med',  selector: '#med-import-open-btn',                      focus: false },
  sala_manejo: {
    appTab: 'nota',
    innerTab: 'manejo',
    selector: '#exp-pane-manejo, .manejo-panel, [data-manejo-panel]',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  cardio_demo_intro: {
    appTab: 'nota',
    innerTab: 'estadoActual',
    selector: '#patient-list, aside .sidebar-header, #ea-snapshot',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  cardio_descongestion: {
    appTab: 'nota',
    innerTab: 'estadoActual',
    selector:
      '[data-ea-cardio-descongestion-panel], [data-ea-cardio-congestion-panel], #ea-snapshot',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_ic_hoja: {
    appTab: 'nota',
    innerTab: 'icHoja',
    selector: '#ic-hoja-export-mount, #btn-gen-ic-hoja, [data-ic-hoja-export]',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  listado_problemas: {
    appTab: 'nota',
    innerTab: 'listado',
    selector: '#listado-form, #exp-segment-listado, #btn-gen-listado',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_vpo: {
    appTab: 'nota',
    innerTab: 'vpo',
    selector: '#exp-segment-vpo-salida, #vpo-container, .vpo-panel',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_receta_hu: {
    appTab: 'nota',
    innerTab: 'recetaHu',
    selector: '#exp-segment-recetaHu, #receta-hu-container, #btn-receta-hu-export',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  sala_agenda: {
    appTab: 'agenda',
    selector: '#apptab-agenda, #appcontent-agenda .rpc-proc-agenda-root',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  ic_nota:           { appTab: 'nota', innerTab: 'notas',   selector: '#btn-gen',            focus: false,
                       spotlightClass: 'tour-spotlight-soap' },
  ic_indica:         { appTab: 'nota', innerTab: 'indica',  selector: '#btn-gen-ind',        focus: false,
                       spotlightClass: 'tour-spotlight-soap' },
  ic_exports:        { appTab: null,   selector: '#settings-dropdown',                       focus: false,
                       openSettings: true },
  profile:           { appTab: null,   selector: '#profile-modal .modal',                    focus: false,
                       openProfile: true },
  wrap:              { appTab: null,   selector: 'aside .sidebar-header',                    focus: false },
  quick_wrap:        { appTab: null,   selector: '#btn-open-learn, aside .sidebar-header', focus: false },
  livesync_desktop:  { appTab: null,   selector: '#btn-header-team-sync',                    focus: false,
                       spotlightClass: 'tour-spotlight-action' },
  livesync_mobile:   { appTab: null,   selector: '#connection-dropdown', focus: false, openConnection: true },
  gv7_guardia_chip: {
    appTab: null,
    selector: '#header-mode-seg',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_guardia_tab: {
    appTab: null,
    selector: '#appcontent-guardia',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_guardia_scope: {
    appTab: null,
    selector: '#guardia-census-scope, #clinical-context-bar',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_guardia_toggle: {
    appTab: null,
    selector: '#btn-guardia-mode-toggle',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_guardia_exit: {
    appTab: null,
    selector: '#header-mode-seg',
    focus: false,
    exitGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_entrega_phase: {
    appTab: null,
    selector: '#btn-guardia-entrega-phase',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_entrega_patient: {
    appTab: null,
    selector: '#guardia-census-grid, #guardia-incoming-strip',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_entrega_roster: {
    appTab: null,
    selector: '#entrega-roster-panel',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_entrega_pendientes: {
    appTab: null,
    selector: '#entrega-modal, #entrega-handoff-panel',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_lan_wifi: {
    appTab: null,
    selector: '#btn-header-team-sync',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_lan_pin: {
    appTab: null,
    selector: '#lan-connection-panel-root .lan-shift-pin-card, #lan-connection-panel-root [data-lan-shift-pin]',
    focus: false,
    openConnection: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_lan_directorio: {
    appTab: null,
    selector: '#lan-connection-panel-root .lan-connect-card',
    focus: false,
    openConnection: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_lan_rotacion: {
    appTab: null,
    selector: '#btn-sidebar-mi-rotacion',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_mobile_link: {
    appTab: null,
    selector: '.lan-invite-collapsible--mobile, #lan-pairing-display-mobile',
    focus: false,
    openConnection: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_mobile_scope: {
    appTab: null,
    selector: '.lan-mobile-join-card, .lan-mobile-sharer-card',
    focus: false,
    openConnection: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_mobile_vs_sala: {
    appTab: null,
    selector: '.lan-connect-other-mac, .lan-invite-collapsible:not(.lan-invite-collapsible--mobile)',
    focus: false,
    openConnection: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_censo_r1: {
    appTab: null,
    selector: '#patient-sidebar, #patient-list',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_censo_r4: {
    appTab: null,
    selector: '.r4-section-divider, #guardia-census-head',
    focus: false,
    openGuardiaDensity: true,
    spotlightClass: 'tour-spotlight-action',
  },
  gv7_censo_sync: {
    appTab: null,
    selector: '#btn-header-team-sync, #lan-connection-banner',
    focus: false,
    spotlightClass: 'tour-spotlight-action',
  },
};

export function getSalaTourSteps() {
  return curriculumSalaSteps();
}

export function getInterconsultaTourSteps() {
  return curriculumIcSteps();
}

export function getGuardiaV7TourSteps() {
  return curriculumGuardiaV7Steps();
}

export function getQuickRouteTourSteps() {
  return curriculumQuickRouteSteps();
}

export function getTourSteps(branch) {
  if (branch === 'interconsulta') return getInterconsultaTourSteps();
  if (branch === 'guardia-v7') return getGuardiaV7TourSteps();
  if (branch === 'quick-route') return getQuickRouteTourSteps();
  return getSalaTourSteps();
}

export function stepRequiresUserAction(stepId) {
  return ACTION_STEPS.has(stepId);
}

export function getTourTarget(stepId, _branch) {
  const t = TARGETS[stepId];
  if (!t) return { appTab: null, selector: null, focus: false };
  return Object.assign({}, t);
}
