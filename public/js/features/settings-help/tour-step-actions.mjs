/** Guided tour step targets, dock UI, demo seeding, and action polling. */
import { getTourSteps, getTourTarget, stepRequiresUserAction } from '../../tour-targets.mjs';
import {
  getChapterForStep,
  getTourStepsForChapter,
} from '../../onboarding-curriculum.mjs';
import { saveTourProgress } from '../../onboarding-progress.mjs';
import { buildTourDemoListadoProblemas } from '../../tour-demo-listado-problemas.mjs';
import { getTourRegistroFormSample } from '../../tour-demo-monitoreo.mjs';
import { applyTourDemoIngresoDates } from '../../tour-demo-dates.mjs';
import { DEMO_PATIENT_ID, tourDemoLabCompleteForTour } from '../../tour-demo-patient.mjs';
import {
  renderEstadoActualPanel,
  applyEstadoActualParsedToForm,
  toDatetimeLocalValue,
  invalidateEaPanelCache,
} from '../estado-actual-panel.mjs';
import {
  closeEstadoActualRegistroModal,
  openEstadoActualRegistroModal,
} from '../estado-actual-registro-modal.mjs';
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { setUiDensity, isGuardiaMode } from '../chrome.mjs';
import { openConnectionDropdown, closeConnectionDropdown } from '../lan-sync.mjs';
import { renderNoteForm, renderIndicaForm } from '../notes-indicaciones.mjs';
import { closeLabSomeTablesModal } from '../lab-some-tables-modal.mjs';
import { closeTendGroupModal } from '../tendencias.mjs';
import { closeSOAPModal } from '../soap-estado.mjs';
import { procesarLabs } from '../../labs.js';
import { extractParsedValues } from '../diagrams-parse.mjs';
import { patients, labHistory, listadoProblemas, saveState } from '../../app-state.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import { closeSettingsDropdown, isSettingsDropdownOpen, toggleSettingsDropdown } from './settings-dropdown.mjs';
import {
  TOUR_STEPS_USE_DEMO_PEREZ,
  ensureTourPrimaryDemoPatientActive,
  ensureTourDemoLabInputBoth,
  findTourDemoPerezPatient,
  getTourDemoDateBundle,
} from './tour-demo-seed.mjs';
import { tourState } from './tour-state.mjs';
import { hideTourIntroModal, syncLearnHubContinueVisibility } from './tour-intro.mjs';
import { closeLabBulkTourHintModal } from './tour-lab-hint.mjs';

const rt = getSettingsHelpRuntime();

export function resolveTourBranch() {
  if (tourState.guidedTourBranch === 'interconsulta') return 'interconsulta';
  if (tourState.guidedTourBranch === 'guardia-v7') return 'guardia-v7';
  if (tourState.guidedTourBranch === 'quick-route') return 'quick-route';
  return 'sala';
}

export function persistTourProgressDebounced() {
  if (!tourState.guidedTourActive || !tourState.tourStepId) return;
  if (tourState.persistTourProgressTimer) clearTimeout(tourState.persistTourProgressTimer);
  tourState.persistTourProgressTimer = setTimeout(function () {
    tourState.persistTourProgressTimer = null;
    var branch = resolveTourBranch();
    var ch = getChapterForStep(tourState.tourStepId, branch);
    saveTourProgress({
      branch: branch,
      track: branch,
      stepId: tourState.tourStepId,
      chapterId: ch.id,
      mode: tourState.guidedTourMode,
    });
    syncLearnHubContinueVisibility();
  }, 300);
}

export function resetTourUiBeforeResume() {
  clearAllTourSpotlights();
  clearTourSoapButtonHighlight();
  if (typeof closeSettingsDropdown === 'function') closeSettingsDropdown();
  if (typeof closeConnectionDropdown === 'function') closeConnectionDropdown();
  rt.closeProfileModal();
  closeLabSomeTablesModal();
  closeLabBulkTourHintModal();
  closeTendGroupModal();
  closeSOAPModal();
  hideTourIntroModal();
  settingsHelpBridge.closeQuickHelp();
}

export function showTourDock() {
  document.getElementById('tour-dock').classList.add('tour-dock-visible');
}

export function hideTourDock() {
  clearTourActionPoll();
  var d = document.getElementById('tour-dock');
  if (!d) return;
  d.classList.remove('tour-dock-visible');
  d.classList.remove('tour-dock-collapsed');
  d.classList.remove('tour-dock-pos-left');
  d.classList.remove('tour-dock--guardia');
  d.classList.remove('tour-dock--fundamentos');
  d.classList.remove('tour-dock--quick-route');
  var btn = document.getElementById('btn-tour-collapse');
  if (btn) { btn.textContent = '–'; btn.setAttribute('aria-label', 'Minimizar tutorial'); }
}

// Colapsa el dock a sólo el encabezado (badge + acciones) para que el
// tour deje de bloquear el contenido. Se reexpande con el mismo botón.
export function toggleTourDockCollapsed() {
  var d = document.getElementById('tour-dock');
  if (!d) return;
  setTourDockCollapsed(!d.classList.contains('tour-dock-collapsed'));
}

function setTourDockCollapsed(collapsed) {
  var d = document.getElementById('tour-dock');
  if (!d) return;
  if (collapsed) d.classList.add('tour-dock-collapsed');
  else d.classList.remove('tour-dock-collapsed');
  var btn = document.getElementById('btn-tour-collapse');
  if (btn) {
    btn.textContent = collapsed ? '+' : '–';
    btn.setAttribute('aria-label', collapsed ? 'Expandir tutorial' : 'Minimizar tutorial');
  }
}

// Click en cualquier parte del dock colapsado lo expande (excepto en
// los botones del encabezado, que ya tienen su propio handler).
export function onTourDockClick(ev) {
  var d = document.getElementById('tour-dock');
  if (!d || !d.classList.contains('tour-dock-collapsed')) return;
  var t = ev && ev.target;
  if (t && t.closest && t.closest('.btn-tour-skip, .btn-tour-collapse, .btn-tour-next, .btn-tour-prev, .btn-tour-pause')) return;
  setTourDockCollapsed(false);
  ev.stopPropagation();
}

export function seedDemoTrendHistory(ref) {
  try {
    var bundle = getTourDemoDateBundle(ref);
    var older = procesarLabs(bundle.olderDemoSomeLabReport).resLabs;
    var newer = procesarLabs(bundle.demoSomeLabReport).resLabs;
    labHistory[DEMO_PATIENT_ID] = [
      {
        id: 'tour-trend-1',
        fecha: bundle.labFechaOlder,
        hora: '',
        resLabs: older,
        parsed: extractParsedValues(older),
      },
      {
        id: 'tour-trend-2',
        fecha: bundle.labFechaNewer,
        hora: '',
        resLabs: newer,
        parsed: extractParsedValues(newer),
      },
    ];
  } catch (_err) {
    void _err;
    delete labHistory[DEMO_PATIENT_ID];
  }
}

export function seedDemoMonitoreoOnActivePatient() {
  ensureTourPrimaryDemoPatientActive();
}

export function seedDemoListadoProblemas() {
  if (!tourState.guidedTourActive) return;
  if (!ensureTourPrimaryDemoPatientActive()) return;
  var perez = findTourDemoPerezPatient();
  if (!perez) return;
  var demoId = perez.id;
  var today = new Date();
  var fecha =
    String(today.getDate()).padStart(2, '0') + '/'
    + String(today.getMonth() + 1).padStart(2, '0') + '/'
    + today.getFullYear();
  var hora =
    String(today.getHours()).padStart(2, '0') + ':'
    + String(today.getMinutes()).padStart(2, '0');
  listadoProblemas[demoId] = buildTourDemoListadoProblemas(fecha, hora);
  saveState();
}

export function ensureProfileExpandedForTour() {
  // Desde 3.0 el perfil vive en un modal centrado; lo abrimos directamente.
  rt.openProfileModal();
}

export function ensureSettingsExpandedForTour() {
  if (!isSettingsDropdownOpen()) toggleSettingsDropdown();
}

export function ensureConnectionExpandedForTour() {
  if (typeof closeSettingsDropdown === 'function') closeSettingsDropdown();
  var dd = document.getElementById('connection-dropdown');
  if (!dd) return;
  if (!dd.classList.contains('open') && typeof openConnectionDropdown === 'function') {
    openConnectionDropdown();
  }
}

export function clearTourSoapButtonHighlight() {
  var b = document.getElementById('btn-soap-template');
  if (b) b.classList.remove('tour-spotlight-soap');
}

export function syncTourSoapButtonHighlight() {
  clearTourSoapButtonHighlight();
  if (!tourState.guidedTourActive || tourState.tourStepId !== 'sala_soap') return;
  setTimeout(function () {
    var btn = document.getElementById('btn-soap-template');
    if (btn && tourState.guidedTourActive && tourState.tourStepId === 'sala_soap') {
      btn.classList.add('tour-spotlight-soap');
    }
  }, 120);
}

export function getGuidedTourSteps() {
  const branch = resolveTourBranch();
  if (tourState.guidedTourModuleOnly && tourState.guidedTourChapterScope) {
    const scoped = getTourStepsForChapter(tourState.guidedTourChapterScope, branch);
    if (scoped.length) return scoped;
  }
  return getTourSteps(branch);
}

export function demoLabAlreadyProcessedForTour() {
  if (tourState.tourDemoLabSessionProcessed) return true;
  if (!tourState.guidedTourActive) return false;
  return tourDemoLabCompleteForTour(patients, labHistory);
}

export function seedDemoEventualidadesOnActivePatient() {
  ensureTourPrimaryDemoPatientActive();
}

export function openTourEstadoActualRegistroDemo() {
  var now = new Date();
  var atShift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  openEstadoActualRegistroModal();
  applyEstadoActualParsedToForm(getTourRegistroFormSample());
  var recorded = document.getElementById('ea-recorded-at');
  if (recorded && 'value' in recorded) {
    recorded.value = toDatetimeLocalValue(atShift);
  }
}

export function isEstadoActualPostRegistroTourStep(id) {
  return id === 'estado_actual_review';
}

export function prepareEstadoActualPanelForTour(onPanelReady) {
  ensureTourPrimaryDemoPatientActive();
  closeEstadoActualRegistroModal();
  invalidateEaPanelCache();
  try {
    renderEstadoActualPanel({
      onReady: function () {
        if (typeof onPanelReady === 'function') onPanelReady();
      },
    });
  } catch (err) {
    console.error('prepareEstadoActualPanelForTour:', err && err.message);
    if (typeof onPanelReady === 'function') onPanelReady();
  }
}

function isConnectionDropdownOpenForTour() {
  var dd = document.getElementById('connection-dropdown');
  if (dd && dd.classList.contains('open')) return true;
  var syncBtn = document.getElementById('btn-header-team-sync');
  return !!(syncBtn && syncBtn.getAttribute('aria-expanded') === 'true');
}

function isMobileInviteExpandedForTour() {
  var details = document.querySelector('details.lan-invite-collapsible--mobile');
  if (details && details.open) return true;
  var pairing = document.getElementById('lan-pairing-display-mobile');
  return !!(pairing && !pairing.hidden);
}

function isGuardiaEntregasFilterActiveForTour() {
  if (clinicalSessionContext && clinicalSessionContext.guardiaMode) return true;
  var boardBtn = document.getElementById('btn-guardia-mode-toggle');
  return !!(
    boardBtn &&
    (boardBtn.getAttribute('aria-pressed') === 'true' || boardBtn.classList.contains('is-active'))
  );
}

export function clearTourActionPoll() {
  if (tourState.tourActionPollTimer) {
    clearInterval(tourState.tourActionPollTimer);
    tourState.tourActionPollTimer = null;
  }
  if (tourState.tourActionClickHandler) {
    document.removeEventListener('click', tourState.tourActionClickHandler, true);
    document.removeEventListener('toggle', tourState.tourActionClickHandler, true);
    tourState.tourActionClickHandler = null;
  }
}

export function armTourActionPoll() {
  clearTourActionPoll();
  if (!tourState.guidedTourActive || !stepRequiresUserAction(tourState.tourStepId)) return;
  tourState.tourActionPollTimer = setInterval(syncTourActionNextButton, 300);
  tourState.tourActionClickHandler = function () {
    syncTourActionNextButton();
  };
  document.addEventListener('click', tourState.tourActionClickHandler, true);
  document.addEventListener('toggle', tourState.tourActionClickHandler, true);
}

function enableTourNextButton(nextBtn) {
  nextBtn.style.display = '';
  nextBtn.disabled = false;
  nextBtn.textContent = 'Siguiente';
}

function syncLabParseTourNext(nextBtn, stepId) {
  if (stepId === 'lab_parse' && demoLabAlreadyProcessedForTour()) enableTourNextButton(nextBtn);
}

function syncServicioDefaultTourNext(nextBtn, stepId) {
  if (stepId !== 'servicio_default') return;
  var st = rt.getSettings();
  if (st && String(st.defaultServicio || '').trim()) {
    nextBtn.style.display = '';
    nextBtn.textContent = 'Siguiente';
  }
}

function syncConnectionTourNext(nextBtn, stepId) {
  if (stepId !== 'gv7_lan_wifi' && stepId !== 'livesync_desktop') return;
  if (!isConnectionDropdownOpenForTour()) return;
  enableTourNextButton(nextBtn);
}

function syncMobileInviteTourNext(nextBtn, stepId) {
  if (stepId !== 'gv7_mobile_link' || !isMobileInviteExpandedForTour()) return;
  enableTourNextButton(nextBtn);
}

function syncGuardiaToggleTourNext(nextBtn, stepId) {
  if (stepId !== 'gv7_guardia_toggle' || !isGuardiaEntregasFilterActiveForTour()) return;
  enableTourNextButton(nextBtn);
}

export function syncTourActionNextButton() {
  var nextBtn = document.getElementById('tour-btn-next');
  if (!nextBtn || !tourState.guidedTourActive) return;
  var stepId = tourState.tourStepId;
  syncLabParseTourNext(nextBtn, stepId);
  syncServicioDefaultTourNext(nextBtn, stepId);
  syncConnectionTourNext(nextBtn, stepId);
  syncMobileInviteTourNext(nextBtn, stepId);
  syncGuardiaToggleTourNext(nextBtn, stepId);
}

export function guidedTourStepIndex() {
  var steps = getGuidedTourSteps();
  var i = steps.indexOf(tourState.tourStepId);
  return i < 0 ? 0 : i;
}

// Quita cualquier resaltado del paso anterior antes de pintar el siguiente.
export function clearAllTourSpotlights() {
  var cls = ['tour-spotlight-soap', 'tour-spotlight-action'];
  cls.forEach(function (c) {
    document.querySelectorAll('.' + c).forEach(function (el) { el.classList.remove(c); });
  });
}

// Pasos donde el botón resaltado suele estar arriba a la derecha: dock abajo-derecha lo tapa.
var TOUR_DOCK_LEFT_STEPS = {
  ic_nota: 1,
  ic_indica: 1,
  estado_actual_registro: 1,
  listado_problemas: 1,
  livesync_desktop: 1,
  livesync_mobile: 1,
  gv7_lan_wifi: 1,
  gv7_lan_pin: 1,
  gv7_mobile_link: 1,
  gv7_mobile_scope: 1,
  gv7_mobile_vs_sala: 1,
};

export function syncTourDockPlacement() {
  var d = document.getElementById('tour-dock');
  if (!d) return;
  var useLeft = false;
  if (tourState.guidedTourActive && tourState.tourStepId && TOUR_DOCK_LEFT_STEPS[tourState.tourStepId]) useLeft = true;
  if (tourState.miniTourActive && tourState.miniTourSteps && tourState.miniTourSteps[tourState.miniTourIdx] && tourState.miniTourSteps[tourState.miniTourIdx].dockLeft) {
    useLeft = true;
  }
  if (useLeft) d.classList.add('tour-dock-pos-left');
  else d.classList.remove('tour-dock-pos-left');
}

export function tourApplySpotlightForStep(id, t, scrollDelayMs) {
  if (!t || !t.selector) return;
  var scrollDelay = scrollDelayMs != null ? scrollDelayMs : 140;
  setTimeout(function () {
    if (!tourState.guidedTourActive || tourState.tourStepId !== id) return;
    if (id === 'listado_problemas') rt.renderListadoForm();
    var el = document.querySelector(t.selector);
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_scrollErr) { void _scrollErr; }
    var spotlightCls = t.spotlightClass || (stepRequiresUserAction(id) ? 'tour-spotlight-soap' : null);
    if (spotlightCls) el.classList.add(spotlightCls);
    if (t.focus && typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }); } catch {
        try { el.focus(); } catch (_focusFallback) { void _focusFallback; }
      }
    }
  }, scrollDelay);
}

// Lleva al usuario al elemento del paso actual: cambia tab/tab interno,
// abre Mi Perfil/Ajustes si aplica, hace scroll y aplica spotlight para
// que la zona de avance sea inequívoca.
function applyGuardiaTourLayoutForStep(stepId) {
  void import('../../tour-guards.mjs').then((guards) => {
    if (!guards.isGuidedTourRunning()) return;
    if (guards.shouldShowGuardiaBoardWithoutEntrega(stepId)) {
      void Promise.all([
        import('../clinical-entrega.mjs'),
        import('../entrega-roster-panel.mjs'),
      ]).then(([entrega, roster]) => {
        entrega.endEntregaPhase();
        roster.closeEntregaRosterPanel();
        roster.deactivateTurnoActivo();
        document.documentElement.classList.remove('guardia-entrega-roster-open');
        if (typeof rt.renderGuardiaBoard === 'function') {
          rt.renderGuardiaBoard(rt.getSettings());
        }
      });
      return;
    }
    if (guards.shouldOpenEntregaRosterForTour(stepId)) {
      void import('../clinical-entrega.mjs').then((entrega) => {
        if (!entrega.isEntregaPhaseActive()) {
          void entrega.beginEntregaPhaseFlow({
            settings: rt.getSettings(),
            renderGuardiaBoard: rt.renderGuardiaBoard,
          });
          return;
        }
        void import('../entrega-roster-panel.mjs').then((roster) => {
          if (!roster.isEntregaRosterOpen()) {
            roster.openEntregaRosterPanel(rt.getSettings());
            rt.renderGuardiaBoard?.(rt.getSettings());
          }
        });
      });
    }
  });
}

function applyTourDensityForStep(id, t) {
  if (tourState.guidedTourActive && !t?.openGuardiaDensity) setUiDensity('normal');
  if (!t) return false;
  if (t.openGuardiaDensity) {
    if (!isGuardiaMode()) {
      setUiDensity('guardia');
      if (typeof rt.renderGuardiaBoard === 'function') rt.renderGuardiaBoard(rt.getSettings());
    }
    applyGuardiaTourLayoutForStep(id);
  }
  if (t.exitGuardiaDensity && isGuardiaMode()) setUiDensity('normal');
  return true;
}

function seedTourDemosForStep(id) {
  var cardioIds = {
    cardio_demo_intro: 1,
    cardio_descongestion: 1,
    sala_manejo: 1,
    sala_ic_hoja: 1,
    estado_actual: 1,
    estado_actual_review: 1,
    sala_tend: 1,
    sala_tend_chart: 1,
  };
  if (cardioIds[id] && (tourState.guidedTourBranch === 'quick-route' || tourState.guidedTourBranch === 'guardia-v7')) {
    void import('./tour-ic-demo-seed.mjs').then(function (mod) {
      if (typeof mod.ensureTourIcDemoPatientActive === 'function') {
        void mod.ensureTourIcDemoPatientActive();
      }
    });
    return;
  }
  if (TOUR_STEPS_USE_DEMO_PEREZ[id]) ensureTourPrimaryDemoPatientActive();
  if (id === 'listado_problemas') seedDemoListadoProblemas();
  if (
    id === 'estado_actual' ||
    id === 'cardio_descongestion' ||
    id === 'estado_actual_registro' ||
    isEstadoActualPostRegistroTourStep(id)
  ) {
    seedDemoMonitoreoOnActivePatient();
  }
  if (id === 'eventualidades') seedDemoEventualidadesOnActivePatient();
}

function applyTourTabsForStep(id, t) {
  if (t.appTab) rt.switchAppTab(t.appTab);
  if (!t.innerTab) return;
  if (id === 'listado_problemas') {
    rt.switchInnerTab('listado', { forceRender: true });
    rt.renderListadoForm();
  } else {
    rt.switchInnerTab(t.innerTab);
  }
  if (t.appTab !== 'nota') return;
  if (t.innerTab === 'notas') renderNoteForm();
  else if (t.innerTab === 'indica') renderIndicaForm();
}

function applyTourOverlayChromeForStep(id, t) {
  if (t.openProfile) ensureProfileExpandedForTour();
  else rt.closeProfileModal();
  if (t.openConnection) ensureConnectionExpandedForTour();
  else if (t.openSettings) ensureSettingsExpandedForTour();
  else {
    if (typeof closeSettingsDropdown === 'function') closeSettingsDropdown();
    if (typeof closeConnectionDropdown === 'function') closeConnectionDropdown();
  }
  if (id === 'sala_med') rt.renderMedRecetaPanel();
}

function scheduleEstadoActualTourPrep(id, t) {
  if (tourState.guidedTourBranch === 'interconsulta') return false;
  if (id === 'estado_actual' || id === 'cardio_descongestion') {
    setTimeout(function () {
      if (!tourState.guidedTourActive || tourState.tourStepId !== id) return;
      prepareEstadoActualPanelForTour();
    }, 160);
    return false;
  }
  if (id === 'estado_actual_registro') {
    setTimeout(function () {
      if (!tourState.guidedTourActive || tourState.tourStepId !== 'estado_actual_registro') return;
      prepareEstadoActualPanelForTour(function () {
        if (!tourState.guidedTourActive || tourState.tourStepId !== 'estado_actual_registro') return;
        openTourEstadoActualRegistroDemo();
      });
    }, 160);
    return false;
  }
  if (!isEstadoActualPostRegistroTourStep(id)) return false;
  clearAllTourSpotlights();
  if (!t.selector) return true;
  var postRegStepId = id;
  var spotlightDelay = 400;
  setTimeout(function () {
    if (!tourState.guidedTourActive || tourState.tourStepId !== postRegStepId) return;
    prepareEstadoActualPanelForTour(function () {
      tourApplySpotlightForStep(postRegStepId, t, spotlightDelay);
    });
  }, 160);
  return true;
}

function closeStaleModalsForTourStep(id) {
  if (id === 'sala_med' || id === 'listado_problemas') closeSOAPModal();
}

export function applyTourTargetForStep(id) {
  var t = getTourTarget(id, resolveTourBranch());
  if (!applyTourDensityForStep(id, t)) return;
  seedTourDemosForStep(id);
  applyTourTabsForStep(id, t);
  applyTourOverlayChromeForStep(id, t);
  if (scheduleEstadoActualTourPrep(id, t)) return;
  if (id === 'map_lab_teaser' || id === 'lab_parse') ensureTourDemoLabInputBoth();
  closeStaleModalsForTourStep(id);
  clearAllTourSpotlights();
  if (!t.selector) return;
  tourApplySpotlightForStep(id, t, id === 'listado_problemas' ? 280 : 140);
}

export { applyTourDemoIngresoDates };
