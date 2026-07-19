/** Interno vitals host sync bridge (IM-11). */
import { patients, saveState } from '../../app-state.mjs';
import { mergePatientMonitoreoFromImported } from '../estado-actual-data.mjs';
import { mergeCensoPatientFields } from '../../patient-diagnosticos.mjs';
import { mergePatientRegistrationMeta } from '../../patient-registration-meta.mjs';
import { refreshGuardiaCensusFromDb } from '../../clinical-access-runtime.mjs';
import { isLanSessionConfiguredForRest } from './transport.mjs';
import { lanFetchHostPatientRow } from './host-patient-http.mjs';
import {
  fetchHostPatientsList,
  invalidateHostPatientsCache,
} from './host-patients-snapshot.mjs';
import { getLanRuntime } from './orchestrator-runtime.mjs';

/**
 * Interno board patients may exist on the host store before the desktop census row.
 * @param {string} patientId
 * @param {object | null | undefined} monitoreo
 */
async function ensureLocalPatientForInternoSync(patientId, monitoreo) {
  const pid = String(patientId || '').trim();
  if (!pid) return null;
  let local = patients.find((p) => p && String(p.id) === pid);
  if (local) return local;

  invalidateHostPatientsCache();
  if (isLanSessionConfiguredForRest()) {
    const list = await fetchHostPatientsList({ bypassCache: true });
    const hostRow = (list || []).find((row) => row && String(row.id) === pid);
    if (hostRow) {
      local = { ...hostRow };
      patients.push(local);
      return local;
    }
  }

  if (monitoreo && typeof monitoreo === 'object') {
    local = { id: pid, monitoreo: null };
    patients.push(local);
    return local;
  }
  return null;
}

/** @param {string} patientId */
/** Pull host monitoreo (interno vitals) into local patient row. */
export async function hydrateLocalPatientMonitoreoFromHost(patientId) {
  const pid = String(patientId || '').trim();
  if (!pid || !isLanSessionConfiguredForRest()) return { ok: false, error: 'not_configured' };
  const hostRow = await lanFetchHostPatientRow(pid);
  if (!hostRow) return { ok: false, error: 'not_found' };
  let local = patients.find((p) => p && String(p.id) === pid);
  if (!local) {
    local = await ensureLocalPatientForInternoSync(pid, hostRow.monitoreo);
    if (!local) return { ok: false, error: 'local_missing' };
  }
  const before = JSON.stringify(local.monitoreo || null);
  mergePatientMonitoreoFromImported(local, hostRow);
  if (hostRow.nombre && String(hostRow.nombre).trim()) local.nombre = hostRow.nombre;
  if (hostRow.cuarto) local.cuarto = hostRow.cuarto;
  if (hostRow.cama) local.cama = hostRow.cama;
  mergeCensoPatientFields(local, hostRow);
  mergePatientRegistrationMeta(local, hostRow);
  const changed = before !== JSON.stringify(local.monitoreo || null);
  if (changed) await saveState({ immediate: true });
  return { ok: true, changed };
}

/** Host Mac: interno vitals POST → IPC → refresh guardia census (LAN mode not required). */
export function wireInternoHostSyncBridge() {
  if (typeof window === 'undefined' || !window.electronAPI) return;
  if (typeof window.electronAPI.onInternoHostSync !== 'function') return;
  if (window.__rpcInternoHostSyncWired) return;
  window.__rpcInternoHostSyncWired = true;
  window.electronAPI.onInternoHostSync((payload) => {
    void handleInternoHostSyncBroadcast(payload);
  });
}

export async function handleInternoHostSyncBroadcast(detail) {
  const pid = String(detail?.patientId || '').trim();
  if (detail?.type === 'patients-updated' && pid) {
    const monitoreo = detail.monitoreo;
    if (monitoreo && typeof monitoreo === 'object') {
      const local = await ensureLocalPatientForInternoSync(pid, monitoreo);
      if (local) {
        mergePatientMonitoreoFromImported(local, { monitoreo });
        await saveState({ immediate: true });
      }
    } else {
      await hydrateLocalPatientMonitoreoFromHost(pid);
    }
  }
  if (detail?.type === 'patients-updated' || detail?.type === 'guardias-updated') {
    await refreshGuardiaCensusFromDb();
    const runtime = getLanRuntime();
    if (typeof runtime.renderPatientList === 'function') runtime.renderPatientList();
    document.dispatchEvent(
      new CustomEvent('rpc-interno-vitals-synced', { detail: { patientId: pid } })
    );
  }
}
