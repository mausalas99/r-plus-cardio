import { ensureCardio } from '../../../../lib/cardio/patient-cardio.mjs';
import { patients } from '../../app-state.mjs';
import { rt } from '../pase-board-runtime.mjs';

/**
 * Minimal Manejo IC shell (Task 7). Full med tables land in Task 9.
 * @param {HTMLElement | null} mount
 */
export function renderManejoPanel(mount) {
  if (!mount) return;
  var patientId = rt.getActiveId && rt.getActiveId();
  var patient = patients.find(function (p) {
    return p && String(p.id) === String(patientId);
  });
  if (patient) ensureCardio(patient);
  mount.innerHTML =
    '<div class="manejo-panel" data-manejo-shell="1">' +
    '<p class="manejo-panel-placeholder">Manejo IC</p>' +
    '</div>';
}
