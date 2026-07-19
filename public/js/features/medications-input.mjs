import { medRecetaByPatient, saveState } from "../app-state.mjs";
import { isDemoPatientId } from "./medications-utils.mjs";

/** Guarda el pegado del textarea antes de cambiar de paciente. */
export function stashMedInputForPatient(patientId) {
  if (!patientId || isDemoPatientId(patientId)) return;
  var ta = document.getElementById("med-input");
  if (!ta) return;
  var raw = ta.value || "";
  var block = medRecetaByPatient[patientId];
  if (!raw) {
    if (block) {
      delete block.pasteRaw;
      if (!block.items || !block.items.length) delete medRecetaByPatient[patientId];
      else saveState();
    }
    return;
  }
  if (!block) medRecetaByPatient[patientId] = { pasteRaw: raw };
  else block.pasteRaw = raw;
  saveState();
}

export function restoreMedInputForPatient(patientId) {
  var ta = document.getElementById("med-input");
  if (!ta) return;
  var block = patientId ? medRecetaByPatient[patientId] : null;
  ta.value = block && block.pasteRaw ? block.pasteRaw : "";
}
