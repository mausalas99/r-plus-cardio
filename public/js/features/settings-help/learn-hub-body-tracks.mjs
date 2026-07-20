import {
  GUARDIA_V7_HUB_MODULES,
  QUICK_ROUTE_HUB_MODULE,
  SALA_HUB_MODULES,
} from '../../onboarding-curriculum.mjs';
import { buildModuleRow } from './learn-hub-module-row.mjs';
import { escapeHtml } from '../../dom-escape.mjs';

/** @param {number} guardiaCompletedCount @param {object} progress @param {object|null} tourProgress @param {(id: string, progress: object, tour: object|null) => object} guardiaModuleState */
export function renderLearnHubGuardiaTrack(guardiaCompletedCount, progress, tourProgress, guardiaModuleState) {
  const parts = [];
  parts.push('<details class="learn-hub-track learn-hub-track--novedades" open>');
  parts.push(
    '<summary class="learn-hub-track-title">Empezar aquí' +
    `<span class="learn-hub-progress-pill">${guardiaCompletedCount}/5</span></summary>`
  );
  parts.push('<div class="learn-hub-track-body">');
  parts.push('<p class="learn-hub-section-lead">Módulos cortos para el seguimiento IC: laboratorio, descongestión, Manejo y hoja .docx.</p>');
  parts.push('<div class="learn-hub-module-list">');
  parts.push(
    '<div class="learn-hub-module-card learn-hub-module-card--cta learn-hub-module-card--quick">' +
    '<button type="button" class="learn-hub-module-hit learn-hub-module-hit--cta"' +
    ` data-learn-chapter="${escapeHtml(QUICK_ROUTE_HUB_MODULE.chapterId)}" data-learn-branch="quick-route"` +
    ' title="Ruta rápida — labs, descongestión, Manejo y hoja IC">' +
    '<span class="learn-hub-module-index learn-hub-module-index--cta" aria-hidden="true">5′</span>' +
    '<span class="learn-hub-module-main">' +
    `<span class="learn-hub-module-title">${escapeHtml(QUICK_ROUTE_HUB_MODULE.label)}</span>` +
    `<span class="learn-hub-module-meta">${QUICK_ROUTE_HUB_MODULE.stepCount} pasos · ~5 min</span>` +
    '</span><span class="learn-hub-module-chevron" aria-hidden="true">›</span></button></div>'
  );
  GUARDIA_V7_HUB_MODULES.forEach((mod, idx) => {
    const st = guardiaModuleState(mod.chapterId, progress, tourProgress);
    parts.push(buildModuleRow({
      chapterId: mod.chapterId,
      label: mod.label,
      branch: 'guardia-v7',
      ...st,
      moduleIndex: idx + 1,
      allowReset: true,
    }));
  });
  parts.push('</div></div></details>');
  return parts.join('');
}

/** @param {boolean} fundamentosOpen @param {number} fundamentosCompletedCount @param {number} fundamentosTotal */
export function renderLearnHubFundamentosHeader(fundamentosOpen, fundamentosCompletedCount, fundamentosTotal) {
  return (
    `<details class="learn-hub-track learn-hub-track--fundamentos"${fundamentosOpen ? ' open' : ''}>` +
    '<summary class="learn-hub-track-title">Fundamentos' +
    `<span class="learn-hub-progress-pill">${fundamentosCompletedCount}/${fundamentosTotal}</span></summary>` +
    '<div class="learn-hub-track-body">' +
    '<p class="learn-hub-fundamentos-lead">Tutorial completo del flujo IC (~15 min): labs → expediente → Manejo → hoja IC. La ruta rápida usa el caso <strong>Rosa María Delgado Vázquez</strong>.</p>'
  );
}

export { SALA_HUB_MODULES };
