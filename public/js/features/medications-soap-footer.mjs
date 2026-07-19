import { medRecetaByPatient } from "../app-state.mjs";
import { effectiveSoapCategory, classifyMedicationSoapCategory, shouldIncludeMedicationInSoap } from "../med-receta-core.mjs";
import { isModeSala } from "../mode-features.mjs";
import { medInstructionFragmentForSoap } from "./estado-actual-meds.mjs";
import {
  detectInsulinPumpAlgorithmFromRecetaItems,
  insulinPumpMedLabelHtml,
  isInsulinIvMedicationItem,
} from "../insulin-pump-some-detect.mjs";
import { skipRecetaItemForInsulinPumpCarrier } from "../insulin-pump-receta-display.mjs";
import {
  isInsulinRescateMedicationItem,
  insulinRescateMedLabelHtml,
} from "../insulin-rescate-display.mjs";
import { rt } from "./medications-runtime-state.mjs";
import { esc, getMedNotaSelMap } from "./medications-utils.mjs";

function groupSoapPreviewItems(soapItems, allItems) {
  var groups = {
    analgesia: [],
    antiemeticos: [],
    sedacion: [],
    antiepilepticos: [],
    antiparkinsonianos: [],
    antidotos: [],
    viaAerea: [],
    antihta: [],
    diuretico: [],
    antitromboticos: [],
    anticoagulacion: [],
    antiarritmicos: [],
    estatinas: [],
    abx: [],
    transfusiones: [],
    vasop: [],
    nm: [],
    otros: [],
  };
  var pumpAlg = detectInsulinPumpAlgorithmFromRecetaItems(allItems || []);
  var pumpChipAdded = false;
  var rescateChipAdded = false;
  soapItems.forEach(function (it) {
    if (skipRecetaItemForInsulinPumpCarrier(it, allItems || [])) return;
    if (!shouldIncludeMedicationInSoap(it, classifyMedicationSoapCategory)) return;
    if (pumpAlg != null && isInsulinIvMedicationItem(it)) {
      if (!pumpChipAdded) {
        groups.nm.push({ _insulinPumpChip: true, _algorithm: pumpAlg });
        pumpChipAdded = true;
      }
      return;
    }
    if (isInsulinRescateMedicationItem(it)) {
      if (!rescateChipAdded) {
        groups.nm.push({ _insulinRescateChip: true });
        rescateChipAdded = true;
      }
      return;
    }
    var cat = effectiveSoapCategory(it, classifyMedicationSoapCategory);
    if (cat === "otros") groups.otros.push(it);
    else if (groups[cat]) groups[cat].push(it);
    else groups.otros.push(it);
  });
  return groups;
}

function chipsForSoapItems(arr) {
  return arr
    .map(function (it) {
      if (it && it._insulinPumpChip) {
        return (
          '<span class="med-soap-preview-chip med-soap-preview-chip--insulin-pump" title="Bomba de insulina IV (SOME)">' +
          insulinPumpMedLabelHtml(it._algorithm, esc) +
          "</span>"
        );
      }
      if (it && it._insulinRescateChip) {
        return (
          '<span class="med-soap-preview-chip med-soap-preview-chip--insulin-rescate" title="Rescates de insulina PRN (SOME)">' +
          insulinRescateMedLabelHtml(esc) +
          "</span>"
        );
      }
      var frag = medInstructionFragmentForSoap(it);
      return (
        '<span class="med-soap-preview-chip" title="' +
        esc((it.nombreRaw || "").slice(0, 220)) +
        '">' +
        esc(frag) +
        "</span>"
      );
    })
    .join("");
}

function soapPreviewSection(cat, title, groups) {
  if (!groups[cat].length) return "";
  return (
    '<div class="med-soap-preview-sec med-soap-preview-sec--' +
    cat +
    '">' +
    '<div class="med-soap-preview-sec-title">' +
    esc(title) +
    "</div>" +
    '<div class="med-soap-preview-chips">' +
    chipsForSoapItems(groups[cat]) +
    "</div></div>"
  );
}

function buildSoapPreviewHtml(soapItems, allItems) {
  if (!soapItems.length) {
    return '<p class="med-soap-preview-empty">Marcá <strong>SOAP</strong> en el listado para ver aquí cómo se repartirán en la plantilla.</p>';
  }
  var groups = groupSoapPreviewItems(soapItems, allItems);
  return (
    '<div class="med-soap-preview">' +
    soapPreviewSection("analgesia", "Analgésicos", groups) +
    soapPreviewSection("antiemeticos", "Antieméticos", groups) +
    soapPreviewSection("sedacion", "Sedación / delirium", groups) +
    soapPreviewSection("antiepilepticos", "Antiepilépticos", groups) +
    soapPreviewSection("antiparkinsonianos", "Antiparkinsonianos", groups) +
    soapPreviewSection("antidotos", "Antídotos", groups) +
    soapPreviewSection("viaAerea", "Vía aérea", groups) +
    soapPreviewSection("antihta", "Antihipertensivos", groups) +
    soapPreviewSection("diuretico", "Diuréticos", groups) +
    soapPreviewSection("antitromboticos", "Tromboprofilaxis", groups) +
    soapPreviewSection("anticoagulacion", "Anticoagulación", groups) +
    soapPreviewSection("antiarritmicos", "Antiarrítmicos", groups) +
    soapPreviewSection("estatinas", "Estatinas", groups) +
    soapPreviewSection("abx", "Antibióticos / antifúngicos", groups) +
    soapPreviewSection("transfusiones", "Transfusiones", groups) +
    soapPreviewSection("vasop", "Vasopresores / inotrópicos", groups) +
    soapPreviewSection("nm", "NM (insulina, tiroides, etc.)", groups) +
    soapPreviewSection("otros", "Otros — elegí destino en el listado", groups) +
    "</div>"
  );
}

export function renderMedNotaFooter() {
  var foot = document.getElementById("med-nota-footer");
  if (!foot) return;
  foot.hidden = false;

  var activeId = rt.getActiveId();
  var block = activeId ? medRecetaByPatient[activeId] : null;
  var sel = activeId ? getMedNotaSelMap(activeId) : {};
  var soapItems =
    block && block.items
      ? block.items.filter(function (it) {
          return sel[it.id] && !it.suspendido;
        })
      : [];

  var allItems = block && block.items ? block.items : [];
  var previewHtml = buildSoapPreviewHtml(soapItems, allItems);
  var soapBtnLabel = isModeSala(rt.getSettings()) ? "Enviar a Estado Actual" : "Abrir plantilla SOAP";

  foot.innerHTML =
    '<div class="med-nota-toolbar">' +
    '<p class="med-nota-hint">Los medicamentos con <strong>SOAP</strong> activo se clasifican por nombre; los marcados como <strong>Otros</strong> requieren elegir destino en la columna <strong>Destino</strong>.</p>' +
    previewHtml +
    '<div class="med-nota-actions">' +
    '<button type="button" class="btn-generate" onclick="mediAnadirATratamiento()">Añadir a Tratamiento</button>' +
    '<button type="button" class="btn-med-secondary" onclick="mediLlevarASOAP()">' +
    soapBtnLabel +
    '</button>' +
    '<button type="button" class="btn-med-secondary" onclick="limpiarManejoActual()">Limpiar</button>' +
    "</div>" +
    "</div>";
}

export function hideMedNotaFooter() {
  var foot = document.getElementById("med-nota-footer");
  if (foot) {
    foot.hidden = true;
    foot.innerHTML = "";
  }
}
