/** Tour dock step rendering. */
import { stepRequiresUserAction } from '../../tour-targets.mjs';
import { getChapterProgressLabel } from '../../onboarding-curriculum.mjs';
import {
  getGuidedTourSteps,
  resolveTourBranch,
  syncTourDockPlacement,
  syncTourSoapButtonHighlight,
  syncTourActionNextButton,
  armTourActionPoll,
  guidedTourStepIndex,
} from './tour-engine.mjs';
import {
  getGuardiaV7StepHtml,
  escapeTourHtml,
} from './tour-flow-guardia-copy.mjs';
import { renderFundamentosStep } from './tour-flow-fundamentos-steps.mjs';
import { tourState } from './tour-state.mjs';

function syncTourDockBranchClass(branch) {
  var d = document.getElementById('tour-dock');
  if (!d) return;
  d.classList.toggle('tour-dock--guardia', branch === 'guardia-v7');
  d.classList.toggle('tour-dock--fundamentos', branch === 'sala' || branch === 'interconsulta');
  d.classList.toggle('tour-dock--quick-route', branch === 'quick-route');
}

function resetTourNextButton(nextBtn) {
  nextBtn.style.display = '';
  nextBtn.disabled = false;
  nextBtn.setAttribute('onclick', 'guidedTourClickNext()');
}

function renderQuickRouteStepCopy(bodyEl, nextBtn) {
  var id = tourState.tourStepId;
  if (id === 'cardio_demo_intro') {
    bodyEl.innerHTML =
      '<p style="margin:0;line-height:1.5;"><strong>Ruta rápida IC:</strong> ya está el caso completo <strong>Rosa María Delgado Vázquez</strong> en el censo (descongestión, POCUS, Manejo, labs).</p>' +
      '<p style="margin:10px 0 0;font-size:13px;color:var(--text-muted);">Pulsa <strong>Siguiente</strong> — no hace falta procesar DEMO PÉREZ ni DEMO GARCÍA.</p>';
    nextBtn.textContent = 'Siguiente';
    return true;
  }
  if (id.indexOf('gv7_') === 0) {
    bodyEl.innerHTML = getGuardiaV7StepHtml(id);
    nextBtn.textContent = 'Siguiente';
    return true;
  }
  // Cardio quick-route steps reuse Fundamentos copy (descongestión, Manejo, hoja IC).
  return false;
}

function renderTourDockBadge(tourBranch, prog, idx, total) {
  var badge = document.getElementById('tour-step-badge');
  if (!badge) return;
  if (tourBranch === 'quick-route') {
    badge.innerHTML =
      '<span class="tour-dock-badge-line tour-dock-badge-kicker">Ruta rápida</span>' +
      '<span class="tour-dock-badge-line tour-dock-badge-step">Paso ' +
      prog.stepInChapter + ' de ' + prog.chapterSteps + '</span>';
    return;
  }
  if (tourBranch === 'guardia-v7') {
    badge.innerHTML =
      '<span class="tour-dock-badge-line tour-dock-badge-kicker">R+ Cardio</span>' +
      '<span class="tour-dock-badge-line tour-dock-badge-module">Módulo ' +
      prog.chapterIndex + '/5 · ' + escapeTourHtml(prog.chapterTitle) + '</span>' +
      '<span class="tour-dock-badge-line tour-dock-badge-step">Paso ' +
      prog.stepInChapter + ' de ' + prog.chapterSteps + '</span>';
    return;
  }
  var branchLabel = 'R+ Cardio';
  var sub =
    'Cap. ' + prog.chapterIndex + '/' + prog.chapterCount + ' · ' + prog.chapterTitle +
    ' · paso ' + prog.stepInChapter + '/' + prog.chapterSteps;
  badge.innerHTML =
    '<span class="tour-dock-badge-line tour-dock-badge-module">Paso ' + idx + ' de ' + total +
    ' · ' + escapeTourHtml(branchLabel) + '</span>' +
    '<span class="tour-dock-badge-line tour-dock-badge-step">' + escapeTourHtml(sub) + '</span>';
}

function finalizeTourStepRender(prevBtn) {
  syncTourDockPlacement();
  syncTourSoapButtonHighlight();
  syncTourActionNextButton();
  armTourActionPoll();
  if (prevBtn) prevBtn.disabled = guidedTourStepIndex() <= 0;
}

function applyTourStepUserActionGate(nextBtn) {
  if (stepRequiresUserAction(tourState.tourStepId) && tourState.tourStepId !== 'servicio_default') {
    nextBtn.style.display = 'none';
  }
}

function renderQuickRouteWrap(bodyEl, nextBtn, prevBtn) {
  bodyEl.innerHTML =
    '<p style="margin:0;line-height:1.5;">Listo. Explora más en <strong>Aprender R+ Cardio</strong>: módulos cortos o el tutorial completo en <strong>Fundamentos</strong>.</p>';
  nextBtn.textContent = 'Finalizar';
  nextBtn.style.display = '';
  nextBtn.setAttribute('onclick', 'guidedTourFinish()');
  finalizeTourStepRender(prevBtn);
}

function renderQuickRouteBranch(bodyEl, nextBtn, prevBtn) {
  var quickHandled = renderQuickRouteStepCopy(bodyEl, nextBtn);
  if (!quickHandled) return false;
  if (stepRequiresUserAction(tourState.tourStepId)) {
    nextBtn.style.display = 'none';
  }
  finalizeTourStepRender(prevBtn);
  return true;
}

function renderGuardiaV7Branch(bodyEl, nextBtn, prevBtn) {
  var id = tourState.tourStepId;
  if (String(id || '').indexOf('gv7_') === 0) {
    bodyEl.innerHTML = getGuardiaV7StepHtml(id);
  } else {
    renderFundamentosStep(id, bodyEl, nextBtn);
  }
  var gv7Steps = getGuidedTourSteps();
  var gv7Idx = gv7Steps.indexOf(id);
  nextBtn.textContent =
    gv7Idx >= 0 && gv7Idx >= gv7Steps.length - 1 ? 'Finalizar módulo' : 'Siguiente';
  if (stepRequiresUserAction(id)) {
    nextBtn.style.display = 'none';
  }
  finalizeTourStepRender(prevBtn);
}

function renderGuardiaOrQuickRouteStep(bodyEl, nextBtn, prevBtn, tourBranch) {
  if (tourBranch !== 'guardia-v7' && tourBranch !== 'quick-route') return false;
  if (tourBranch === 'quick-route' && tourState.tourStepId === 'quick_wrap') {
    renderQuickRouteWrap(bodyEl, nextBtn, prevBtn);
    return true;
  }
  if (tourBranch === 'quick-route') {
    if (renderQuickRouteBranch(bodyEl, nextBtn, prevBtn)) return true;
    // Fall through: cardio quick-route steps use Fundamentos copy.
    renderFundamentosStep(tourState.tourStepId, bodyEl, nextBtn);
    applyTourStepUserActionGate(nextBtn);
    finalizeTourStepRender(prevBtn);
    return true;
  }
  renderGuardiaV7Branch(bodyEl, nextBtn, prevBtn);
  return true;
}

function renderTourStep() {
  if (!tourState.guidedTourActive) return;
  var bodyEl = document.getElementById('tour-dock-body');
  var nextBtn = document.getElementById('tour-btn-next');
  var prevBtn = document.getElementById('tour-btn-prev');
  var steps = getGuidedTourSteps();
  var total = steps.length;
  var idx = guidedTourStepIndex() + 1;
  var tourBranch = resolveTourBranch();
  syncTourDockBranchClass(tourBranch);
  var prog = getChapterProgressLabel(tourState.tourStepId, tourBranch);
  renderTourDockBadge(tourBranch, prog, idx, total);
  resetTourNextButton(nextBtn);

  if (renderGuardiaOrQuickRouteStep(bodyEl, nextBtn, prevBtn, tourBranch)) {
    return;
  }

  renderFundamentosStep(tourState.tourStepId, bodyEl, nextBtn);
  applyTourStepUserActionGate(nextBtn);
  finalizeTourStepRender(prevBtn);
}

export { renderTourStep };
