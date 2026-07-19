import { saveState } from '../../app-state.mjs';
import { createMutationBuilder } from '../../versioned-mutation.mjs';
import {
  lanPushHistoriaClinica,
  getActiveLiveSyncRoomId,
  isLanSessionConfiguredForRest,
  touchPatientLanUpdatedAt,
} from '../lan-sync.mjs';
import { migrateLegacyHistoriaData } from '../../../../lib/historia-clinica/migrate-legacy.mjs';
import { applyClinicalHistoryUppercase } from '../../../../lib/historia-clinica/clinical-text.mjs';
import { rt } from './runtime.mjs';
import { CATALOGS, DATA_KEYS } from './catalogs.mjs';
import { syncSignosVitalesIngresoFromEstadoActual } from './data-normalize.mjs';
import { getDirtyKeys, hcState, resetDirtyKeys } from './state.mjs';

function buildHistoriaMutation(patient, dirty, roomId) {
  const builder = createMutationBuilder('historiaClinica', patient.id).captureBase(
    Object.assign({ version: hcState.version }, hcState.data)
  );
  dirty.forEach(function (k) {
    if (hcState.data[k] !== undefined) builder.set(k, hcState.data[k]);
  });
  return builder.build({
    roomId,
    patientId: patient.id,
    clientId: localStorage.getItem('rpc-lan-client-id') || 'local',
    audit: { sections: dirty, safety: hcState.pendingAck },
  });
}

async function saveHistoriaToLan(root, patient, rerender, dirty, roomId) {
  const mutation = buildHistoriaMutation(patient, dirty, roomId);
  const out = await lanPushHistoriaClinica(patient.id, mutation);
  if (out && out.conflict) return;
  if (!out || !out.ok) return;
  hcState.version = out.version;
  hcState.data = migrateLegacyHistoriaData(out.data, CATALOGS);
  patient.historiaClinica = { version: hcState.version, data: Object.assign({}, hcState.data) };
  saveState();
  touchPatientLanUpdatedAt(patient.id);
  hcState.editMode = false;
  hcState.pendingAck = [];
  resetDirtyKeys();
  if (typeof rerender === 'function') rerender(root);
  rt.showToast('Historia clínica guardada.', 'success');
}

function saveHistoriaLocally(root, patient, rerender) {
  patient.historiaClinica = { version: hcState.version + 1, data: Object.assign({}, hcState.data) };
  hcState.version += 1;
  hcState.editMode = false;
  hcState.pendingAck = [];
  resetDirtyKeys();
  saveState();
  touchPatientLanUpdatedAt(patient.id);
  if (typeof rerender === 'function') rerender(root);
  rt.showToast('Historia clínica guardada.', 'success');
}

export async function saveHistoria(root, patient, rerender, _skipAckCheck) {
  if (hcState.data) applyClinicalHistoryUppercase(hcState.data);
  syncSignosVitalesIngresoFromEstadoActual(patient);

  var dirtyKeys = getDirtyKeys();
  var dirty = Array.from(dirtyKeys);
  if (!dirty.length && hcState.version > 0) {
    rt.showToast('No hay cambios para guardar.', 'info');
    return;
  }
  if (!hcState.version && !dirty.length) {
    dirty = DATA_KEYS.slice();
  }

  var roomId = getActiveLiveSyncRoomId() || '';
  if (isLanSessionConfiguredForRest() && roomId) {
    await saveHistoriaToLan(root, patient, rerender, dirty, roomId);
    return;
  }

  saveHistoriaLocally(root, patient, rerender);
}
