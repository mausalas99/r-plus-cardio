import { escapeHtml } from '../../dom-escape.mjs';
export function moduleStatusLabel({ completed, inProgress, stepInChapter, chapterSteps }) {
  if (completed) return 'Completado';
  if (inProgress && stepInChapter > 0) return `En curso · paso ${stepInChapter} de ${chapterSteps}`;
  if (inProgress) return 'En curso';
  return 'Pendiente';
}

function buildModuleIndexBadge(moduleIndex) {
  if (moduleIndex != null) return `<span class="learn-hub-module-index" aria-hidden="true">${moduleIndex}</span>`;
  return '';
}

function buildModuleStatusMeta(chapterSteps, mins, status, completed, inProgress) {
  const statusLine = chapterSteps > 0
    ? `<span class="learn-hub-module-meta">${chapterSteps} pasos · ~${mins} min</span>`
    : '';
  const statusIcon = completed
    ? '<span class="learn-hub-module-check" aria-hidden="true">✓</span>'
    : inProgress
      ? '<span class="learn-hub-module-dot" aria-hidden="true"></span>'
      : '';
  return { statusLine, statusIcon };
}

function buildModuleResetBtn(completed, allowReset, chapterId, branch, label) {
  if (!completed || !allowReset) return '';
  return (
    `<button type="button" class="learn-hub-module-reset"` +
    ` data-learn-reset="${escapeHtml(chapterId)}" data-learn-reset-branch="${escapeHtml(branch)}"` +
    ` title="Resetear progreso" aria-label="Resetear ${escapeHtml(label)}">` +
    `<span class="learn-hub-module-reset-icon" aria-hidden="true">↺</span></button>`
  );
}

export function buildModuleRow(opts) {
  const {
    chapterId, label, branch, completed, inProgress, stepInChapter, chapterSteps,
    active, moduleIndex = null, allowReset = false,
  } = opts;
  const mins = Math.max(1, Math.round(Math.max(1, Number(chapterSteps) || 1) * 0.75));
  const status = moduleStatusLabel({ completed, inProgress, stepInChapter, chapterSteps });
  const cardCls = ['learn-hub-module-card', active ? 'is-active' : '', completed ? 'is-complete' : '', inProgress ? 'is-in-progress' : '']
    .filter(Boolean).join(' ');
  const { statusLine, statusIcon } = buildModuleStatusMeta(chapterSteps, mins, status, completed, inProgress);
  const hitAttrs =
    ` data-learn-chapter="${escapeHtml(chapterId)}" data-learn-branch="${escapeHtml(branch)}"`;
  return (
    `<div class="${cardCls}">` +
    `<div class="learn-hub-module-row">` +
    `<button type="button" class="learn-hub-module-hit"` + hitAttrs +
    ` title="${escapeHtml(label)} — ${escapeHtml(status)}">` +
    buildModuleIndexBadge(moduleIndex) +
    `<span class="learn-hub-module-main">` +
    `<span class="learn-hub-module-title">${escapeHtml(label)}</span>` + statusLine +
    `</span><span class="learn-hub-module-status">` +
    `<span class="learn-hub-module-status-text">${statusIcon}${escapeHtml(status)}</span>` +
    `</span><span class="learn-hub-module-chevron" aria-hidden="true">›</span></button>` +
    buildModuleResetBtn(completed, allowReset, chapterId, branch, label) +
    `</div></div>`
  );
}
