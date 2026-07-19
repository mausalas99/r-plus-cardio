/** Perfil — format template editor navigation. */
import { isModeSala } from "../mode-features.mjs";
import {
  ensureProfileTemplateDefaults,
  resetProfileTemplatesToBlank,
} from "../profile-templates.mjs";
import {
  setFormatsEditMode,
  clearFormatsEditMode,
  getFormatsEditMode,
  loadDraftFromSettings,
  applyDraftToSettings,
  updateDefaultFormatField,
  resetDraftToBlank,
} from "../profile-formats-editor.mjs";
import {
  renderNoteForm,
  renderIndicaForm,
} from "./notes-indicaciones.mjs";
import {
  switchAppTab,
  switchInnerTab,
  renderInnerTabs,
} from "./pase-board.mjs";
import { syncHeaderModeSeg } from "./chrome.mjs";
import {
  getProfileRuntime,
  settingsRef,
} from "./profile-runtime.mjs";
import { loadSettings } from "./profile-load.mjs";
import { closeProfileModal } from "./profile-modal.mjs";

function ensureInterconsultaModeForFormats() {
  var st = settingsRef();
  if (!isModeSala(st)) return;
  st.appMode = "interconsulta";
  localStorage.setItem("rpc-settings", JSON.stringify(st));
  var modeSalaEl = document.getElementById("app-mode-sala");
  var modeInterEl = document.getElementById("app-mode-inter");
  if (modeInterEl) modeInterEl.checked = true;
  if (modeSalaEl) modeSalaEl.checked = false;
  renderInnerTabs();
  syncHeaderModeSeg();
  getProfileRuntime().syncWorkContextChrome();
}

function syncDraftFromFormatEditorDom() {
  var map = [
    ["fmt-default-nota-evolucion", "notaEvolucion"],
    ["fmt-default-nota-estudios", "notaEstudios"],
    ["fmt-default-ind-dieta", "dieta"],
    ["fmt-default-ind-cuidados", "cuidados"],
    ["fmt-default-ind-medicamentos", "medicamentos"],
    ["fmt-default-ind-estudios", "estudios"],
    ["fmt-default-ind-interconsultas", "interconsultas"],
  ];
  map.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) updateDefaultFormatField(pair[1], el.value);
  });
}

function scrollFormatsEditorIntoView() {
  requestAnimationFrame(function () {
    var root =
      getFormatsEditMode() === "indica"
        ? document.getElementById("indica-form")
        : document.getElementById("note-form");
    if (root) root.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function openNoteFormatsFromProfile() {
  closeProfileModal();
  var st = settingsRef();
  ensureProfileTemplateDefaults(st);
  ensureInterconsultaModeForFormats();
  loadDraftFromSettings(st);
  setFormatsEditMode("nota");
  switchAppTab("nota");
  switchInnerTab("notas");
  renderNoteForm();
  scrollFormatsEditorIntoView();
}

export function openIndicaFormatsFromProfile() {
  closeProfileModal();
  var st = settingsRef();
  ensureProfileTemplateDefaults(st);
  ensureInterconsultaModeForFormats();
  loadDraftFromSettings(st);
  setFormatsEditMode("indica");
  switchAppTab("nota");
  switchInnerTab("indica");
  renderIndicaForm();
  scrollFormatsEditorIntoView();
}

/** @deprecated — redirige a la pestaña Nota */
export function openTemplatesModal() {
  openNoteFormatsFromProfile();
}

export function closeTemplatesModal() {
  var m = document.getElementById("templates-modal");
  if (m) m.style.display = "none";
}

export function saveTemplates() {
  saveDefaultFormatsFromEditor();
}

export function saveDefaultFormatsFromEditor() {
  syncDraftFromFormatEditorDom();
  var st = settingsRef();
  applyDraftToSettings(st);
  localStorage.setItem("rpc-settings", JSON.stringify(st));
  loadSettings();
  getProfileRuntime().showToast("Formatos guardados ✓", "success");
}

export function exitFormatsEditor() {
  var was = getFormatsEditMode();
  clearFormatsEditMode();
  if (was === "nota") renderNoteForm();
  else if (was === "indica") renderIndicaForm();
}

export function resetProfileTemplates() {
  var st = settingsRef();
  resetProfileTemplatesToBlank(st);
  resetDraftToBlank();
  localStorage.setItem("rpc-settings", JSON.stringify(st));
  loadSettings();
  var mode = getFormatsEditMode();
  if (mode === "nota") renderNoteForm();
  else if (mode === "indica") renderIndicaForm();
  getProfileRuntime().showToast("Formatos restablecidos (plantillas en blanco)", "success");
}

export { updateDefaultFormatField };
