/** Perfil — populate profile modal form fields from settings. */
import { syncApprovedOutputDir } from "../document-export-client.mjs";
import {
  normalizeQuickOutputFormat,
  syncAppModeRadioControls,
} from "./profile-runtime.mjs";

function resolveCensoSalaValue(st) {
  var ubic = st.censoSala || "";
  if (!ubic && st.censoTorre) ubic = "torre";
  if (/^torre/i.test(ubic) && ubic !== "torre") ubic = "torre";
  return ubic;
}

function syncProfileToggleLabel(st) {
  var lbl = document.getElementById("profile-toggle-label");
  var profileTitle = "Mi Perfil";
  if (!lbl) return profileTitle;
  if (st.doctorName || st.grado) {
    var parts = [];
    if (st.doctorName) parts.push(st.doctorName);
    if (st.grado) parts.push(st.grado);
    profileTitle = parts.join(" · ");
  }
  lbl.textContent = profileTitle;
  var profileBtn = document.getElementById("profile-toggle-btn");
  if (profileBtn) {
    profileBtn.setAttribute("title", profileTitle);
    profileBtn.setAttribute("aria-label", profileTitle);
  }
  return profileTitle;
}

export function populateProfileIdentityFields(st) {
  var fields = [
    ["profile-doctor", st.doctorName],
    ["profile-cedula", st.cedulaProfesional],
    ["profile-profesor", st.profesorName],
    ["profile-r2", st.residenteR2],
    ["profile-r1a", st.residenteR1a || st.residenteR1],
    ["profile-r1b", st.residenteR1b],
    ["profile-maestro", st.profesorName],
    ["profile-censo-fimi-label", st.censoFimiLabel],
    ["profile-grado", st.grado],
  ];
  fields.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) el.value = pair[1] || "";
  });
  var censoSalaEl = document.getElementById("profile-censo-sala");
  if (censoSalaEl) censoSalaEl.value = resolveCensoSalaValue(st);
  syncAppModeRadioControls();
  var srvEl = document.getElementById("settings-default-servicio");
  if (srvEl) srvEl.value = st.defaultServicio || "";
  var medTpl = st.medicosPlantilla || {};
  ["profesor", "r4", "r2", "r1a", "r1b"].forEach(function (k) {
    var el = document.getElementById("settings-medico-" + k);
    if (el) el.value = medTpl[k] || "";
  });
  syncProfileToggleLabel(st);
}

export function populateProfileOutputFields(st) {
  var dirEl = document.getElementById("settings-output-dir");
  if (dirEl) {
    if (st.outputDir) {
      var pathParts = st.outputDir.replace(/\\/g, "/").split("/");
      dirEl.textContent = pathParts[pathParts.length - 1] || st.outputDir;
      dirEl.title = st.outputDir;
    } else {
      dirEl.textContent = "Descargas (predeterminado)";
      dirEl.title = "";
    }
    syncApprovedOutputDir(st.outputDir || "");
  }
  var quickFormatEl = document.getElementById("settings-quick-output-format");
  if (quickFormatEl) quickFormatEl.value = normalizeQuickOutputFormat(st.quickOutputFormat);
}
