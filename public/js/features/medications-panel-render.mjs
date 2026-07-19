import { medRecetaByPatient } from "../app-state.mjs";
import { buildMedRecetaCopyText, buildMedRecetaNameOnlyText } from "../med-receta-core.mjs";
import { isPaseMode } from "./chrome.mjs";
import {
  getMedSubview,
  initMedPharmSubviewUi,
  renderMedPharmProfilePanel,
  closeMedPharmModals,
} from "./med-pharm-profile-panel.mjs";
import { renderPaseBoard } from "./pase-board.mjs";
import { wireMedRecetaPasteModalOnce, closeMedRecetaPasteModal } from "./medications-paste-modal.mjs";
import { restoreMedInputForPatient } from "./medications-input.mjs";
import { buildMedPanelCacheKey } from "./medications-panel-cache.mjs";
import { buildMedDietHtml, buildMedRecetaListHtml } from "./medications-panel-rows.mjs";
import { renderMedNotaFooter, hideMedNotaFooter } from "./medications-soap-footer.mjs";
import {
  rt,
  medOutputTab,
  getLastMedPanelPatientId,
  setLastMedPanelPatientId,
  getMedPanelCacheKey,
  setMedPanelCacheKey,
  bustMedPanelCache,
} from "./medications-runtime-state.mjs";
import { manejoDiaOpts, setMedActiveLeadVisible, setMedDiaBtnVisible } from "./medications-utils.mjs";

function getMedPanelDom() {
  return {
    hintEl: document.getElementById("med-hint"),
    fechaEl: document.getElementById("med-fecha-actualizacion"),
    listEl: document.getElementById("med-items-list"),
    outPre: document.getElementById("med-output"),
    outCard: document.getElementById("med-output-section"),
  };
}

function renderMedPanelEmptyNoPatient(els) {
  bustMedPanelCache();
  els.hintEl.hidden = false;
  els.hintEl.textContent = "Selecciona un paciente en la columna izquierda para ver su manejo.";
  setMedActiveLeadVisible(false);
  setMedDiaBtnVisible(false);
  if (els.fechaEl) els.fechaEl.hidden = true;
  els.listEl.innerHTML = "";
  els.outPre.textContent = "";
  if (els.outCard) els.outCard.style.display = "none";
  hideMedNotaFooter();
  if (isPaseMode()) renderPaseBoard();
}

function renderMedPanelEmptyNoContent(activeId, cacheKey, els) {
  setMedPanelCacheKey(cacheKey);
  els.hintEl.hidden = false;
  els.hintEl.textContent =
    "Aún no hay medicamentos. Pulsa Importar SOME, pega el bloque del hospital y procesa la receta.";
  setMedActiveLeadVisible(false);
  setMedDiaBtnVisible(false);
  if (els.fechaEl) els.fechaEl.hidden = true;
  els.listEl.innerHTML = "";
  els.outPre.textContent = "";
  if (els.outCard) els.outCard.style.display = "none";
  hideMedNotaFooter();
  if (isPaseMode()) renderPaseBoard();
}

function syncMedOutputTabChrome(outPre, outCard, block) {
  var tabFull = document.getElementById("med-tab-full");
  var tabSimple = document.getElementById("med-tab-simple");
  var tabTrack = document.getElementById("med-output-tabs-track");
  if (tabTrack) tabTrack.setAttribute("data-active", medOutputTab === "simple" ? "simple" : "full");
  if (tabFull) {
    tabFull.classList.toggle("active", medOutputTab === "full");
    tabFull.setAttribute("aria-selected", medOutputTab === "full" ? "true" : "false");
  }
  if (tabSimple) {
    tabSimple.classList.toggle("active", medOutputTab === "simple");
    tabSimple.setAttribute("aria-selected", medOutputTab === "simple" ? "true" : "false");
  }
  var items = block.items || [];
  var diaOpts = manejoDiaOpts(block.fechaActualizacion);
  var txtFull = buildMedRecetaCopyText(items, diaOpts);
  var txtSimple = buildMedRecetaNameOnlyText(items, diaOpts);
  var txt = medOutputTab === "simple" ? txtSimple : txtFull;
  outPre.textContent = txt;
  if (outCard) outCard.style.display = txt.trim() ? "block" : "none";
}

function renderMedPanelRecetaContent(activeId, block, cacheKey, els) {
  setMedPanelCacheKey(cacheKey);
  els.hintEl.hidden = true;
  setMedActiveLeadVisible(true);
  setMedDiaBtnVisible(true);
  if (els.fechaEl) {
    els.fechaEl.hidden = false;
    var fechaTxt = block.fechaActualizacion || "—";
    els.fechaEl.textContent = fechaTxt;
    els.fechaEl.title = "Última importación SOME: " + fechaTxt;
  }
  els.listEl.innerHTML = buildMedDietHtml(block.dietas) + buildMedRecetaListHtml(activeId, block);
  renderMedNotaFooter();
  syncMedOutputTabChrome(els.outPre, els.outCard, block);
  if (isPaseMode()) renderPaseBoard();
}

function handleMedPanelPatientChange(activeId) {
  if (activeId === getLastMedPanelPatientId()) return;
  setLastMedPanelPatientId(activeId);
  bustMedPanelCache();
  closeMedPharmModals();
  closeMedRecetaPasteModal();
}

function shouldSkipMedPanelCacheHit(activeId, cacheKey, els) {
  if (!activeId || getMedPanelCacheKey() !== cacheKey) return false;
  if (els.listEl.querySelector(".med-receta-wrap")) return true;
  var cachedBlock = medRecetaByPatient[activeId];
  return (!cachedBlock || !cachedBlock.items || !cachedBlock.items.length) && !els.hintEl.hidden;
}

function renderMedPanelForActivePatient(activeId, cacheKey, els) {
  restoreMedInputForPatient(activeId);
  var block = medRecetaByPatient[activeId];
  var hasRecetaContent =
    block && ((block.items && block.items.length) || (block.dietas && block.dietas.length));
  if (!hasRecetaContent) {
    renderMedPanelEmptyNoContent(activeId, cacheKey, els);
    return;
  }
  if (getMedPanelCacheKey() === cacheKey && els.listEl.querySelector(".med-receta-wrap")) {
    return;
  }
  renderMedPanelRecetaContent(activeId, block, cacheKey, els);
}

export function renderMedRecetaPanel() {
  initMedPharmSubviewUi();
  wireMedRecetaPasteModalOnce();
  var activeId = rt.getActiveId();
  handleMedPanelPatientChange(activeId);
  if (getMedSubview() === "perfil") {
    bustMedPanelCache();
    renderMedPharmProfilePanel();
    return;
  }
  var els = getMedPanelDom();
  if (!els.hintEl || !els.listEl || !els.outPre) return;
  var cacheKey = buildMedPanelCacheKey(activeId);
  if (shouldSkipMedPanelCacheHit(activeId, cacheKey, els)) return;
  if (!activeId) {
    renderMedPanelEmptyNoPatient(els);
    return;
  }
  renderMedPanelForActivePatient(activeId, cacheKey, els);
}
