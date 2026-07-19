/** Manual update check, repair reinstall, and install actions. */
import { setAsyncButtonLoading } from '../../../ui-motion.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { updaterState } from './state.mjs';
import { getUpdateChannel, setUpdateChannel, syncUpdateChannelUI } from './channel-settings.mjs';

const rt = getPlatformRuntime();

/**
 * Re-descarga e instala la build publicada del tag de la versión instalada (mismo número en GitHub).
 * Útil tras subir un fix sin bump: reemplaza el binario sin borrar userData.
 */
function checkForRepairUpdate() {
  if (
    !window.electronAPI ||
    typeof window.electronAPI.reinstallCurrentRelease !== 'function'
  ) {
    rt.showToast('Las actualizaciones automáticas solo están en la app de escritorio.', 'error');
    return;
  }
  updaterState.pendingRepairUpdateCheck = true;
  try {
    if (typeof window.electronAPI.resetUpdateFeed === 'function') {
      window.electronAPI.resetUpdateFeed();
    }
  } catch (_e) { void _e; }
  setUpdateChannel('estable');
  syncUpdateChannelUI();
  if (typeof window.electronAPI.setUpdateChannel === 'function') {
    try {
      window.electronAPI.setUpdateChannel('estable');
    } catch (_e) { void _e; }
  }
  setAsyncButtonLoading(document.getElementById('settings-repair-update-btn'), true, {
    loadingText: 'Buscando…',
  });
  var versionLabel = 'actual';
  if (typeof window.electronAPI.getAppVersion === 'function') {
    window.electronAPI.getAppVersion().then(function (v) {
      if (v) versionLabel = 'v' + v;
    }).catch(function () {});
  }
  rt.showToast(
    'Reinstalando ' + versionLabel + ' desde GitHub (canal Estable). No borra tus datos.',
    'info'
  );
  setTimeout(function () {
    try {
      window.electronAPI.reinstallCurrentRelease();
    } catch (_e) { void _e; }
  }, 150);
}

function checkForAppUpdates() {
  if (!window.electronAPI || typeof window.electronAPI.checkForUpdates !== 'function') {
    rt.showToast('Las actualizaciones automáticas solo están en la app de escritorio.', 'error');
    return;
  }
  if (typeof window.electronAPI.setUpdateChannel === 'function') {
    try { window.electronAPI.setUpdateChannel(getUpdateChannel()); } catch (_e) { void _e; }
  }
  setAsyncButtonLoading(document.getElementById('settings-check-updates-btn'), true, {
    loadingText: 'Buscando…',
  });
  setTimeout(function () {
    try { window.electronAPI.checkForUpdates(); } catch (_e) { void _e; }
  }, 150);
}

function installUpdate() {
  if (window.electronAPI) window.electronAPI.installUpdate();
}

export { checkForRepairUpdate, checkForAppUpdates, installUpdate };
