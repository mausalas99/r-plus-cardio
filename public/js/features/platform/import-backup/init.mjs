/** Boot-time init for auto-backup scheduler and updater gate. */
import {
  syncAutoBackupUi,
  maybeRunScheduledAutoBackup,
  restartAutoBackupScheduler,
} from './auto-backup.mjs';
import { initUpdateChannelAndGate } from '../updater.mjs';

function initGoalGFeatures() {
  syncAutoBackupUi();
  maybeRunScheduledAutoBackup();
  restartAutoBackupScheduler();
  initUpdateChannelAndGate();
}

export { initGoalGFeatures };
