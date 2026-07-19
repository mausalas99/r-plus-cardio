/** Boot-time updater channel sync, downgrade settings, and gates. */
import { initStableDowngradeSettings } from '../../../stable-downgrade-ui.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import {
  getUpdateChannel,
  migrateUpdateChannelToStableDefault,
  syncUpdateChannelUI,
  syncUpdateTelemetryUI,
} from './channel-settings.mjs';
import { checkMinVersionGate } from './min-version.mjs';
import { confirmDowngrade } from './downgrade.mjs';
import { checkNativeRuntimeOnBoot } from './native-recovery.mjs';

const rt = getPlatformRuntime();

function initUpdateChannelAndGate() {
  migrateUpdateChannelToStableDefault();
  syncUpdateChannelUI();
  syncUpdateTelemetryUI();
  if (window.electronAPI && typeof window.electronAPI.setUpdateChannel === 'function') {
    try { window.electronAPI.setUpdateChannel(getUpdateChannel()); } catch (_e) { void _e; }
  }
  initStableDowngradeSettings({
    showToast: rt.showToast.bind(rt),
    confirmDowngrade: confirmDowngrade,
  });
  setTimeout(checkNativeRuntimeOnBoot, 800);
  // Min-version gate: pequeño retraso para no estorbar el render inicial.
  setTimeout(function () { checkMinVersionGate(); }, 1200);
}

export { initUpdateChannelAndGate };
