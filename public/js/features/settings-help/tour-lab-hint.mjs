/** Lab bulk paste tour hint modal. */
import { LAB_BULK_PATIENT_SEPARATOR } from '../../lab-bulk-paste.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import {
  ensureTourDemoLabInputBoth,
  getDemoTourLabPaste,
  getTourDemoDateBundle,
  tourDemoLabPasteHasBoth,
} from './tour-demo-seed.mjs';

const rt = getSettingsHelpRuntime();

export function openLabBulkTourHintModal() {
  ensureTourDemoLabInputBoth();
  var backdrop = document.getElementById('lab-bulk-tour-hint-backdrop');
  var sample = document.getElementById('lab-bulk-tour-hint-sample');
  var leads = backdrop ? backdrop.querySelectorAll('.lab-bulk-tour-hint-lead') : [];
  var insertBtn = backdrop
    ? backdrop.querySelector('button[onclick*="insertLabTourSecondPatientExample"]')
    : null;
  if (sample) {
    sample.textContent =
      LAB_BULK_PATIENT_SEPARATOR +
      '\n\n' +
      getTourDemoDateBundle().demoGarciaLabReport.trim();
  }
  if (leads[0]) {
    leads[0].innerHTML =
      'En el cuadro <strong>ya están cargados</strong> dos días de <strong>DEMO PÉREZ</strong> y, tras el separador, el reporte de <strong>DEMO GARCÍA</strong>. R+ los distingue por paciente y por fecha al procesar.';
  }
  if (leads[1]) {
    leads[1].textContent =
      'En el siguiente paso pulsa Procesar: verás la tabla multi-paciente. Si pegas más reportes, usa el separador (botón gris) entre pacientes distintos.';
  }
  if (insertBtn) {
    insertBtn.style.display = tourDemoLabPasteHasBoth(
      document.getElementById('lab-input') && document.getElementById('lab-input').value
    )
      ? 'none'
      : '';
  }
  if (!backdrop) return;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
}

export function closeLabBulkTourHintModal() {
  var backdrop = document.getElementById('lab-bulk-tour-hint-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

export function insertLabTourSecondPatientExample() {
  if (ensureTourDemoLabInputBoth()) {
    rt.showToast('Ejemplo completo (PÉREZ + GARCÍA) ya está en el cuadro', 'info');
    closeLabBulkTourHintModal();
    return;
  }
  var ta = document.getElementById('lab-input');
  if (!ta) return;
  ta.value = getDemoTourLabPaste();
  closeLabBulkTourHintModal();
  rt.showToast('Ejemplo de laboratorio insertado ✓', 'success');
}
