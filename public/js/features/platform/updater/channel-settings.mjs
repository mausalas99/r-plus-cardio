/** Update channel, telemetry, and hardware acceleration settings UI. */
import { getPlatformRuntime } from '../runtime.mjs';
import { updaterState, UPDATE_TELEMETRY_URL } from './state.mjs';

const rt = getPlatformRuntime();

function getUpdateChannel() {
  var s = rt.getSettings();
  var raw = String((s && s.updateChannel) || 'estable').toLowerCase();
  return raw === 'beta' ? 'beta' : 'estable';
}

function setUpdateChannel(channel) {
  var normalized = String(channel || '').toLowerCase() === 'beta' ? 'beta' : 'estable';
  var previous = getUpdateChannel();
  var s = rt.getSettings();
  s.updateChannel = normalized;
  localStorage.setItem('rpc-settings', JSON.stringify(s));
  syncUpdateChannelUI();
  if (window.electronAPI && typeof window.electronAPI.setUpdateChannel === 'function') {
    try { window.electronAPI.setUpdateChannel(normalized); } catch (_e) { void _e; }
  }
  if (previous !== normalized) {
    rt.showToast(
      normalized === 'beta'
        ? 'Canal pre-releases activado: recibirás borradores de GitHub.'
        : 'Canal estable activado.',
      'success'
    );
    if (window.electronAPI && typeof window.electronAPI.checkForUpdates === 'function') {
      setTimeout(function () {
        try { window.electronAPI.checkForUpdates(); } catch (_e) { void _e; }
      }, 250);
    }
  }
}

function syncUpdateModalChannelPill(isPrerelease) {
  var pill = document.getElementById('update-modal-channel-pill');
  if (pill) pill.style.display = isPrerelease ? 'inline-block' : 'none';
}

function syncRepairUpdateButtonLabel() {
  var btn = document.getElementById('settings-repair-update-btn');
  if (!btn || !window.electronAPI || typeof window.electronAPI.getAppVersion !== 'function') return;
  window.electronAPI.getAppVersion().then(function (v) {
    if (v) btn.textContent = 'Reinstalar versión actual (v' + v + ')…';
  }).catch(function () {});
}

function syncUpdateChannelUI() {
  syncRepairUpdateButtonLabel();
  var sel = document.getElementById('rpc-update-channel');
  if (sel) sel.value = getUpdateChannel();
  syncUpdateModalChannelPill(updaterState.pendingUpdaterIsPrerelease);
  if (typeof syncTeamSyncHeaderButton === 'function') rt.syncTeamSyncHeaderButton();
}

/** Tras 3.2.1 estable: quien tenía canal pre-releases vuelve a Estable (una sola vez). */
function migrateUpdateChannelToStableDefault() {
  var key = 'rpc-update-channel-stable-default-v321';
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  if (getUpdateChannel() !== 'beta') return;
  var s = rt.getSettings();
  s.updateChannel = 'estable';
  localStorage.setItem('rpc-settings', JSON.stringify(s));
  if (window.electronAPI && typeof window.electronAPI.setUpdateChannel === 'function') {
    try { window.electronAPI.setUpdateChannel('estable'); } catch (_e) { void _e; }
    if (typeof window.electronAPI.checkForUpdates === 'function') {
      setTimeout(function () {
        try { window.electronAPI.checkForUpdates(); } catch (_e) { void _e; }
      }, 300);
    }
  }
}

function getUpdateTelemetryEnabled() {
  var s = rt.getSettings();
  return !!(s && s.updateTelemetryEnabled);
}

function setUpdateTelemetryEnabled(enabled) {
  var value = !!enabled;
  var s = rt.getSettings();
  s.updateTelemetryEnabled = value;
  localStorage.setItem('rpc-settings', JSON.stringify(s));
  syncUpdateTelemetryUI();
  rt.showToast(value ? 'Telemetría de actualización activada.' : 'Telemetría desactivada.', 'success');
}

function syncUpdateTelemetryUI() {
  var cb = document.getElementById('rpc-update-telemetry-toggle');
  if (cb) cb.checked = getUpdateTelemetryEnabled();
}

function syncHardwareAccelerationUI() {
  var acc = document.getElementById('settings-accordion-performance');
  var cb = document.getElementById('settings-hardware-acceleration');
  if (!acc || !cb) return;
  var api = window.electronAPI;
  if (!api || typeof api.getPerformancePrefs !== 'function') {
    acc.style.display = 'none';
    void import('../../settings-help/settings-dropdown.mjs')
      .then(function (m) {
        if (typeof m.syncSettingsNavVisibility === 'function') m.syncSettingsNavVisibility();
      })
      .catch(function () {});
    return;
  }
  acc.style.display = '';
  void import('../../settings-help/settings-dropdown.mjs')
    .then(function (m) {
      if (typeof m.syncSettingsNavVisibility === 'function') m.syncSettingsNavVisibility();
    })
    .catch(function () {});
  api
    .getPerformancePrefs()
    .then(function (prefs) {
      cb.checked = !!(prefs && prefs.hardwareAcceleration);
    })
    .catch(function () {
      cb.checked = false;
    });
}

function onHardwareAccelerationChange(enabled) {
  var api = window.electronAPI;
  if (!api || typeof api.setHardwareAcceleration !== 'function') {
    rt.showToast('Solo disponible en la aplicación de escritorio.', 'error');
    syncHardwareAccelerationUI();
    return;
  }
  api
    .setHardwareAcceleration(!!enabled)
    .then(function () {
      rt.showToast('Reinicia R+ para aplicar la aceleración por hardware.', 'info');
    })
    .catch(function () {
      rt.showToast('No se pudo guardar la preferencia.', 'error');
      syncHardwareAccelerationUI();
    });
}

function resolvePlatformForTelemetry() {
  if (window.electronAPI && typeof window.electronAPI.getPlatform === 'function') {
    return window.electronAPI.getPlatform().catch(function () { return 'unknown'; });
  }
  return Promise.resolve('web');
}

function sendUpdateTelemetry(result, versionHint) {
  if (!getUpdateTelemetryEnabled()) return;
  if (typeof fetch !== 'function') return;
  var normalizedResult = result === 'success' ? 'success' : 'fail';
  var versionPromise = versionHint
    ? Promise.resolve(versionHint)
    : (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function'
        ? window.electronAPI.getAppVersion().catch(function () { return 'dev'; })
        : Promise.resolve('dev'));
  Promise.all([resolvePlatformForTelemetry(), versionPromise]).then(function (vals) {
    var payload = {
      version: String(vals[1] || 'unknown'),
      result: normalizedResult,
      platform: String(vals[0] || 'unknown'),
    };
    try {
      fetch(UPDATE_TELEMETRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'no-cors',
      }).catch(function () {});
    } catch (_e) { void _e; }
  }).catch(function () {});
}

export {
  getUpdateChannel,
  setUpdateChannel,
  syncUpdateChannelUI,
  syncUpdateModalChannelPill,
  migrateUpdateChannelToStableDefault,
  getUpdateTelemetryEnabled,
  setUpdateTelemetryEnabled,
  syncUpdateTelemetryUI,
  syncHardwareAccelerationUI,
  onHardwareAccelerationChange,
  sendUpdateTelemetry,
};
