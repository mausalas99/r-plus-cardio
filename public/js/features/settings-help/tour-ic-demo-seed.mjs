/**
 * Seed the full IC demo patient (Rosa María Delgado Vázquez) for Cardio tours.
 * Silent — no confirm dialogs; overwrites by registro if already present.
 * Uses bundled JSON (esbuild) so hydrate works even if fetch of public/ fails.
 */
import { patients, saveState, labHistory } from '../../app-state.mjs';
import { renderPatientList, selectPatient, findPatientByRegistro } from '../patients.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import {
  DEMO_IC_REGISTRO,
  DEMO_IC_NOMBRE,
  getBundledDemoIcPatient,
  hydrateDemoIcPatientFromBundle,
  isDemoIcPatient,
} from '../cardio/demo-ic-hydrate.mjs';
import { applySinglePatientExportPayload } from '../platform/import-backup/import-core.mjs';
import {
  PATIENT_EXPORT_FORMAT,
  PATIENT_EXPORT_VERSION,
} from '../../patient-export-format.mjs';

export { DEMO_IC_REGISTRO, DEMO_IC_NOMBRE };
export const DEMO_IC_JSON_URL = 'demo-patients/demo-ic-seguimiento.json';

const rt = getSettingsHelpRuntime();

/**
 * Ensure the IC demo patient is in the census and selected.
 * Always refreshes from the bundled fixture (sync).
 * @returns {Promise<boolean>}
 */
export async function ensureTourIcDemoPatientActive() {
  try {
    const bundled = getBundledDemoIcPatient();
    if (!bundled) {
      rt.showToast('No se pudo cargar el caso IC demo.', 'error');
      return false;
    }

    const existing =
      findPatientByRegistro(DEMO_IC_REGISTRO) ||
      patients.find(function (p) {
        return isDemoIcPatient(p);
      });

    if (existing && existing.id) {
      hydrateDemoIcPatientFromBundle(existing);
      saveState({ immediate: true });
      renderPatientList();
      rt.setActiveId(existing.id);
      selectPatient(existing.id);
      return true;
    }

    applySinglePatientExportPayload({
      format: PATIENT_EXPORT_FORMAT,
      version: PATIENT_EXPORT_VERSION,
      patient: bundled,
      note: null,
      indicaciones: null,
      labHistory: [],
      medReceta: null,
    });
    saveState({ immediate: true });
    renderPatientList();

    const imported = findPatientByRegistro(DEMO_IC_REGISTRO);
    if (imported && imported.id) {
      rt.setActiveId(imported.id);
      selectPatient(imported.id);
      return true;
    }
    if (rt.getActiveId()) {
      selectPatient(rt.getActiveId());
    }
    return patients.length > 0;
  } catch {
    rt.showToast(
      'No se pudo hidratar el caso IC demo. Ejecuta npm run build:ui.',
      'error'
    );
    return false;
  }
}

/** True if IC demo is already the active patient. */
export function isTourIcDemoActive() {
  const id = rt.getActiveId && rt.getActiveId();
  if (!id) return false;
  const p = patients.find(function (x) {
    return x && String(x.id) === String(id);
  });
  return isDemoIcPatient(p);
}

/** Labs already attached to IC demo (for optional lab module). */
export function tourIcDemoHasLabs() {
  const p = findPatientByRegistro(DEMO_IC_REGISTRO);
  if (!p) return false;
  const hist = labHistory[p.id];
  return Array.isArray(hist) && hist.length > 0;
}
