/** Perfil — app mode (Sala / Inter / Pase / Guardia) switching. */
import {
  isPaseMode,
  isGuardiaMode,
  setUiDensity,
  toggleGuardiaMode,
  syncHeaderModeSeg,
  toggleHeaderModeSegExpand,
  collapseHeaderModeSeg,
} from "./chrome.mjs";
import { syncCensoExportButtonVisibility } from "../censo-export.mjs";
import { isModeSala } from "../mode-features.mjs";
import { migrateGranularInner } from "../expediente-tabs.mjs";
import { renderNoteForm } from "./notes-indicaciones.mjs";
import { renderEstadoActualButton } from "./soap-estado.mjs";
import { renderRoundOverviewPanels } from "./patients.mjs";
import {
  switchInnerTab,
  getActiveInnerTab,
  refreshExpedienteForAppModeChange,
} from "./pase-board.mjs";
import { renderPatientDataPane } from "./expediente.mjs";
import {
  getProfileRuntime,
  invalidateLoadSettingsSnapshot,
  persistSettingsToLocalStorage,
  settingsRef,
  syncAppModeRadioControls,
} from "./profile-runtime.mjs";
import { syncProfileModalLayout } from "./profile-load.mjs";

function reconcileActiveInnerForAppMode(nowSala) {
  var settings = settingsRef();
  var current = getActiveInnerTab() || "todo";
  var migrated = migrateGranularInner(current, settings);
  if (migrated !== current) {
    switchInnerTab(migrated, { forceRender: true });
    return;
  }
  if (nowSala && (current === "notas" || current === "indica")) {
    switchInnerTab("historia", { forceRender: true });
  } else if (!nowSala && current === "listado") {
    switchInnerTab("recetaHu", { forceRender: true });
  }
}

export function applyAppModeSwitchEffects() {
  var nowSala = isModeSala(settingsRef());
  try {
    reconcileActiveInnerForAppMode(nowSala);
    syncAppModeRadioControls();
    refreshExpedienteForAppModeChange();
    renderEstadoActualButton();
    syncCensoExportButtonVisibility();
    syncHeaderModeSeg();
    var rt = getProfileRuntime();
    if (rt.getActiveId()) {
      if (typeof rt.rebuildEstudiosFromLabHistory === "function") {
        rt.rebuildEstudiosFromLabHistory(rt.getActiveId());
      }
      if (!nowSala) renderNoteForm();
      var inner = getActiveInnerTab();
      if (inner === "datos" || inner === "todo") renderPatientDataPane();
    }
    rt.syncWorkContextChrome();
    if (isPaseMode()) renderRoundOverviewPanels();
    rt.showToast("Modo cambiado a " + (nowSala ? "Sala" : "Interconsulta"), "success");
  } catch (err) {
    console.error("[R+] applyAppModeSwitchEffects:", err);
    getProfileRuntime().showToast("No se pudo actualizar la vista al cambiar de modo.", "error");
  }
}

export function onAppModeChange() {
  var sala = document.getElementById("app-mode-sala");
  var st = settingsRef();
  st.appMode = sala && sala.checked ? "sala" : "interconsulta";
  invalidateLoadSettingsSnapshot();
  syncProfileModalLayout();
  persistSettingsToLocalStorage();
  applyAppModeSwitchEffects();
}

export function toggleHeaderWorkMode() {
  var st = settingsRef();
  st.appMode = isModeSala(st) ? "interconsulta" : "sala";
  invalidateLoadSettingsSnapshot();
  syncAppModeRadioControls();
  applyAppModeSwitchEffects();
  persistSettingsToLocalStorage();
}

export function setWorkModeFromHeader(mode) {
  var st = settingsRef();
  var current = isGuardiaMode()
    ? "guardia"
    : isPaseMode()
      ? "pase"
      : isModeSala(st)
        ? "sala"
        : "interconsulta";
  if (mode === current) {
    toggleHeaderModeSegExpand();
    syncHeaderModeSeg();
    return;
  }
  if (mode === "guardia") {
    toggleGuardiaMode();
    collapseHeaderModeSeg();
    syncHeaderModeSeg();
    return;
  }
  if (mode === "pase") {
    if (isGuardiaMode()) toggleGuardiaMode();
    setUiDensity("pase");
    collapseHeaderModeSeg();
    syncHeaderModeSeg();
    return;
  }
  if (isGuardiaMode()) toggleGuardiaMode();
  else if (isPaseMode()) setUiDensity("normal");
  var wantSala = mode === "sala";
  if (wantSala !== isModeSala(st)) {
    st.appMode = wantSala ? "sala" : "interconsulta";
    invalidateLoadSettingsSnapshot();
    syncAppModeRadioControls();
    applyAppModeSwitchEffects();
    persistSettingsToLocalStorage();
  }
  collapseHeaderModeSeg();
  syncHeaderModeSeg();
}
