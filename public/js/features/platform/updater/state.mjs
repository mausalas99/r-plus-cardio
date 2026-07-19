/** Shared mutable state for updater modal and electron bridge. */

var UPDATE_SNOOZE_KEY = 'rplus-update-snooze-until';
var UPDATE_DISMISS_VER_KEY = 'rplus-update-dismiss-version';
var UPDATE_TELEMETRY_URL = 'https://example.invalid/r-plus-update';
var RELEASES_LATEST_URL = 'https://github.com/mausalas99/r-mas/releases/latest';

var updaterState = {
  pendingUpdaterTargetVersion: null,
  pendingUpdaterIsPrerelease: false,
  pendingDowngradeVersion: null,
  pendingRepairUpdateCheck: false,
  /** @type {'upgrade' | 'downgrade'} */
  updateModalMode: 'upgrade',
  minVersionGateKeydownBound: false,
  nativeRecoveryModalShown: false,
};

export {
  UPDATE_SNOOZE_KEY,
  UPDATE_DISMISS_VER_KEY,
  UPDATE_TELEMETRY_URL,
  RELEASES_LATEST_URL,
  updaterState,
};
