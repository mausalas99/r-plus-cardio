/** Perfil — save settings from modal form. */
import { notes, saveState } from "../app-state.mjs";
import { renderNoteForm, applyProfileToNoteIfEmpty } from "./notes-indicaciones.mjs";
import {
  getProfileRuntime,
  normalizeQuickOutputFormat,
  settingsRef,
} from "./profile-runtime.mjs";
import { loadSettings } from "./profile-load.mjs";

function readProfileField(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function applyProfileFormToSettings(st) {
  st.doctorName = readProfileField("profile-doctor");
  st.cedulaProfesional = readProfileField("profile-cedula");
  st.profesorName = readProfileField("profile-profesor");
  st.residenteR2 = readProfileField("profile-r2");
  st.residenteR1a = readProfileField("profile-r1a");
  st.residenteR1b = readProfileField("profile-r1b");
  st.residenteR1 = st.residenteR1a;
  st.censoSala = readProfileField("profile-censo-sala");
  st.censoTorre = st.censoSala === "torre" ? "Torre HU" : "";
  st.censoFimiLabel = readProfileField("profile-censo-fimi-label");
  st.profesorName =
    readProfileField("profile-maestro") || readProfileField("profile-profesor");
  st.grado = readProfileField("profile-grado");
  st.quickOutputFormat = normalizeQuickOutputFormat(st.quickOutputFormat);
}

export function saveSettings() {
  var st = settingsRef();
  applyProfileFormToSettings(st);
  localStorage.setItem("rpc-settings", JSON.stringify(st));
  var backfill = false;
  Object.keys(notes).forEach(function (pid) {
    if (notes[pid] && applyProfileToNoteIfEmpty(notes[pid])) backfill = true;
  });
  if (backfill) saveState();
  loadSettings();
  if (getProfileRuntime().getActiveId()) renderNoteForm();
  getProfileRuntime().showToast("Perfil guardado ✓", "success");
}

export function saveQuickOutputFormat(format) {
  var st = settingsRef();
  st.quickOutputFormat = normalizeQuickOutputFormat(format);
  localStorage.setItem("rpc-settings", JSON.stringify(st));
  loadSettings();
  getProfileRuntime().showToast("Formato de salida rápida actualizado", "success");
}
