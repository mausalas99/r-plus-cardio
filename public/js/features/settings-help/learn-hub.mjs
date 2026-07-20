import {
  GUARDIA_V7_HUB_MODULES,
  QUICK_ROUTE_HUB_MODULE,
  SALA_HUB_MODULES,
  GUARDIA_V7_CHAPTERS,
  SALA_CHAPTERS,
  getChapterForStep,
  getChapterProgressLabel,
} from '../../onboarding-curriculum.mjs';
import { loadTourProgress } from '../../onboarding-progress.mjs';
import {
  loadGuardiaV7Progress,
  resetGuardiaV7Chapter,
} from '../../guardia-v7-progress.mjs';
import {
  loadFundamentosProgress,
  fundamentosModuleCount,
  isFundamentosChapterId,
} from '../../fundamentos-progress.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { closeModalAnimated } from '../../ui-motion.mjs';
import { needsClinicalOnboarding } from '../clinical-onboarding.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';

import { escapeHtml } from '../../dom-escape.mjs';
let learnHubDismissWired = false;
let learnHubLastFocus = null;

function estMinutesForSteps(stepCount) {
  const n = Math.max(1, Number(stepCount) || 1);
  return Math.max(1, Math.round(n * 0.75));
}

function stepCountForChapter(chapterId, branch) {
  if (branch === 'quick-route') {
    return QUICK_ROUTE_HUB_MODULE.stepCount || 0;
  }
  if (branch === 'guardia-v7') {
    const ch = GUARDIA_V7_CHAPTERS.find((c) => c.id === chapterId);
    return ch ? ch.stepIds.length : 0;
  }
  const ch = SALA_CHAPTERS.find((c) => c.id === chapterId);
  return ch ? ch.stepIds.length : 0;
}

function moduleStatusLabel({ completed, inProgress, stepInChapter, chapterSteps }) {
  if (completed) return 'Completado';
  if (inProgress && stepInChapter > 0) {
    return `En curso · paso ${stepInChapter} de ${chapterSteps}`;
  }
  if (inProgress) return 'En curso';
  return 'Pendiente';
}

function buildModuleIndexBadge({ moduleIndex }) {
  if (moduleIndex != null) {
    return `<span class="learn-hub-module-index" aria-hidden="true">${moduleIndex}</span>`;
  }
  return '';
}

function buildModuleStatusIcon({ completed, inProgress }) {
  if (completed) return '<span class="learn-hub-module-check" aria-hidden="true">✓</span>';
  if (inProgress) return '<span class="learn-hub-module-dot" aria-hidden="true"></span>';
  return '';
}

function buildModuleResetBtn({ completed, allowReset, chapterId, branch, label }) {
  if (!completed || !allowReset) return '';
  return (
    `<button type="button" class="learn-hub-module-reset"` +
    ` data-learn-reset="${escapeHtml(chapterId)}" data-learn-reset-branch="${escapeHtml(branch)}"` +
    ` title="Resetear progreso" aria-label="Resetear ${escapeHtml(label)}">` +
    `<span class="learn-hub-module-reset-icon" aria-hidden="true">↺</span>` +
    `</button>`
  );
}

function buildModuleRow({
  chapterId,
  label,
  branch,
  completed,
  inProgress,
  stepInChapter,
  chapterSteps,
  active,
  moduleIndex = null,
  allowReset = false,
}) {
  const mins = estMinutesForSteps(chapterSteps);
  const status = moduleStatusLabel({ completed, inProgress, stepInChapter, chapterSteps });
  const cardCls = [
    'learn-hub-module-card',
    active ? 'is-active' : '',
    completed ? 'is-complete' : '',
    inProgress ? 'is-in-progress' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const indexBadge = buildModuleIndexBadge({ moduleIndex });
  const statusLine =
    chapterSteps > 0
      ? `<span class="learn-hub-module-meta">${chapterSteps} pasos · ~${mins} min</span>`
      : '';
  const statusIcon = buildModuleStatusIcon({ completed, inProgress });
  const hitAttrs =
    ` data-learn-chapter="${escapeHtml(chapterId)}" data-learn-branch="${escapeHtml(branch)}"`;
  const resetBtn = buildModuleResetBtn({
    completed,
    allowReset,
    chapterId,
    branch,
    label,
  });
  return (
    `<div class="${cardCls}">` +
    `<div class="learn-hub-module-row">` +
    `<button type="button" class="learn-hub-module-hit"` +
    hitAttrs +
    ` title="${escapeHtml(label)} — ${escapeHtml(status)}">` +
    indexBadge +
    `<span class="learn-hub-module-main">` +
    `<span class="learn-hub-module-title">${escapeHtml(label)}</span>` +
    statusLine +
    `</span>` +
    `<span class="learn-hub-module-status">` +
    `<span class="learn-hub-module-status-text">${statusIcon}${escapeHtml(status)}</span>` +
    `</span>` +
    `<span class="learn-hub-module-chevron" aria-hidden="true">›</span>` +
    `</button>` +
    resetBtn +
    `</div></div>`
  );
}

function startLearnModule(chapterId) {
  closeLearnHub();
  void import('./tour-runtime.mjs').then((mod) => {
    if (typeof mod.startTourModule === 'function') mod.startTourModule(chapterId);
  });
}

function resetLearnModuleProgress(chapterId, branch, focusTrack) {
  if (branch === 'guardia-v7') {
    resetGuardiaV7Chapter(chapterId);
    getSettingsHelpRuntime().showToast('Módulo reseteado. Ábrelo cuando quieras.', 'info');
    renderLearnHubBody(focusTrack);
  }
}

function guardiaModuleState(chapterId, progress, tourProgress) {
  const chapterSteps = stepCountForChapter(chapterId, 'guardia-v7');
  const completed = progress.completedChapters.includes(chapterId);
  let inProgress = false;
  let stepInChapter = 0;
  if (tourProgress && tourProgress.branch === 'guardia-v7' && tourProgress.stepId) {
    const ch = getChapterForStep(tourProgress.stepId, 'guardia-v7');
    if (ch.id === chapterId) {
      inProgress = !completed;
      const prog = getChapterProgressLabel(tourProgress.stepId, 'guardia-v7');
      stepInChapter = prog.stepInChapter;
    }
  }
  return {
    completed,
    inProgress,
    stepInChapter,
    chapterSteps,
    active: inProgress && tourProgress && tourProgress.chapterId === chapterId,
  };
}

function fundamentosModuleState(chapterId, branch, progress, tourProgress) {
  const chapterSteps = stepCountForChapter(chapterId, branch);
  const completed = progress.completedChapters.includes(chapterId);
  let inProgress = false;
  let stepInChapter = 0;
  if (
    tourProgress &&
    tourProgress.branch !== 'guardia-v7' &&
    tourProgress.branch === branch &&
    tourProgress.stepId
  ) {
    const ch = getChapterForStep(tourProgress.stepId, branch);
    if (ch.id === chapterId) {
      inProgress = !completed;
      const prog = getChapterProgressLabel(tourProgress.stepId, branch);
      stepInChapter = prog.stepInChapter;
    }
  }
  return {
    completed,
    inProgress,
    stepInChapter,
    chapterSteps,
    active: inProgress && tourProgress && tourProgress.chapterId === chapterId,
  };
}

function renderLearnHubContinueSection(tourProgress, parts) {
  if (!tourProgress) return;
  parts.push(
    '<div class="learn-hub-section learn-hub-section--continue">' +
    '<button type="button" class="learn-hub-continue-btn" id="learn-hub-btn-continue">' +
    'Continuar tutorial' +
    '</button></div>'
  );
}

function renderLearnHubQuickRouteCard(parts) {
  parts.push(
    '<div class="learn-hub-module-card learn-hub-module-card--cta learn-hub-module-card--quick">' +
    '<button type="button" class="learn-hub-module-hit learn-hub-module-hit--cta"' +
    ` data-learn-chapter="${escapeHtml(QUICK_ROUTE_HUB_MODULE.chapterId)}"` +
    ' data-learn-branch="quick-route"' +
    ' title="Ruta rápida — labs, descongestión, Manejo y hoja IC">' +
    '<span class="learn-hub-module-index learn-hub-module-index--cta" aria-hidden="true">5′</span>' +
    '<span class="learn-hub-module-main">' +
    `<span class="learn-hub-module-title">${escapeHtml(QUICK_ROUTE_HUB_MODULE.label)}</span>` +
    `<span class="learn-hub-module-meta">${QUICK_ROUTE_HUB_MODULE.stepCount} pasos · ~5 min</span>` +
    '</span>' +
    '<span class="learn-hub-module-chevron" aria-hidden="true">›</span>' +
    '</button></div>'
  );
}

function renderLearnHubNovedadesTrack(parts, focusTrack, progress, tourProgress) {
  const guardiaCompletedCount = GUARDIA_V7_HUB_MODULES.filter((m) =>
    progress.completedChapters.includes(m.chapterId)
  ).length;
  const novedadesOpen = focusTrack !== 'fundamentos';
  parts.push(
    `<details class="learn-hub-track learn-hub-track--novedades"${novedadesOpen ? ' open' : ''}>`
  );
  parts.push(
    '<summary class="learn-hub-track-title">' +
    'Empezar aquí' +
    `<span class="learn-hub-progress-pill">${guardiaCompletedCount}/5</span>` +
    '</summary>'
  );
  parts.push('<div class="learn-hub-track-body">');
  parts.push(
    '<p class="learn-hub-section-lead">Módulos cortos para el seguimiento IC: laboratorio, descongestión, Manejo y hoja .docx. Pulsa una tarjeta para empezar.</p>'
  );
  parts.push('<div class="learn-hub-module-list">');
  renderLearnHubQuickRouteCard(parts);
  GUARDIA_V7_HUB_MODULES.forEach((mod, idx) => {
    const st = guardiaModuleState(mod.chapterId, progress, tourProgress);
    parts.push(
      buildModuleRow({
        chapterId: mod.chapterId,
        label: mod.label,
        branch: 'guardia-v7',
        completed: st.completed,
        inProgress: st.inProgress,
        stepInChapter: st.stepInChapter,
        chapterSteps: st.chapterSteps,
        active: st.active,
        moduleIndex: idx + 1,
        allowReset: true,
      })
    );
  });
  parts.push('</div></div></details>');
}

function renderLearnHubFundamentosTrack(parts, focusTrack, fundamentosProgress, tourProgress) {
  const fundamentosTotal = fundamentosModuleCount();
  const fundamentosCompletedCount = fundamentosProgress.completedChapters.filter(
    (id) => isFundamentosChapterId(id)
  ).length;
  const fundamentosOpen = focusTrack === 'fundamentos';
  parts.push(
    `<details class="learn-hub-track learn-hub-track--fundamentos"${fundamentosOpen ? ' open' : ''}>`
  );
  parts.push(
    '<summary class="learn-hub-track-title">' +
    'Fundamentos' +
    `<span class="learn-hub-progress-pill">${fundamentosCompletedCount}/${fundamentosTotal}</span>` +
    '</summary>'
  );
  parts.push('<div class="learn-hub-track-body">');
  parts.push(
    '<p class="learn-hub-fundamentos-lead">Tutorial completo del flujo IC (~15 min): labs → expediente → Manejo → hoja IC. La ruta rápida usa el caso <strong>Rosa María Delgado Vázquez</strong>.</p>'
  );
  parts.push('<div class="learn-hub-module-list">');
  for (const mod of SALA_HUB_MODULES.filter((m) => m.chapterId)) {
    const st = fundamentosModuleState(mod.chapterId, 'sala', fundamentosProgress, tourProgress);
    parts.push(
      buildModuleRow({
        chapterId: mod.chapterId,
        label: mod.label,
        branch: 'sala',
        completed: st.completed,
        inProgress: st.inProgress,
        stepInChapter: st.stepInChapter,
        chapterSteps: st.chapterSteps,
        active: st.active,
      })
    );
  }
  parts.push('</div></div></details>');
}

export function renderLearnHubBody(focusTrack = 'guardia-v7') {
  const host = document.getElementById('learn-hub-body');
  if (!host) return;

  const progress = loadGuardiaV7Progress();
  const fundamentosProgress = loadFundamentosProgress();
  const tourProgress = loadTourProgress();
  const parts = [];

  renderLearnHubContinueSection(tourProgress, parts);
  renderLearnHubNovedadesTrack(parts, focusTrack, progress, tourProgress);
  renderLearnHubFundamentosTrack(parts, focusTrack, fundamentosProgress, tourProgress);

  parts.push(
    '<div class="learn-hub-footer">' +
    '<button type="button" class="learn-hub-help-link" id="learn-hub-btn-help">Buscar en centro de ayuda…</button>' +
    '</div>'
  );

  host.innerHTML = parts.join('');
  wireLearnHubBodyOnce(host);
}

function wireLearnHubBodyOnce(host) {
  if (host._rpcLearnHubWired) return;
  host._rpcLearnHubWired = true;

  host.addEventListener('click', (ev) => {
    const resetBtn = ev.target.closest('[data-learn-reset]');
    if (resetBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      resetLearnModuleProgress(
        resetBtn.getAttribute('data-learn-reset'),
        resetBtn.getAttribute('data-learn-reset-branch') || 'guardia-v7',
        'guardia-v7'
      );
      return;
    }
    const row = ev.target.closest('[data-learn-chapter]');
    if (row) {
      startLearnModule(row.getAttribute('data-learn-chapter'));
      return;
    }
    if (ev.target.closest('#learn-hub-btn-continue')) {
      closeLearnHub();
      void import('./tour-flow.mjs').then((mod) => {
        if (typeof mod.resumeGuidedTourFromProgress === 'function') {
          mod.resumeGuidedTourFromProgress();
        }
      });
      return;
    }
    if (ev.target.closest('#learn-hub-btn-help')) {
      closeLearnHub();
      if (typeof settingsHelpBridge.openQuickHelp === 'function') {
        settingsHelpBridge.openQuickHelp();
      } else {
        void import('./help-content.mjs').then((mod) => {
          if (typeof mod.openQuickHelp === 'function') mod.openQuickHelp();
        });
      }
    }
  });
}

function wireLearnHubDismiss() {
  if (learnHubDismissWired) return;
  learnHubDismissWired = true;
  const bd = document.getElementById('learn-hub-backdrop');
  if (!bd) return;
  bd.addEventListener('click', (ev) => {
    if (!bd.classList.contains('open')) return;
    const sheet = bd.querySelector('.learn-hub-sheet');
    if (sheet && sheet.contains(ev.target)) return;
    closeLearnHub();
  });
  document.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      if (!bd.classList.contains('open')) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeLearnHub();
    },
    true
  );
}

export function syncLearnAprenderChrome() {
  const btn = document.getElementById('btn-open-learn');
  if (!btn) return;
  btn.hidden = isMobileWeb() || needsClinicalOnboarding();
}

export function openLearnHub(opts = {}) {
  if (isMobileWeb()) return;
  wireLearnHubDismiss();
  renderLearnHubBody(opts.focusTrack || 'guardia-v7');
  const bd = document.getElementById('learn-hub-backdrop');
  if (!bd) return;
  learnHubLastFocus = document.activeElement;
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  const closeBtn = bd.querySelector('.learn-hub-close');
  if (closeBtn && typeof closeBtn.focus === 'function') {
    try {
      closeBtn.focus();
    } catch { /* focus may fail if element not focusable */ }
  }
  syncLearnAprenderChrome();
  if (typeof settingsHelpBridge.syncLearnHubContinueVisibility === 'function') {
    settingsHelpBridge.syncLearnHubContinueVisibility();
  }
}

export function closeLearnHub() {
  const bd = document.getElementById('learn-hub-backdrop');
  if (!bd) return;
  const prev = learnHubLastFocus;
  closeModalAnimated(bd, function () {
    learnHubLastFocus = null;
    if (prev && typeof prev.focus === 'function') {
      try {
        prev.focus();
      } catch { /* restore focus may fail */ }
    }
  });
}
