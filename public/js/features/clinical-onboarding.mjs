/**
 * Clinical onboarding — perfil mínimo (usuario LAN, rango, sala).
 * Equipos: crear/unirse al reabrir Mi rotación, no en el wizard inicial. Barrel.
 */
import { safeRenderClinicalTeamsPanel } from './clinical-panel-host.mjs';
export {
  needsUsernameClaim,
  needsTeamOnboarding,
  needsClinicalSyncModeChoice,
  needsProfileOnboarding,
  needsClinicalOnboarding,
} from './clinical-onboarding-gates.mjs';
export { renderOnboardingPanelInto } from './clinical-onboarding-render.mjs';

export async function renderOnboardingPanel() {
  await safeRenderClinicalTeamsPanel(async (host) => {
    const { renderOnboardingPanelInto } = await import('./clinical-onboarding-render.mjs');
    await renderOnboardingPanelInto(host);
  });
}
