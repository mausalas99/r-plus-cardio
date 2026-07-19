import {
  lanFetchHistoriaClinica,
  isLanSessionConfiguredForRest,
} from '../lan-sync.mjs';
import { activePatient } from './runtime.mjs';

export function readLocalHistoria(patient) {
  if (!patient || !patient.historiaClinica || !patient.historiaClinica.data) return null;
  return {
    version: Number(patient.historiaClinica.version || 0),
    data: patient.historiaClinica.data,
    pendingLanSync: !!patient.historiaClinica.pendingLanSync,
  };
}

export async function fetchHistoriaRemote(patientId, roomId) {
  if (!isLanSessionConfiguredForRest() || !roomId) return null;
  try {
    var res = await Promise.race([
      lanFetchHistoriaClinica(patientId, roomId),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error('historia_fetch_timeout'));
        }, 4000);
      }),
    ]);
    if (!res || !res.ok || res.missing) return null;
    return { version: Number(res.version || 0), data: res.data };
  } catch {
    return null;
  }
}

export async function fetchHistoria(patientId, roomId) {
  var local = readLocalHistoria(activePatient());
  if (!isLanSessionConfiguredForRest() || !roomId) {
    return local;
  }
  if (local && local.pendingLanSync) {
    return local;
  }
  var remote = await fetchHistoriaRemote(patientId, roomId);
  if (!remote) return local;
  var localVer = local ? local.version : 0;
  if (local && localVer > remote.version) return local;
  return remote;
}
