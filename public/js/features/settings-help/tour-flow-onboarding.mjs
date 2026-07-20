/** Start guided tour and lab demo patient hooks. */
import { applyAppModeSwitchEffects } from '../profile.mjs';
import { buildBulkLabPreview, extractLabPatientFromBulkBlock } from '../../lab-bulk-paste.mjs';
import {
  DEMO_REGISTRO,
  DEMO_REGISTRO_2,
  findTourDemoPatientByRegistro,
  isTourDemoPatientId,
  tourDemoLabCompleteForTour,
  tourDemoPatientsBothInCensus,
} from '../../tour-demo-patient.mjs';
import { renderPatientList, selectPatient } from '../patients.mjs';
import { limpiarReporte } from '../lab-panel.mjs';
import { patients, labHistory, saveState } from '../../app-state.mjs';
import { setUiDensity } from '../chrome.mjs';
import { closeSettingsDropdown } from './settings-dropdown.mjs';
import { getGuidedTourSteps, applyTourTargetForStep, clearAllTourSpotlights, persistTourProgressDebounced, showTourDock, hideTourDock, resetTourUiBeforeResume, hideTourIntroModal, openTutorialIntroFromSettings, syncTourActionNextButton } from './tour-engine.mjs';
import { purgeTourDemoPatientsFromState, ensureTourPrimaryDemoPatientActive } from './tour-demo-seed.mjs';
import { renderTourStep } from './tour-flow-render.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { tourState, publishTourGuardContext, GUIDED_TOUR_LS_KEY } from './tour-state.mjs';

const rt = getSettingsHelpRuntime();

function resolveTourBranch(branch) {
  if (branch === 'interconsulta') return 'interconsulta';
  if (branch === 'guardia-v7') return 'guardia-v7';
  if (branch === 'quick-route') return 'quick-route';
  return 'sala';
}

function setupNonGuardiaTourMode() {
  setUiDensity('normal');
  var st = rt.getSettings();
  var prevMode = st.appMode;
  st.appMode = tourState.guidedTourBranch === 'interconsulta' ? 'interconsulta' : 'sala';
  if (st.appMode !== prevMode) {
    try { localStorage.setItem('rpc-settings', JSON.stringify(st)); } catch (_e) { void _e; }
    applyAppModeSwitchEffects();
    rt.renderEstadoActualBar();
  }
  tourState.tourDemoLabSessionProcessed = false;
  purgeTourDemoPatientsFromState();
}

function resetTourDemoPatientSelection() {
  if (!isTourDemoPatientId(rt.getActiveId(), patients)) return;
  rt.setActiveId(patients.length ? patients[0].id : null);
  if (rt.getActiveId()) {
    selectPatient(rt.getActiveId());
    return;
  }
  var pv0 = document.getElementById('patient-view');
  var es0 = document.getElementById('empty-state');
  if (pv0) pv0.style.display = 'none';
  if (es0) es0.style.display = 'flex';
}

function resolveTourStartStep(opts) {
  var steps = getGuidedTourSteps();
  var resumeId = opts.resumeStepId;
  if (resumeId && steps.indexOf(resumeId) >= 0) return resumeId;
  return steps[0] || 'map_sidebar';
}

function startOnboarding(branch, opts) {
  opts = opts || {};
  if (opts.resumeStepId) resetTourUiBeforeResume();
  tourState.guidedTourBranch = resolveTourBranch(branch);
  var isGuardiaV7 = tourState.guidedTourBranch === 'guardia-v7';
  var isCardioTrack =
    tourState.guidedTourBranch === 'quick-route' || tourState.guidedTourBranch === 'guardia-v7';
  if (!opts.resumeStepId) {
    tourState.guidedTourChapterScope = null;
    tourState.guidedTourModuleOnly = false;
  }
  if (!isGuardiaV7) setupNonGuardiaTourMode();
  tourState.guidedTourActive = true;
  tourState.tourStepId = resolveTourStartStep(opts);
  renderPatientList();
  resetTourDemoPatientSelection();
  function finishTourStart() {
    applyTourTargetForStep(tourState.tourStepId);
    showTourDock();
    renderTourStep();
    publishTourGuardContext();
    if (opts.resumeStepId) persistTourProgressDebounced();
  }
  function afterOptionalIcSeed() {
    if (opts.resumeStepId) {
      setTimeout(finishTourStart, 0);
    } else {
      finishTourStart();
    }
  }
  if (isCardioTrack) {
    void import('./tour-ic-demo-seed.mjs')
      .then(function (mod) {
        if (typeof mod.ensureTourIcDemoPatientActive === 'function') {
          return mod.ensureTourIcDemoPatientActive();
        }
        return false;
      })
      .finally(afterOptionalIcSeed);
    return;
  }
  afterOptionalIcSeed();
}

function findTourDemoBlockForRegistro(blocks, registro) {
  var reg = String(registro || '').trim();
  if (!reg || !blocks) return null;
  if (findTourDemoPatientByRegistro(patients, reg)) return null;
  return (
    blocks.find(function (b) {
      if (!b || !b.okReportCount) return false;
      if (String(b.primaryExpediente || '').trim() !== reg) return false;
      return b.status === 'no-patient' || !b.patient;
    }) || null
  );
}

var tourLabRegistrationTimer = null;

function getTourLabPasteTextForRegistration() {
  var ta = document.getElementById('lab-input');
  var text = ta ? String(ta.value || '').trim() : '';
  if (text) return text;
  if (typeof rt.getBulkLabPreviewSourceText === 'function') {
    return String(rt.getBulkLabPreviewSourceText() || '').trim();
  }
  return '';
}

function runTourDemoPatientRegistrationFromLab() {
  if (!tourState.guidedTourActive || tourState.tourStepId !== 'lab_parse') return;
  if (tourDemoPatientsBothInCensus(patients)) return;
  if (typeof rt.openAddModalFromLabPatient !== 'function') return;
  var text = getTourLabPasteTextForRegistration();
  if (!text) return;
  var blocks = buildBulkLabPreview(text, { findPatientByRegistro: rt.findPatientByRegistro });
  openNextTourDemoPatientFromBlocks(blocks);
}

function scheduleTourDemoPatientRegistrationFromLab() {
  if (tourLabRegistrationTimer) clearTimeout(tourLabRegistrationTimer);
  tourLabRegistrationTimer = setTimeout(function () {
    tourLabRegistrationTimer = null;
    runTourDemoPatientRegistrationFromLab();
  }, 280);
}

function openNextTourDemoPatientFromBlocks(blocks) {
  var regs = [DEMO_REGISTRO, DEMO_REGISTRO_2];
  for (var i = 0; i < regs.length; i++) {
    var reg = regs[i];
    if (findTourDemoPatientByRegistro(patients, reg)) continue;
    var block = findTourDemoBlockForRegistro(blocks, reg);
    if (!block) continue;
    var labPatient = extractLabPatientFromBulkBlock(block);
    if (!labPatient) continue;
    rt.openAddModalFromLabPatient(labPatient, {
      onSaved: function () {
        scheduleTourDemoPatientRegistrationFromLab();
      },
    });
    return;
  }
}

function onboardingAdvanceAfterParse() {
  if (!tourState.guidedTourActive || tourState.tourStepId !== 'lab_parse') return;
  if (!tourDemoLabCompleteForTour(patients, labHistory)) {
    syncTourActionNextButton();
    return;
  }
  tourState.tourDemoLabSessionProcessed = true;
  ensureTourPrimaryDemoPatientActive();
  clearAllTourSpotlights();
  tourState.tourStepId = 'lab_view';
  publishTourGuardContext();
  applyTourTargetForStep(tourState.tourStepId);
  renderTourStep();
  persistTourProgressDebounced();
  syncTourActionNextButton();
}

function onboardingAdvanceAfterSend() {
  if (!tourState.guidedTourActive) return;
  if (tourState.tourStepId !== 'lab_view') return;
  var steps = getGuidedTourSteps();
  var i = steps.indexOf('lab_view');
  if (i < 0 || i + 1 >= steps.length) return;
  clearAllTourSpotlights();
  tourState.tourStepId = steps[i + 1];
  publishTourGuardContext();
  applyTourTargetForStep(tourState.tourStepId);
  renderTourStep();
}

function tourAfterBulkLabParse(_blocks) {
  if (!tourState.guidedTourActive || tourState.tourStepId !== 'lab_parse') return;
  if (!tourDemoPatientsBothInCensus(patients)) {
    if (typeof rt.isBulkLabPreviewModalOpen === 'function' && rt.isBulkLabPreviewModalOpen()) {
      return;
    }
    scheduleTourDemoPatientRegistrationFromLab();
    return;
  }
  onboardingAdvanceAfterParse();
  syncTourActionNextButton();
}

function tourOnBulkPreviewPatientSaved() {
  if (!tourState.guidedTourActive || tourState.tourStepId !== 'lab_parse') return;
  if (tourDemoPatientsBothInCensus(patients)) {
    rt.showToast('Pacientes demo listos. Pulsa Procesar todo en la vista previa.', 'success');
    return;
  }
  rt.showToast('Registra al otro paciente con Agregar paciente en la tabla.', 'info');
}

function resetAndStartOnboarding() {
  // El botón vive dentro del modal Mi Perfil; ciérralo antes de mostrar
  // el tour para que no se quede flotando encima.
  rt.closeProfileModal();
  closeSettingsDropdown();
  try {
    localStorage.removeItem(GUIDED_TOUR_LS_KEY);
  } catch (_e) { void _e; }
  try {
    purgeTourDemoPatientsFromState();
    tourState.guidedTourActive = false;
    tourState.tourStepId = null;
    tourState.guidedTourBranch = null;
    publishTourGuardContext();
    hideTourDock();
    hideTourIntroModal();
    limpiarReporte();
    saveState();
    if (isTourDemoPatientId(rt.getActiveId(), patients)) {
      rt.setActiveId(patients.length ? patients[0].id : null);
    }
    renderPatientList();
    if (rt.getActiveId()) selectPatient(rt.getActiveId());
    else {
      var pv = document.getElementById('patient-view');
      var es = document.getElementById('empty-state');
      if (pv) pv.style.display = 'none';
      if (es) es.style.display = 'flex';
    }
  } catch (err) {
    console.error('resetAndStartOnboarding cleanup:', err && err.message);
  }
  void openTutorialIntroFromSettings();
}

export {
  startOnboarding,
  onboardingAdvanceAfterParse,
  onboardingAdvanceAfterSend,
  tourAfterBulkLabParse,
  tourOnBulkPreviewPatientSaved,
  scheduleTourDemoPatientRegistrationFromLab,
  resetAndStartOnboarding,
};
