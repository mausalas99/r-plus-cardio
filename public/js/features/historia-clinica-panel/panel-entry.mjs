import {
  getActiveLiveSyncRoomId,
  isLanSessionConfiguredForRest,
} from '../lan-sync.mjs';
import { MOUNT_ID, activePatient } from './runtime.mjs';
import { normalizeData } from './data-normalize.mjs';
import { fetchHistoriaRemote, readLocalHistoria } from './fetch.mjs';
import { renderPanel } from './panel-controller.mjs';
import { hcState } from './state.mjs';

function hydrateHcStateFromLocal(patient) {
  const local = readLocalHistoria(patient);
  if (local) {
    hcState.version = local.version || 1;
    hcState.data = normalizeData(local.data, patient.id, patient);
    return local;
  }
  hcState.version = 0;
  hcState.data = normalizeData(null, patient.id, patient);
  return null;
}

async function mergeRemoteHistoriaIfNewer(patient, local) {
  const roomId = getActiveLiveSyncRoomId() || '';
  if (!isLanSessionConfiguredForRest() || !roomId || (local && local.pendingLanSync)) return;
  const remote = await fetchHistoriaRemote(patient.id, roomId);
  if (remote && (!local || remote.version >= local.version)) {
    hcState.version = remote.version;
    hcState.data = normalizeData(remote.data, patient.id, patient);
  }
}

export async function renderHistoriaClinicaPanel(opts) {
  opts = opts || {};
  var root = document.getElementById(MOUNT_ID);
  if (!root) return;
  var patient = activePatient();
  if (!patient) {
    root.innerHTML = '';
    if (opts.onReady) opts.onReady();
    return;
  }

  const local = hydrateHcStateFromLocal(patient);
  await mergeRemoteHistoriaIfNewer(patient, local);

  hcState.editMode = false;
  hcState.step = (hcState.data.meta && hcState.data.meta.lastStep) || 1;
  renderPanel(root);
  if (opts.onReady) opts.onReady();
}
