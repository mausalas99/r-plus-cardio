/** Perfil — sync dependent UI after settings load. */
import { isModeSala } from "../mode-features.mjs";
import { isDbMode } from "../db-storage-bridge.mjs";
import {
  syncFontZoomButtons,
  syncHighContrastButtons,
  syncUiDensityButtons,
} from "./chrome.mjs";
import { syncSettingsLanHostDiskSection } from "./lan-sync.mjs";
import {
  syncUpdateChannelUI,
  syncUpdateTelemetryUI,
  syncHardwareAccelerationUI,
} from "./platform/updater.mjs";
import { syncIdleLockSelectUi } from "./platform/offline.mjs";
import { syncPreimportBackupUi } from "./platform/import-backup.mjs";
import { syncDbSecuritySectionUi } from "./db-unlock.mjs";
import { syncCensoExportButtonVisibility } from "../censo-export.mjs";
import { syncClinicalRotationEntryChrome } from "./clinical-rotation-entry.mjs";
import {
  getProfileRuntime,
  syncAppModeRadioControls,
  settingsRef,
} from "./profile-runtime.mjs";
import {
  ensureClinicoTabConsistency,
  syncHideClinicoTabUI,
  syncHideListadoProblemasAiPromptUI,
} from "./profile-prefs.mjs";

/** Oculta secciones de Sala / clínica según modo y base de datos. */
export function syncProfileModalLayout() {
  var st = settingsRef();
  var sala = isModeSala(st);
  var salida = document.getElementById("profile-salida-section");
  var bridge = document.getElementById("profile-clinical-bridge");
  var servicioWrap = document.getElementById("profile-default-servicio-wrap");
  if (salida) salida.hidden = !sala;
  if (bridge) bridge.hidden = !isDbMode();
  if (servicioWrap) servicioWrap.hidden = !sala;
}

export function syncProfileLoadedSections(full) {
  syncFontZoomButtons();
  syncHighContrastButtons();
  syncUiDensityButtons();
  syncUpdateChannelUI();
  syncUpdateTelemetryUI();
  syncHideClinicoTabUI();
  syncHideListadoProblemasAiPromptUI();
  ensureClinicoTabConsistency();
  if (typeof syncSettingsLanHostDiskSection === "function") syncSettingsLanHostDiskSection();
  syncAppModeRadioControls();
  syncCensoExportButtonVisibility();
  syncClinicalRotationEntryChrome();
  syncProfileModalLayout();
  if (full) {
    syncHardwareAccelerationUI();
    syncIdleLockSelectUi();
    syncDbSecuritySectionUi();
    syncPreimportBackupUi();
  }
  getProfileRuntime().syncWorkContextChrome();
}
