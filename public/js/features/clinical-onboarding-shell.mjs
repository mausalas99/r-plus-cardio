/**
 * Shared markup shell for first-run onboarding steps (sync mode, profile, session).
 */

/** @param {1|2|3} activeIndex */
export function buildClinicalOnboardingStepperHtml(activeIndex) {
  const labels = ['Modo', 'Perfil', 'Equipo'];
  const dots = labels
    .map((label, i) => {
      const n = i + 1;
      const cls = n === activeIndex ? ' is-active' : '';
      return `<span class="${cls.trim()}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${n}</span>`;
    })
    .join('');
  return `<div class="clinical-onboarding-progress" aria-label="Progreso del registro">${dots}</div>`;
}

/**
 * @param {{ title: string, leadHtml: string, bodyHtml: string, stepperIndex?: number|null }} parts
 */

import { escapeHtml } from '../dom-escape.mjs';
export function buildOnboardingStageHtml({ title, leadHtml, bodyHtml, stepperIndex = null }) {
  const stepper =
    stepperIndex != null ? buildClinicalOnboardingStepperHtml(/** @type {1|2|3} */ (stepperIndex)) : '';
  return `
    <div class="clinical-onboarding-stage">
      <div class="clinical-onboarding-stage-inner">
        ${stepper}
        <h3 class="clinical-onboarding-title">${escapeHtml(title)}</h3>
        <div class="clinical-onboarding-lead">${leadHtml}</div>
        ${bodyHtml}
      </div>
    </div>`;
}

const MODE_LAN_ICON = `<svg class="clinical-onboard-mode-card-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>`;

const MODE_LOCAL_ICON = `<svg class="clinical-onboard-mode-card-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`;

/** HTML for LAN vs solo-equipo choice cards. */
export function buildSyncModeChoiceBodyHtml() {
  return `
        <div class="clinical-onboard-mode-grid" role="group" aria-label="Modo de uso">
          <button type="button" class="clinical-onboard-mode-card clinical-onboard-mode-card--primary" data-sync-mode="lan">
            <span class="clinical-onboard-mode-card-head">
              ${MODE_LAN_ICON}
              <span class="clinical-onboard-mode-card-title">Guardia en red (LAN)</span>
            </span>
            <span class="clinical-onboard-mode-card-desc">Usuario @usuario, sala, sincronización en vivo con el equipo y <strong>Mi rotación</strong>.</span>
          </button>
          <button type="button" class="clinical-onboard-mode-card" data-sync-mode="local">
            <span class="clinical-onboard-mode-card-head">
              ${MODE_LOCAL_ICON}
              <span class="clinical-onboard-mode-card-title">Solo este equipo</span>
            </span>
            <span class="clinical-onboard-mode-card-desc">Para médicos ajenos a medicina interna: sin LAN ni LiveSync; expedientes y notas solo en esta Mac. Sin rotaciones ni sala compartida.</span>
          </button>
        </div>`;
}
