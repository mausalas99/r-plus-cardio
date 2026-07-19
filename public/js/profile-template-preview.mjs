/**
 * Vista previa de plantillas clínicas con el mismo aspecto que Nota / Indicaciones en el expediente.
 */

import { esc } from './dom-escape.mjs';
function readonlyTextarea(rows, value, placeholder) {
  var ph = placeholder ? ' placeholder="' + esc(placeholder) + '"' : "";
  var body = esc(value || "");
  if (!body && placeholder) body = "";
  return (
    '<textarea class="tmpl-preview-readonly" rows="' +
    rows +
    '" readonly tabindex="-1"' +
    ph +
    ">" +
    body +
    "</textarea>"
  );
}

/** @param {string} title @param {string} tone @param {string} bodyHtml */
function noteCard(title, tone, bodyHtml) {
  return (
    '<div class="card tmpl-preview-card">' +
    '<div class="card-header card-header--tone-' +
    tone +
    '"><span class="tmpl-preview-card-title">' +
    esc(title) +
    "</span></div>" +
    '<div class="card-body"><div class="field-group">' +
    bodyHtml +
    "</div></div></div>"
  );
}

/** @param {string} label @param {string} value @param {string} [placeholder] */
export function indicaSectionPreview(label, value, placeholder) {
  return (
    '<div class="indica-section tmpl-preview-indica">' +
    '<div class="indica-section-header">' +
    esc(label) +
    "</div>" +
    '<div class="indica-section-body">' +
    readonlyTextarea(3, value, placeholder) +
    "</div></div>"
  );
}

/** @param {{ evolucion?: string, estudios?: string }} t */
export function renderNotaTemplatesPreview(t) {
  var ev = t.evolucion || "";
  var est = t.estudios || "";
  return (
    '<div class="tmpl-preview-stack tmpl-preview-stack--nota">' +
    noteCard(
      "Evolución y actualización del cuadro clínico",
      "green",
      readonlyTextarea(
        7,
        ev,
        "Estructura N / V / HD / HI / NM. Usa Plantilla SOAP o edita el formato desde Mi Perfil."
      )
    ) +
    noteCard(
      "Resultados de estudios auxiliares",
      "indigo",
      readonlyTextarea(
        9,
        est,
        "FECHA (DD/MM/AA)\nQS\nBH\nEGO\n(una línea por renglón)"
      )
    ) +
    "</div>"
  );
}

/** @param {{ dieta?: string, cuidados?: string, medicamentos?: string, estudios?: string, interconsultas?: string }} t */
export function renderIndicaTemplatesPreview(t) {
  return (
    '<div class="tmpl-preview-stack tmpl-preview-stack--indica">' +
    indicaSectionPreview(
      "Dieta",
      t.dieta,
      "Escriba la dieta (una indicación por línea si aplica)…"
    ) +
    indicaSectionPreview(
      "Cuidados",
      t.cuidados,
      "Signos vitales, balance, dispositivos, etc.…"
    ) +
    indicaSectionPreview(
      "Medicamentos",
      t.medicamentos,
      "Fármaco, dosis, vía y horario…"
    ) +
    indicaSectionPreview(
      "Estudios",
      t.estudios,
      "BH, QS, EGO, imágenes…"
    ) +
    indicaSectionPreview(
      "Interconsultas",
      t.interconsultas,
      "Servicio y motivo de interconsulta…"
    ) +
    "</div>"
  );
}

/** @param {Record<string, unknown>} st */
export function renderProfileFormatsPreview(st) {
  var nota = renderNotaTemplatesPreview({
    evolucion: String(st.defaultNotaEvolucion || ""),
    estudios: String(st.defaultNotaEstudios || ""),
  });
  var ind = renderIndicaTemplatesPreview({
    dieta: String(st.defaultDieta || ""),
    cuidados: String(st.defaultCuidados || ""),
    medicamentos: String(st.defaultMedicamentos || ""),
    estudios: String(st.defaultIndicacionesEstudios || ""),
    interconsultas: String(st.defaultIndicacionesInterconsultas || ""),
  });
  return (
    '<div class="profile-templates-preview-wrap">' +
    '<p class="profile-templates-preview-heading">Vista previa · Nota (Interconsulta)</p>' +
    nota +
    '<p class="profile-templates-preview-heading">Vista previa · Indicaciones</p>' +
    ind +
    "</div>"
  );
}

/** Lee valores actuales del modal de edición. */
export function readTemplatesModalValues() {
  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }
  return {
    evolucion: v("tmpl-nota-evolucion"),
    estudios: v("tmpl-nota-estudios"),
    dieta: v("tmpl-dieta"),
    cuidados: v("tmpl-cuidados"),
    medicamentos: v("tmpl-meds"),
    estudiosInd: v("tmpl-ind-estudios"),
    interconsultas: v("tmpl-ind-inter"),
  };
}

export function syncTemplatesModalPreview() {
  var vals = readTemplatesModalValues();
  var notaEl = document.getElementById("templates-preview-nota");
  var indEl = document.getElementById("templates-preview-indica");
  if (notaEl) {
    notaEl.innerHTML = renderNotaTemplatesPreview({
      evolucion: vals.evolucion,
      estudios: vals.estudios,
    });
  }
  if (indEl) {
    indEl.innerHTML = renderIndicaTemplatesPreview({
      dieta: vals.dieta,
      cuidados: vals.cuidados,
      medicamentos: vals.medicamentos,
      estudios: vals.estudiosInd,
      interconsultas: vals.interconsultas,
    });
  }
}

var _previewBound = false;

export function bindTemplatesModalPreviewInputs() {
  syncTemplatesModalPreview();
  if (_previewBound) return;
  _previewBound = true;
  [
    "tmpl-nota-evolucion",
    "tmpl-nota-estudios",
    "tmpl-dieta",
    "tmpl-cuidados",
    "tmpl-meds",
    "tmpl-ind-estudios",
    "tmpl-ind-inter",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", syncTemplatesModalPreview);
  });
}

/** @param {Record<string, unknown>} st */
export function syncProfileFormatsPreview(st) {
  var root = document.getElementById("profile-templates-preview-root");
  if (!root) return;
  root.innerHTML = renderProfileFormatsPreview(st || {});
}
