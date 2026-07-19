/** Perfil — load settings into modal DOM. */
import {
  buildLoadSettingsSnapshot,
  getLastLoadSettingsSnapshot,
  setLastLoadSettingsSnapshot,
  settingsRef,
} from "./profile-runtime.mjs";
import {
  populateProfileIdentityFields,
  populateProfileOutputFields,
} from "./profile-load-fields.mjs";
import {
  populateProfileVersionBlock,
  populateProfileUserDataBlock,
} from "./profile-load-platform.mjs";
import {
  syncProfileLoadedSections,
  syncProfileModalLayout,
} from "./profile-load-sync.mjs";

export { syncProfileModalLayout };

export function loadSettings() {
  var snapshot = buildLoadSettingsSnapshot();
  var snapshotUnchanged =
    getLastLoadSettingsSnapshot() !== null && getLastLoadSettingsSnapshot() === snapshot;
  setLastLoadSettingsSnapshot(snapshot);
  if (snapshotUnchanged) {
    syncProfileLoadedSections(false);
    return;
  }
  var st = settingsRef();
  populateProfileIdentityFields(st);
  populateProfileOutputFields(st);
  populateProfileVersionBlock();
  populateProfileUserDataBlock();
  syncProfileLoadedSections(true);
}
