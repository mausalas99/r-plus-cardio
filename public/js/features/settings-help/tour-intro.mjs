/** Tour intro modal, semver gating, and learn-hub continue chrome. */
import { loadTourProgress } from '../../onboarding-progress.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import { tourState, GUIDED_TOUR_LS_KEY } from './tour-state.mjs';

/** Tour intro, dock, step targets */
export function parseSemverCoreParts(versionLabel) {
  var s = normalizeTourVersionLabel(versionLabel);
  if (s === 'dev') return null;
  var core = s.split('-')[0].split('+')[0];
  var parts = core.split('.');
  var nums = [];
  for (var i = 0; i < parts.length; i++) {
    var n = parseInt(parts[i], 10);
    if (isNaN(n)) return null;
    nums.push(n);
  }
  return nums.length ? nums : null;
}

/** >0 si a mayor que b; <0 si menor; 0 si igual. */
export function compareSemverNumericArrays(a, b) {
  var len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    var ai = a[i] || 0;
    var bi = b[i] || 0;
    if (ai !== bi) return ai > bi ? 1 : -1;
  }
  return 0;
}

/** Mostrar bienvenida solo en primera ejecución o tras actualizar a una versión más nueva (semver). */
export function shouldShowGuidedTourIntro(currentVersion, storedDoneVersionRaw) {
  var cur = normalizeTourVersionLabel(currentVersion);
  if (storedDoneVersionRaw == null || String(storedDoneVersionRaw).trim() === '') return true;
  var done = String(storedDoneVersionRaw).trim();
  if (cur === done) return false;
  var pc = parseSemverCoreParts(cur);
  var pd = parseSemverCoreParts(done);
  if (pc && pd) return compareSemverNumericArrays(pc, pd) > 0;
  return cur !== done;
}

export function resolveAppVersionForTour() {
  if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
    return window.electronAPI.getAppVersion().catch(function() { return 'dev'; });
  }
  return Promise.resolve('dev');
}

export function normalizeTourVersionLabel(v) {
  var s = String(v == null ? '' : v).trim();
  return s || 'dev';
}

export function tryShowGuidedTourIntroIfNeeded() {
  void import('./tour-intro-education.mjs').then((mod) => {
    if (typeof mod.tryShowPostRegistrationEducationIfNeeded === 'function') {
      void mod.tryShowPostRegistrationEducationIfNeeded();
    }
  });
}

export function initGuidedTourGate() {
  if (isMobileWeb()) return;
  void import('./learn-hub.mjs').then(function (hub) {
    if (typeof hub.syncLearnAprenderChrome === 'function') hub.syncLearnAprenderChrome();
  });
  resolveAppVersionForTour()
    .then(function (v) {
      window.__RPC_APP_VERSION__ = normalizeTourVersionLabel(v);
      void import('./tour-intro-education.mjs').then((mod) => {
        if (typeof mod.tryShowPostRegistrationEducationIfNeeded === 'function') {
          void mod.tryShowPostRegistrationEducationIfNeeded();
        }
      });
    })
    .catch(function () {
      window.__RPC_APP_VERSION__ = 'dev';
      void import('./tour-intro-education.mjs').then((mod) => {
        if (typeof mod.tryShowPostRegistrationEducationIfNeeded === 'function') {
          void mod.tryShowPostRegistrationEducationIfNeeded();
        }
      });
    });
}

export function showTourIntroModal() {
  var el = document.getElementById('onboarding-intro-backdrop');
  if (!el) return;
  try { settingsHelpBridge.closeReleaseNotes(); } catch (_e) { void _e; }
  var ver = normalizeTourVersionLabel(window.__RPC_APP_VERSION__);
  var h2 = document.getElementById('intro-modal-title');
  if (h2) h2.textContent = ver && ver !== 'dev' ? ('R+ · versión ' + ver) : 'Bienvenido a R+';
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}

/** Resolve app version then open Learn Hub (Fundamentos track). */
export function openTutorialIntroFromSettings() {
  return resolveAppVersionForTour()
    .then(function (v) {
      window.__RPC_APP_VERSION__ = normalizeTourVersionLabel(v);
      return import('./learn-hub.mjs').then((hub) => {
        if (typeof hub.openLearnHub === 'function') hub.openLearnHub({ focusTrack: 'fundamentos' });
      });
    })
    .catch(function () {
      window.__RPC_APP_VERSION__ = 'dev';
      return import('./learn-hub.mjs').then((hub) => {
        if (typeof hub.openLearnHub === 'function') hub.openLearnHub({ focusTrack: 'fundamentos' });
      });
    });
}

export function hideTourIntroModal() {
  var el = document.getElementById('onboarding-intro-backdrop');
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

export function markGuidedTourVersionDone() {
  try {
    localStorage.setItem(GUIDED_TOUR_LS_KEY, normalizeTourVersionLabel(window.__RPC_APP_VERSION__));
  } catch (_e) { void _e; }
}

export function guidedTourIntroSkip() {
  markGuidedTourVersionDone();
  hideTourIntroModal();
}

function launchGuidedTourBranch(branch) {
  hideTourIntroModal();
  tourState.guidedTourMode = 'base';
  void import('./tour-flow.mjs').then((mod) => {
    if (typeof mod.startOnboarding === 'function') mod.startOnboarding(branch);
  });
}

export function guidedTourIntroChooseSala() {
  launchGuidedTourBranch('sala');
}

export function guidedTourIntroChooseInterconsulta() {
  launchGuidedTourBranch('interconsulta');
}

export function syncLearnHubContinueVisibility() {
  var btn = document.getElementById('btn-learn-continue');
  if (btn) {
    var p = loadTourProgress();
    btn.style.display = p && !tourState.guidedTourActive ? '' : 'none';
  }
  var hubBd = document.getElementById('learn-hub-backdrop');
  if (hubBd && hubBd.classList.contains('open')) {
    void import('./learn-hub.mjs').then(function (hub) {
      if (typeof hub.renderLearnHubBody === 'function') hub.renderLearnHubBody('guardia-v7');
    });
  }
}
