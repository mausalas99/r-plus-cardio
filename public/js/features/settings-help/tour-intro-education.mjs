/** Post-registration education: Guardia v7 card and Fundamentos learn hub. */
import { isMobileWeb } from '../../mobile-web.mjs';
import { GUIDED_TOUR_LS_KEY } from './tour-state.mjs';
import { markGuidedTourVersionDone, normalizeTourVersionLabel } from './tour-intro.mjs';

function shouldDeferGuidedTourForRegistration() {
  try {
    var settingsRaw = localStorage.getItem('rpc-settings');
    var settings = settingsRaw ? JSON.parse(settingsRaw) : {};
    if (settings && settings.clinicalRegistered !== true) return true;
    if (settings && settings.clinicalLocalOnly !== true && settings.clinicalLocalOnly !== false) {
      return true;
    }
    if (document.documentElement.classList.contains('clinical-onboarding-active')) return true;
  } catch (_e) { void _e; }
  return false;
}

export async function tryShowPostRegistrationEducationIfNeeded() {
  if (isMobileWeb() || shouldDeferGuidedTourForRegistration()) return;
  const { needsClinicalOnboarding } = await import('../clinical-onboarding.mjs');
  if (needsClinicalOnboarding()) return;

  const cur = normalizeTourVersionLabel(window.__RPC_APP_VERSION__);
  const prev = normalizeTourVersionLabel(window.__RPC_PREV_APP_VERSION__ || '');
  let stored = '';
  try {
    stored = localStorage.getItem(GUIDED_TOUR_LS_KEY) || '';
  } catch (_ls) { void _ls; }
  const { isGuardiaV7TrackComplete } = await import('../../guardia-v7-progress.mjs');
  const { shouldOfferGuardiaV7Education, shouldShowFundamentosTourIntro } = await import(
    '../../guardia-v7-gating.mjs'
  );

  if (shouldOfferGuardiaV7Education({
    prevVersion: prev,
    curVersion: cur,
    needsOnboarding: false,
    trackComplete: isGuardiaV7TrackComplete(),
  })) {
    const { maybeShowGuardiaV7UpgradeCard } = await import('./guardia-v7-upgrade-card.mjs');
    maybeShowGuardiaV7UpgradeCard({ delayMs: 2000 });
    return;
  }
  if (shouldShowFundamentosTourIntro({ curVersion: cur, storedDoneVersion: stored, needsOnboarding: false })) {
    markGuidedTourVersionDone();
    setTimeout(() => {
      void import('./learn-hub.mjs').then((hub) => {
        if (typeof hub.openLearnHub === 'function') hub.openLearnHub({ focusTrack: 'fundamentos' });
      });
    }, 80);
  }
}
