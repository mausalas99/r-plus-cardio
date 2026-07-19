/** Guided tours, mini tours, demo patient hooks. */
import { getFirstStepIdForChapter } from '../../onboarding-curriculum.mjs';
import {
  isPresentationModeActive,
  startPresentationMode,
  stopPresentationMode,
} from '../../presentation-mode.mjs';
import { registerTourDemoPatientHooks } from '../../tour-demo-patient.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import {
  closeSettingsDropdown,
  ensureSettingsDropdownOpen,
  expandSettingsAccordionBackupSync,
} from './settings-dropdown.mjs';
import {
  showTourDock,
  hideTourDock,
  syncTourDockPlacement,
  resetTourUiBeforeResume,
  hideTourIntroModal,
} from './tour-engine.mjs';
import {
  startOnboarding,
  resetAndStartOnboarding,
  scheduleTourDemoPatientRegistrationFromLab,
} from './tour-flow.mjs';
import { applyTourDemoPatientBundle } from './tour-demo-seed.mjs';
import { tourState, publishTourGuardContext } from './tour-state.mjs';

const rt = getSettingsHelpRuntime();


/** Mini tours and help entrypoints */
// ── Bloque L · Tours contextuales (mini tours) ─────────────────────
var SETTINGS_MINI_TOUR_STEPS = [
  {
    badge: 'Ajustes · panel',
    body: 'Abrimos el panel de <strong>Ajustes</strong> (icono ⚙ arriba a la derecha). Desde aquí defines la <strong>carpeta de documentos</strong> y el <strong>formato de Salida rápida</strong> (docx / html / txt) para el paciente activo.',
    before: function(){ ensureSettingsDropdownOpen(); }
  },
  {
    badge: 'Ajustes · respaldo',
    body: '<strong>Copias de seguridad</strong>: exporta todo, solo al paciente activo, un rango de fechas, o activa la <strong>copia automática</strong> (hasta 14 snapshots locales rotativos).',
    before: function(){ ensureSettingsDropdownOpen(); expandSettingsAccordionBackupSync(); }
  },
  {
    badge: 'Ajustes · sync',
    body: 'Si usas R+ en más de un equipo, el <strong>Paquete sync</strong> intercambia JSON cifrados con passphrase y combina cambios sin pisar lo que ya tenías.',
    before: function(){ ensureSettingsDropdownOpen(); expandSettingsAccordionBackupSync(); }
  },
  {
    badge: 'Ajustes · datos',
    body: 'En <strong>Datos en esta computadora</strong> puedes abrir la carpeta del perfil donde Electron guarda pacientes y notas. No compartas esa carpeta si contiene información sensible.',
    before: function(){ ensureSettingsDropdownOpen(); }
  },
  {
    badge: 'Ajustes · aplicación',
    body: 'Arriba del panel está el acceso directo al <strong>centro de ayuda</strong>. En <strong>Aplicación</strong> (sección inferior) ves la versión y puedes <strong>buscar actualizaciones</strong>.',
    before: function(){ ensureSettingsDropdownOpen(); }
  }
];

var LAB_MINI_TOUR_STEPS = [
  {
    badge: 'Laboratorio · pegar',
    body: 'Estás en la pestaña <strong>Laboratorio</strong>. Pega el reporte del laboratorio en el cuadro de texto. R+ reconoce biometría, química, electrolitos, gasometría, pruebas hepáticas y más.',
    before: function(){ rt.switchAppTab('lab'); }
  },
  {
    badge: 'Laboratorio · procesar',
    body: 'Pulsa <strong>Procesar</strong>: R+ genera diagramas automáticos (Gamble, BH, Química, Coagulación…) y una tabla de resultados con los valores alterados resaltados en rojo.',
    before: function(){ rt.switchAppTab('lab'); }
  },
  {
    badge: 'Laboratorio · copiar',
    body: 'Tras procesar, usa el botón flotante <strong>Copiar</strong> o el de cada diagrama. Con paciente activo, los resultados quedan en historial y en el expediente.',
    before: function(){ rt.switchAppTab('lab'); },
    dockLeft: true,
  },
  {
    badge: 'Laboratorio · tendencias',
    body: 'Cada laboratorio procesado con paciente activo se guarda con su fecha. Con dos o más labs aparecen mini-gráficas en <strong>Expediente → Tendencias</strong>.',
    before: function(){ rt.switchAppTab('lab'); }
  },
  {
    badge: 'Laboratorio · historial',
    body: 'En <strong>Resultados</strong>, el selector de fechas cambia entre envíos guardados del paciente activo. El menú <strong>⋯</strong> permite copiar varios días, consolidar envíos del mismo día, reprocesar o eliminar una entrada.',
    before: function(){ rt.switchAppTab('lab'); }
  },
  {
    badge: 'Evolución · SOAP y medicamentos',
    body: 'En <strong>Expediente → Notas</strong> usa la <strong>plantilla SOAP</strong> para párrafos estructurados. La pestaña <strong>Medicamentos</strong> importa la receta del hospital y puede mandar dosis a SOAP o al tratamiento.',
    before: function(){ rt.switchAppTab('nota'); }
  }
];


function startMiniTour(kind) {
  if (tourState.guidedTourActive) {
    rt.showToast('Finaliza el tutorial actual antes de iniciar un recorrido breve.', 'error');
    return;
  }
  var steps = null;
  if (kind === 'ajustes') steps = SETTINGS_MINI_TOUR_STEPS;
  else if (kind === 'lab') steps = LAB_MINI_TOUR_STEPS;
  if (!steps || !steps.length) return;
  settingsHelpBridge.closeQuickHelp();
  tourState.miniTourActive = true;
  tourState.miniTourSteps = steps;
  tourState.miniTourIdx = 0;
  publishTourGuardContext();
  showTourDock();
  renderMiniTourStep();
}

function renderMiniTourStep() {
  if (!tourState.miniTourActive || !tourState.miniTourSteps) return;
  var step = tourState.miniTourSteps[tourState.miniTourIdx];
  if (!step) { endMiniTour(); return; }
  if (typeof step.before === 'function') {
    try { step.before(); } catch { /* step.before may throw if DOM not ready */ }
  }
  var badge = document.getElementById('tour-step-badge');
  var body = document.getElementById('tour-dock-body');
  var nextBtn = document.getElementById('tour-btn-next');
  var skipBtn = document.querySelector('#tour-dock .btn-tour-skip');
  if (badge) {
    badge.textContent = step.badge + ' · ' + (tourState.miniTourIdx + 1) + ' / ' + tourState.miniTourSteps.length;
  }
  if (body) body.innerHTML = step.body;
  if (nextBtn) {
    nextBtn.style.display = '';
    nextBtn.disabled = false;
    nextBtn.textContent = tourState.miniTourIdx === tourState.miniTourSteps.length - 1 ? 'Finalizar' : 'Siguiente';
  }
  if (skipBtn) skipBtn.textContent = 'Cerrar recorrido';
  syncTourDockPlacement();
}

function miniTourNext() {
  if (!tourState.miniTourActive) return;
  if (tourState.miniTourIdx >= (tourState.miniTourSteps ? tourState.miniTourSteps.length : 0) - 1) {
    endMiniTour();
    return;
  }
  tourState.miniTourIdx++;
  renderMiniTourStep();
}

function endMiniTour() {
  tourState.miniTourActive = false;
  tourState.miniTourSteps = null;
  tourState.miniTourIdx = 0;
  publishTourGuardContext();
  hideTourDock();
  var skipBtn = document.querySelector('#tour-dock .btn-tour-skip');
  if (skipBtn) skipBtn.textContent = 'Omitir tutorial';
}

function startHelpTourMain() {
  if (tourState.miniTourActive) endMiniTour();
  if (isPresentationModeActive()) {
    rt.showToast('Finaliza el modo presentación antes de iniciar el tutorial guiado.', 'error');
    return;
  }
  settingsHelpBridge.closeQuickHelp();
  resetAndStartOnboarding();
}

function startTourModule(chapterId) {
  var cid = String(chapterId || '');
  if (cid === 'ch-quick-route') {
    startQuickRouteTour();
    return;
  }
  var branch =
    cid.indexOf('ch-guardia-') === 0 ? 'guardia-v7'
      : cid.indexOf('ch-ic') === 0 ? 'interconsulta'
        : 'sala';
  var stepId = getFirstStepIdForChapter(chapterId, branch);
  if (!stepId) return;
  if (tourState.guidedTourActive) {
    rt.showToast('Finaliza o pausa el tutorial actual primero.', 'error');
    return;
  }
  if (tourState.miniTourActive) endMiniTour();
  if (isPresentationModeActive()) {
    rt.showToast('Finaliza el modo presentación antes de iniciar un módulo.', 'error');
    return;
  }
  tourState.guidedTourMode = 'base';
  tourState.guidedTourChapterScope = cid;
  tourState.guidedTourModuleOnly = true;
  resetTourUiBeforeResume();
  startOnboarding(branch, { resumeStepId: stepId, skipIntro: true });
}

function startQuickRouteTour() {
  if (tourState.guidedTourActive) {
    rt.showToast('Finaliza o pausa el tutorial actual primero.', 'error');
    return;
  }
  if (tourState.miniTourActive) endMiniTour();
  if (isPresentationModeActive()) {
    rt.showToast('Finaliza el modo presentación antes de iniciar la ruta rápida.', 'error');
    return;
  }
  tourState.guidedTourMode = 'base';
  tourState.guidedTourChapterScope = 'ch-quick-route';
  tourState.guidedTourModuleOnly = true;
  resetTourUiBeforeResume();
  startOnboarding('quick-route', { skipIntro: true });
}

function startHelpTourInterconsulta() {
  if (tourState.guidedTourActive) {
    rt.showToast('Finaliza o pausa el tutorial actual primero.', 'error');
    return;
  }
  if (tourState.miniTourActive) endMiniTour();
  if (isPresentationModeActive()) {
    rt.showToast('Finaliza el modo presentación antes de iniciar el tutorial.', 'error');
    return;
  }
  settingsHelpBridge.closeQuickHelp();
  hideTourIntroModal();
  tourState.guidedTourMode = 'base';
  startOnboarding('interconsulta', { skipIntro: true });
}

function togglePresentationModeFromHelp() {
  if (tourState.guidedTourActive) {
    rt.showToast('Finaliza el tutorial guiado antes del modo presentación.', 'error');
    return;
  }
  if (tourState.miniTourActive) endMiniTour();
  settingsHelpBridge.closeQuickHelp();
  closeSettingsDropdown();
  if (isPresentationModeActive()) stopPresentationMode();
  else startPresentationMode();
}


export {
  startMiniTour,
  startHelpTourMain,
  startTourModule,
  startQuickRouteTour,
  startHelpTourInterconsulta,
  togglePresentationModeFromHelp,
  miniTourNext,
  endMiniTour,
};
registerTourDemoPatientHooks({
  isTourActive: function () {
    return tourState.guidedTourActive;
  },
  getTourStep: function () {
    return tourState.tourStepId;
  },
  applyBundle: applyTourDemoPatientBundle,
  scheduleLabPatientRegistration: scheduleTourDemoPatientRegistrationFromLab,
  switchAppTab: function (tab) {
    rt.switchAppTab(tab);
  },
  showToast: function (msg, type) {
    rt.showToast(msg, type);
  },
});