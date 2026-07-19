/**
 * Edición de formatos por defecto dentro de las pestañas Nota / Indicaciones (no en Mi Perfil).
 */

import { ensureProfileTemplateDefaults } from "./profile-templates.mjs";

/** @type {null | 'nota' | 'indica'} */
var formatsEditMode = null;

export function getFormatsEditMode() {
  return formatsEditMode;
}

/** @param {null | 'nota' | 'indica'} mode */

import { esc } from './dom-escape.mjs';
export function setFormatsEditMode(mode) {
  formatsEditMode = mode;
}

export function clearFormatsEditMode() {
  formatsEditMode = null;
}

function editorBanner(title, subtitle) {
  return (
    '<div class="formats-defaults-editor-banner" role="status">' +
    '<div class="formats-defaults-editor-banner-text">' +
    "<strong>" +
    esc(title) +
    "</strong>" +
    "<p>" +
    esc(subtitle) +
    "</p>" +
    "</div>" +
    '<div class="formats-defaults-editor-actions">' +
    '<button type="button" class="btn-cancel" onclick="exitFormatsEditor()">Volver al expediente</button>' +
    "</div></div>"
  );
}

function editorFooter() {
  return (
    '<div class="formats-defaults-editor-footer">' +
    '<button type="button" class="btn-save formats-defaults-save-btn" onclick="saveDefaultFormatsFromEditor()">Guardar</button>' +
    "</div>"
  );
}

/** @param {Record<string, unknown>} st */
export function buildNoteDefaultsEditorHtml(st) {
  ensureProfileTemplateDefaults(st);
  return (
    '<div class="formats-defaults-editor">' +
    editorBanner(
      "Formatos por defecto · Nota de evolución",
      "Misma vista que en el expediente. Estos textos se copian a pacientes nuevos o a secciones vacías."
    ) +
    '<div class="card"><div class="card-header card-header--tone-green card-header-row">' +
    '<span>Evolución y actualización del cuadro clínico</span></div>' +
    '<div class="card-body"><div class="field-group">' +
    '<textarea id="fmt-default-nota-evolucion" rows="7" placeholder="N: [Neurológico]&#10;V: [Ventilatorio]…" oninput="updateDefaultFormatField(\'notaEvolucion\',this.value)">' +
    esc(st.defaultNotaEvolucion) +
    "</textarea></div></div></div>" +
    '<div class="card"><div class="card-header card-header--tone-indigo">' +
    "<span>Resultados de estudios auxiliares</span></div>" +
    '<div class="card-body"><div class="field-group">' +
    '<textarea id="fmt-default-nota-estudios" rows="9" placeholder="FECHA (DD/MM/AA)&#10;QS&#10;BH…" oninput="updateDefaultFormatField(\'notaEstudios\',this.value)">' +
    esc(st.defaultNotaEstudios) +
    "</textarea></div></div></div>" +
    editorFooter() +
    "</div>"
  );
}

/** @param {Record<string, unknown>} st */
export function buildIndicaDefaultsEditorHtml(st) {
  ensureProfileTemplateDefaults(st);
  var sections = [
    { key: "dieta", label: "Dieta", ph: "Escriba la dieta…", val: st.defaultDieta },
    { key: "cuidados", label: "Cuidados", ph: "Signos vitales, balance…", val: st.defaultCuidados },
    {
      key: "medicamentos",
      label: "Medicamentos",
      ph: "Fármaco, dosis, vía…",
      val: st.defaultMedicamentos,
    },
    { key: "estudios", label: "Estudios", ph: "BH, QS, EGO…", val: st.defaultIndicacionesEstudios },
    {
      key: "interconsultas",
      label: "Interconsultas",
      ph: "Servicio y motivo…",
      val: st.defaultIndicacionesInterconsultas,
    },
  ];
  var body = sections
    .map(function (s) {
      return (
        '<div class="indica-section formats-defaults-indica-section">' +
        '<div class="indica-section-header">' +
        esc(s.label) +
        "</div>" +
        '<div class="indica-section-body">' +
        '<textarea id="fmt-default-ind-' +
        s.key +
        '" rows="3" placeholder="' +
        esc(s.ph) +
        '" oninput="updateDefaultFormatField(\'' +
        s.key +
        "',this.value)\">" +
        esc(s.val) +
        "</textarea></div></div>"
      );
    })
    .join("");
  return (
    '<div class="formats-defaults-editor">' +
    editorBanner(
      "Formatos por defecto · Indicaciones",
      "Misma vista que en el expediente. Se aplican al abrir indicaciones vacías de un paciente nuevo."
    ) +
    body +
    editorFooter() +
    "</div>"
  );
}

/** Campos en memoria mientras editas (antes de guardar). */
var draft = {};

export function loadDraftFromSettings(st) {
  ensureProfileTemplateDefaults(st);
  draft = {
    notaEvolucion: String(st.defaultNotaEvolucion || ""),
    notaEstudios: String(st.defaultNotaEstudios || ""),
    dieta: String(st.defaultDieta || ""),
    cuidados: String(st.defaultCuidados || ""),
    medicamentos: String(st.defaultMedicamentos || ""),
    estudios: String(st.defaultIndicacionesEstudios || ""),
    interconsultas: String(st.defaultIndicacionesInterconsultas || ""),
  };
}

export function applyDraftToSettings(st) {
  st.defaultNotaEvolucion = draft.notaEvolucion.trim();
  st.defaultNotaEstudios = draft.notaEstudios.trim();
  st.defaultDieta = draft.dieta.trim();
  st.defaultCuidados = draft.cuidados.trim();
  st.defaultMedicamentos = draft.medicamentos.trim();
  st.defaultIndicacionesEstudios = draft.estudios.trim();
  st.defaultIndicacionesInterconsultas = draft.interconsultas.trim();
}

export function updateDefaultFormatField(field, value) {
  if (Object.prototype.hasOwnProperty.call(draft, field)) {
    draft[field] = value;
  }
}

export function resetDraftToBlank() {
  draft = {
    notaEvolucion: "",
    notaEstudios: "",
    dieta: "",
    cuidados: "",
    medicamentos: "",
    estudios: "",
    interconsultas: "",
  };
}
