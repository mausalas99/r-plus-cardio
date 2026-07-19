import {
  rt,
  medToast,
  medRecetaPasteModalWired,
  markMedRecetaPasteModalWired,
} from "./medications-runtime-state.mjs";
import { restoreMedInputForPatient, stashMedInputForPatient } from "./medications-input.mjs";
import { closeMedPharmModals } from "./med-pharm-profile-panel.mjs";

function isMedRecetaPasteModalOpen() {
  var el = document.getElementById("med-receta-paste-modal");
  return !!(el && el.classList.contains("open"));
}

export function wireMedRecetaPasteModalOnce() {
  if (medRecetaPasteModalWired) return;
  var bd = document.getElementById("med-receta-paste-modal");
  if (!bd) return;
  markMedRecetaPasteModalWired();
  bd.addEventListener("click", function (ev) {
    if (!bd.classList.contains("open")) return;
    if (ev.target === bd) closeMedRecetaPasteModal();
  });
  document.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key !== "Escape" || !isMedRecetaPasteModalOpen()) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeMedRecetaPasteModal();
    },
    true
  );
}

export function openMedRecetaPasteModal() {
  var activeId = rt.getActiveId();
  if (!activeId) {
    medToast("Selecciona un paciente primero", "error");
    return;
  }
  wireMedRecetaPasteModalOnce();
  closeMedPharmModals();
  restoreMedInputForPatient(activeId);
  var bd = document.getElementById("med-receta-paste-modal");
  if (!bd) return;
  bd.removeAttribute("hidden");
  bd.setAttribute("aria-hidden", "false");
  bd.classList.add("open");
  document.body.classList.add("rpc-med-receta-paste-open");
  var ta = document.getElementById("med-input");
  if (ta) {
    requestAnimationFrame(function () {
      ta.focus();
    });
  }
}

export function closeMedRecetaPasteModal() {
  var activeId = rt.getActiveId();
  if (activeId) stashMedInputForPatient(activeId);
  var bd = document.getElementById("med-receta-paste-modal");
  if (!bd) return;
  bd.classList.remove("open");
  bd.setAttribute("hidden", "");
  bd.setAttribute("aria-hidden", "true");
  document.body.classList.remove("rpc-med-receta-paste-open");
}
