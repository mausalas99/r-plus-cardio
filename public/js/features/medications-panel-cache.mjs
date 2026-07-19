import { medRecetaByPatient } from "../app-state.mjs";
import { classifyMedicationSoapCategory } from "../med-receta-core.mjs";
import { getMedSubview } from "./med-pharm-profile-panel.mjs";
import { rt, medOutputTab } from "./medications-runtime-state.mjs";
import { getMedNotaSelMap } from "./medications-utils.mjs";
import {
  INSULIN_RESCATE_GROUP_ID,
  isInsulinRescateGroupSoapSelected,
} from "../insulin-rescate-display.mjs";

export function medRecetaItemById(activeId, itemId) {
  var block = activeId ? medRecetaByPatient[activeId] : null;
  if (!block || !block.items) return null;
  var sid = String(itemId || "");
  return (
    block.items.find(function (x) {
      return String(x.id) === sid;
    }) || null
  );
}

export function buildMedPanelCacheKey(activeId) {
  if (!activeId) return "";
  var block = medRecetaByPatient[activeId];
  if (!block || ((!block.items || !block.items.length) && (!block.dietas || !block.dietas.length))) {
    return String(activeId) + "|empty|" + medOutputTab;
  }
  var selMap = getMedNotaSelMap(activeId);
  var medItems = block.items || [];
  var suspendIds = [];
  var selIds = [];
  var overrideSig = [];
  medItems.forEach(function (it) {
    var id = String(it.id || "");
    if (!id) return;
    if (it.suspendido) suspendIds.push(id);
    if (selMap[id]) selIds.push(id);
    if (it.soapCatOverride) overrideSig.push(id + ":" + it.soapCatOverride);
  });
  suspendIds.sort();
  selIds.sort();
  overrideSig.sort();
  return (
    String(activeId) +
    "|N" +
    medItems.length +
    "|F" +
    (block.fechaActualizacion || "") +
    "|S" +
    suspendIds.join(",") +
    "|P" +
    selIds.join(",") +
    "|O" +
    overrideSig.join(",") +
    "|T" +
    medOutputTab +
    "|D" +
    (block.dietas ? block.dietas.length : 0) +
    "|V" +
    getMedSubview() +
    "|cal" +
    (function () {
      var n = new Date();
      return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
    })()
  );
}

export function patchMedRecetaRowSoapUi(itemId) {
  var activeId = rt.getActiveId();
  if (!activeId) return false;
  var sid = String(itemId || "");
  if (sid === INSULIN_RESCATE_GROUP_ID) {
    var block = medRecetaByPatient[activeId];
    var items = block && block.items ? block.items : [];
    var listEl = document.getElementById("med-items-list");
    if (!listEl) return false;
    var row = listEl.querySelector('[data-med-item-id="' + INSULIN_RESCATE_GROUP_ID + '"]');
    if (!row) return false;
    var soapChk = row.querySelector("[data-med-soap-chk]");
    if (soapChk) {
      soapChk.checked = isInsulinRescateGroupSoapSelected(activeId, items, function (pid, id) {
        return !!getMedNotaSelMap(pid)[id];
      });
    }
    return true;
  }
  var it = medRecetaItemById(activeId, itemId);
  if (!it) return false;
  var listEl = document.getElementById("med-items-list");
  if (!listEl) return false;
  var sid = String(itemId || "");
  var row = listEl.querySelector('[data-med-item-id="' + (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(sid) : sid) + '"]');
  if (!row) return false;
  var soapChk = row.querySelector("[data-med-soap-chk]");
  if (soapChk) soapChk.checked = !!getMedNotaSelMap(activeId)[sid];
  var autoCat = classifyMedicationSoapCategory(it.nombreRaw, it.dosisRaw);
  row.classList.toggle(
    "med-receta-row--needs-dest",
    autoCat === "otros" && !!getMedNotaSelMap(activeId)[sid] && !it.soapCatOverride
  );
  return true;
}
