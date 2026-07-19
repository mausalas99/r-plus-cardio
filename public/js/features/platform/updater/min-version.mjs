/** Minimum supported version gate and blocking modal. */
import { setAsyncButtonLoading } from '../../../ui-motion.mjs';
import { fetchMinVersionPayload } from '../../../min-version-fetch.mjs';
import { RELEASES_LATEST_URL, updaterState } from './state.mjs';
import { compareSemver } from './version-compare.mjs';

function showMinVersionBlockingModal(current, minVersion, message) {
  var bd = document.getElementById('min-version-backdrop');
  if (!bd) return;
  var meta = document.getElementById('min-version-meta');
  var msg = document.getElementById('min-version-message');
  if (msg && message) msg.textContent = String(message);
  if (meta) {
    meta.textContent = 'Versión actual: v' + current + ' · Mínima soportada: v' + minVersion;
  }
  var checkBtn = document.getElementById('min-version-check-btn');
  var relBtn = document.getElementById('min-version-releases-btn');
  if (checkBtn) {
    checkBtn.onclick = function () {
      if (window.electronAPI && typeof window.electronAPI.checkForUpdates === 'function') {
        setAsyncButtonLoading(checkBtn, true, { loadingText: 'Buscando…' });
        try { window.electronAPI.checkForUpdates(); } catch (_e) { void _e; }
      } else if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(RELEASES_LATEST_URL);
      }
    };
  }
  if (relBtn) {
    relBtn.onclick = function () {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(RELEASES_LATEST_URL);
      } else {
        try { window.open(RELEASES_LATEST_URL, '_blank'); } catch (_e) { void _e; }
      }
    };
  }
  // Cierra otros modales para evitar interferencia; este gate es bloqueante.
  var snoozed = document.getElementById('update-modal-backdrop');
  if (snoozed) { snoozed.style.display = 'none'; snoozed.setAttribute('aria-hidden', 'true'); }
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  if (!updaterState.minVersionGateKeydownBound) {
    updaterState.minVersionGateKeydownBound = true;
    document.addEventListener('keydown', function (e) {
      var active = document.getElementById('min-version-backdrop');
      if (!active || !active.classList.contains('open')) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
}

function checkMinVersionGate() {
  if (typeof fetch !== 'function') return;
  var currentVersionPromise = (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function')
    ? window.electronAPI.getAppVersion().catch(function () { return null; })
    : Promise.resolve(null);
  var payloadPromise = fetchMinVersionPayload().catch(function () {
    return null;
  });
  Promise.all([currentVersionPromise, payloadPromise]).then(function (res) {
    var currentVersion = res[0];
    var payload = res[1];
    if (!currentVersion || !payload || typeof payload !== 'object' || !payload.minVersion) return;
    if (compareSemver(currentVersion, payload.minVersion) < 0) {
      showMinVersionBlockingModal(currentVersion, payload.minVersion, payload.message);
    }
  }).catch(function () {});
}

export { showMinVersionBlockingModal, checkMinVersionGate };
