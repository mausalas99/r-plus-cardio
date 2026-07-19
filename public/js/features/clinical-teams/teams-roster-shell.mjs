/** Mi rotación — panel open/close and post-change refresh. */
import { closeModalAnimated } from '../../ui-motion.mjs';
import {
  ensureClinicalPanelSession,
  getClinicalTeamsPanelHost,
  setClinicalTeamsPanelError,
  showClinicalTeamsPanelShell,
} from '../clinical-panel-host.mjs';
import { renderClinicalTeamsPanel } from './teams-roster-render.mjs';

export function teamsModalEl() {
  return document.getElementById('clinical-teams-backdrop');
}

function isClinicalTeamsPanelOpen() {
  const bd = teamsModalEl();
  return !!(bd && bd.classList.contains('open'));
}

/**
 * Tras cambios de equipos: actualiza caché y panel si está abierto (sin «Cargando…»).
 * @param {{ force?: boolean }} [opts] — force: re-render aunque haya borradores abiertos
 */
export async function refreshTeamsUiAfterChange(opts = {}) {
  const { isLanDirectoryModalOpen } = await import('./teams-roster-lan.mjs');
  if (isLanDirectoryModalOpen()) return;

  const { refreshClinicalPatientListForScope } = await import('../../clinical-access-runtime.mjs');
  await refreshClinicalPatientListForScope({ allowLanPull: true });
  import('../clinical-rotation-entry.mjs').then((m) => m.syncClinicalRotationEntryChrome());
  if (isClinicalTeamsPanelOpen()) {
    if (!opts.force) {
      const { isClinicalTeamsPanelUserInteracting } = await import('./teams-roster-panel-draft.mjs');
      if (isClinicalTeamsPanelUserInteracting()) return;
    }
    await renderClinicalTeamsPanel({ silent: true, skipLanPull: true, preserveDraft: !opts.force });
  }
}

/**
 * @param {{ skipProfileGate?: boolean }} [opts]
 *   skipProfileGate — post–Sala tutorial: open join-team UI even if profile onboarding pending.
 */
export async function openClinicalTeamsPanel(opts = {}) {
  const bd = teamsModalEl();
  if (!bd) return;

  showClinicalTeamsPanelShell();

  try {
    const { wireClinicalTeamsModalChrome } = await import('./teams-roster-modal-chrome.mjs');
    wireClinicalTeamsModalChrome();
  } catch {
    /* modal chrome optional on first paint */
  }

  void import('../lan/panel.mjs')
    .then((m) => {
      if (typeof m.stopLanAutoDiscovery === 'function') m.stopLanAutoDiscovery();
    })
    .catch(() => {});

  const sessionOk = await ensureClinicalPanelSession({ interactive: true });
  if (!sessionOk) {
    closeClinicalTeamsPanel();
    const mainMod = await import('../clinical-onboarding-main.mjs');
    const msg = await mainMod.describeOnboardingSessionBlock();
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    }
    if (!opts.skipProfileGate && !mainMod.focusMainClinicalOnboarding()) {
      await mainMod.showMainClinicalOnboarding();
    }
    return;
  }

  try {
    if (!opts.skipProfileGate) {
      const { needsClinicalOnboarding } = await import('../clinical-onboarding.mjs');
      if (needsClinicalOnboarding()) {
        closeClinicalTeamsPanel();
        const mainMod = await import('../clinical-onboarding-main.mjs');
        await mainMod.showMainClinicalOnboarding();
        mainMod.focusMainClinicalOnboarding();
        return;
      }
    }
  } catch (err) {
    console.error('[Mi rotación]', err);
    setClinicalTeamsPanelError(
      err instanceof Error ? err.message : 'No se pudo abrir Mi rotación.'
    );
    return;
  }

  try {
    await renderClinicalTeamsPanel();
    const panelBody = getClinicalTeamsPanelHost();
    if (panelBody) panelBody.scrollTop = 0;
  } catch (err) {
    console.error('[Mi rotación]', err);
    setClinicalTeamsPanelError(
      err instanceof Error ? err.message : 'No se pudo abrir Mi rotación.'
    );
  }
}

export function closeClinicalTeamsPanel() {
  const bd = teamsModalEl();
  if (!bd) return;
  closeModalAnimated(bd, function () {
    document.body.classList.remove('clinical-teams-modal-open');
    void import('../lan/panel.mjs')
      .then((m) => {
        if (typeof m.startLanAutoDiscovery === 'function') m.startLanAutoDiscovery();
      })
      .catch(() => {});
  });
}
