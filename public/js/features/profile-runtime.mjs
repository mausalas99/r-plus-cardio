/** Perfil — shared runtime and settings accessor. */
import { isCardionotasInterconsultaEnabled } from '../cardio/cardionotas-gates.mjs';

/** @type {{
 *   showToast(msg: string, type?: string): void,
 *   syncWorkContextChrome(): void,
 *   getActiveId(): string|null,
 *   rebuildEstudiosFromLabHistory?(id: string): void,
 * }} */
var rt = {
  showToast() {},
  syncWorkContextChrome() {},
  getActiveId() {
    return null;
  },
};

export function registerProfileRuntime(ctx) {
  if (ctx && typeof ctx === "object") Object.assign(rt, ctx);
}

export function getProfileRuntime() {
  return rt;
}

var profileGetSettings = function () {
  return /** @type {Record<string, unknown>} */ ({});
};

export function attachProfileSettingsGetter(getter) {
  profileGetSettings = getter;
}

export function settingsRef() {
  return profileGetSettings();
}

/** @type {null|string} */
var _lastLoadSettingsSnapshot = null;

export function normalizeQuickOutputFormat(format) {
  var normalized = String(format || "").trim().toLowerCase();
  if (normalized !== "html" && normalized !== "txt" && normalized !== "docx") return "docx";
  return normalized;
}

export function buildLoadSettingsSnapshot() {
  var st = settingsRef();
  if (!st) return "";
  try {
    var fields = {
      d: st.doctorName,
      c: st.cedulaProfesional,
      p: st.profesorName,
      r2: st.residenteR2,
      r1: st.residenteR1,
      r1a: st.residenteR1a,
      r1b: st.residenteR1b,
      cs: st.censoSala,
      ct: st.censoTorre,
      g: st.grado,
      di: st.defaultDieta,
      cu: st.defaultCuidados,
      me: st.defaultMedicamentos,
      ne: st.defaultNotaEvolucion,
      ns: st.defaultNotaEstudios,
      od: st.outputDir,
      qf: st.quickOutputFormat,
      am: st.appMode,
    };
    var normalized = {};
    Object.keys(fields).forEach(function (key) {
      var val = fields[key];
      normalized[key] = key === "qf" ? normalizeQuickOutputFormat(val) : val || "";
    });
    normalized.am = normalized.am || "sala";
    return JSON.stringify(normalized);
  } catch {
    return String(Math.random());
  }
}

export function invalidateLoadSettingsSnapshot() {
  _lastLoadSettingsSnapshot = null;
}

export function getLastLoadSettingsSnapshot() {
  return _lastLoadSettingsSnapshot;
}

export function setLastLoadSettingsSnapshot(value) {
  _lastLoadSettingsSnapshot = value;
}

export function persistSettingsToLocalStorage() {
  try {
    localStorage.setItem("rpc-settings", JSON.stringify(settingsRef()));
  } catch {
    rt.showToast(
      "No se pudo guardar en el almacenamiento local. El modo puede no persistir al recargar.",
      "error"
    );
  }
}

export function syncAppModeRadioControls() {
  var st = settingsRef();
  var modeSala = document.getElementById("app-mode-sala");
  var modeInter = document.getElementById("app-mode-inter");
  if (!modeSala || !modeInter) return;
  var interEnabled = isCardionotasInterconsultaEnabled();
  var interLabel = modeInter.closest("label");
  if (interLabel) interLabel.hidden = !interEnabled;
  if (!interEnabled) {
    st.appMode = "sala";
    modeSala.checked = true;
    return;
  }
  if ((st.appMode || "sala") === "sala") modeSala.checked = true;
  else modeInter.checked = true;
}
