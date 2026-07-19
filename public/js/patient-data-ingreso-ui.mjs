import { accesoFechaToDateInputValue } from './patient-date-fields.mjs';
import { resolveCensoFimiLabel } from './censo-header-format.mjs';

/**
 * FIUX (urgencias) y FIMI/servicio — fechas con calendario rpc-date.
 * @param {Record<string, unknown>} patient
 * @param {Record<string, unknown>} [settings]
 */

import { esc } from './dom-escape.mjs';
export function buildPatientIngresoFechasHtml(patient, settings) {
  var fimiLabel = resolveCensoFimiLabel(settings || {});
  return (
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
    '<div class="field-group"><label>FIUX (urgencias)</label>' +
    '<input type="date" class="rpc-date-input" value="' +
    esc(accesoFechaToDateInputValue(patient.fiuxFecha)) +
    '" oninput="updatePatient(\'fiuxFecha\',this.value)" aria-label="FIUX ingreso urgencias">' +
    '</div>' +
    '<div class="field-group"><label>' +
    esc(fimiLabel) +
    ' (servicio)</label>' +
    '<input type="date" class="rpc-date-input" value="' +
    esc(accesoFechaToDateInputValue(patient.fimiFecha)) +
    '" oninput="updatePatient(\'fimiFecha\',this.value)" aria-label="' +
    esc(fimiLabel) +
    ' ingreso servicio">' +
    '</div></div>'
  );
}
