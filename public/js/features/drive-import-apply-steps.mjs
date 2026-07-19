import { patients } from '../app-state.mjs';
import { applyDefaultsToNewPatient } from '../app-shell.mjs';
import { generatePatientId, selectPatient, ensureUniquePatientName } from './patients.mjs';
import { applyDriveImportHcPatch } from './historia-clinica-panel.mjs';
import {
  applyDriveImportEventualidades,
  invalidateEventualidadesPanel,
  renderEventualidadesPanel,
} from './eventualidades-panel.mjs';
import { applyDriveImportLabSets } from './lab-panel.mjs';

/** @param {object} parsed @param {boolean} createNew */
export function createPatientFromDriveImport(parsed, createNew) {
  if (!createNew) return null;
  const h = parsed.header || {};
  const id = generatePatientId();
  const patient = {
    id,
    nombre: ensureUniquePatientName(h.nombre || 'PACIENTE SIN NOMBRE'),
    edad: h.edad || '',
    sexo: h.sexo === 'F' ? 'F' : 'M',
    cama: h.cama || '',
    registro: h.registro || '',
    area: '',
    servicio: '',
    cuarto: '',
    fromLab: false,
  };
  applyDefaultsToNewPatient(patient);
  patients.unshift(patient);
  selectPatient(id);
  return patient;
}

/** @param {object} patient @param {object} parsed @param {string} mode @param {boolean} fromReview */
export async function applyDriveImportHcStep(patient, parsed, mode, fromReview) {
  if (mode === 'eventos') return { ok: true, lanDeferred: false };
  const hcRes = await applyDriveImportHcPatch(patient, parsed.hcPatch || {}, mode, { fromReview });
  return { ok: hcRes.ok, lanDeferred: !!hcRes.lanDeferred };
}

/** @param {object} patient @param {object} parsed */
export async function applyDriveImportEventosStep(patient, parsed) {
  const evRes = await applyDriveImportEventualidades(patient, parsed.eventualidades.entries || []);
  invalidateEventualidadesPanel();
  const evMount = document.getElementById('exp-pane-eventualidades');
  if (evMount && evRes.added) renderEventualidadesPanel(evMount);
  return evRes;
}

/** @param {object} patient @param {object} parsed */
export async function applyDriveImportLabsStep(patient, parsed) {
  const labSets = parsed.laboratorios?.sets ? parsed.laboratorios.sets : [];
  if (!labSets.length) return { added: 0, skipped: 0 };
  return applyDriveImportLabSets(patient, labSets);
}

/** @param {string} mode @param {object} parsed @param {{ added: number }} labRes */
export function resolveDriveImportNavigateTo(mode, parsed, labRes) {
  const hcKeys = Object.keys(parsed.hcPatch || {}).filter((k) => !String(k).startsWith('_'));
  let navigateTo = mode === 'eventos' || !hcKeys.length ? 'eventualidades' : 'historia';
  if (labRes.added && navigateTo === 'eventualidades' && mode === 'eventos') navigateTo = 'lab';
  return navigateTo;
}
