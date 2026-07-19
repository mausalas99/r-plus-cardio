/** Auto-updater modal UI, channels, telemetry, min-version gate — barrel. */
import './updater/electron-bridge.mjs';

export { compareSemver } from './updater/version-compare.mjs';

export {
  getUpdateChannel,
  setUpdateChannel,
  syncUpdateChannelUI,
  syncUpdateTelemetryUI,
  syncHardwareAccelerationUI,
  onHardwareAccelerationChange,
  getUpdateTelemetryEnabled,
  setUpdateTelemetryEnabled,
  migrateUpdateChannelToStableDefault,
} from './updater/channel-settings.mjs';

export { checkMinVersionGate } from './updater/min-version.mjs';

export { hideUpdateModal } from './updater/modal-ui.mjs';

export {
  checkForAppUpdates,
  checkForRepairUpdate,
  installUpdate,
} from './updater/check-actions.mjs';

export { initUpdateChannelAndGate } from './updater/init.mjs';
