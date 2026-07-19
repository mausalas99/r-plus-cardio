import { saveState } from '../../app-state.mjs';
import {
  getActiveLiveSyncRoomId,
  isLanSessionConfiguredForRest,
} from '../lan-sync.mjs';
import {
  markHistoriaPendingLanSync,
  schedulePendingHistoriaClinicaLanSync,
} from '../../historia-clinica-lan-sync.mjs';
import { mergeHcPatch } from '../../../../lib/drive-import/merge-hc-patch.mjs';
import { applyClinicalHistoryUppercase } from '../../../../lib/historia-clinica/clinical-text.mjs';
import { normalizeData } from './data-normalize.mjs';
import { invalidateHistoriaClinicaPanel } from './state.mjs';

/** Drive import: local patient HC only (no remote GET — keeps import instant). */
function resolveDriveImportHcBase(patient) {
  var data = normalizeData(patient.historiaClinica && patient.historiaClinica.data, patient.id, patient);
  var version = patient.historiaClinica ? Number(patient.historiaClinica.version || 0) : 0;
  return { data: data, version: version };
}

/**
 * @param {object} patient
 * @param {Record<string, unknown>} patch
 * @param {'fill' | 'replace' | 'eventos'} mode
 * @returns {Promise<{ ok: boolean }>}
 */
export async function applyDriveImportHcPatch(patient, patch, mode, opts) {
  opts = opts || {};
  if (!patient || mode === 'eventos') return { ok: true };
  var roomId = getActiveLiveSyncRoomId() || '';
  var mergeMode = opts.fromReview || mode === 'replace' ? 'replace' : 'fill';
  var dirty = Object.keys(patch || {}).filter(function (k) {
    return !String(k).startsWith('_');
  });

  var base = resolveDriveImportHcBase(patient);
  var merged = mergeHcPatch(base.data, patch || {}, mergeMode);
  applyClinicalHistoryUppercase(merged);

  patient.historiaClinica = {
    version: Number(base.version || 0) + 1,
    data: merged,
  };

  var needsBackgroundLan = !!(isLanSessionConfiguredForRest() && roomId && dirty.length);
  if (needsBackgroundLan) {
    markHistoriaPendingLanSync(patient, {
      expectedVersion: base.version,
      baseData: base.data,
      changedKeys: dirty,
      source: 'drive-import',
    });
  } else if (patient.historiaClinica.pendingLanSync) {
    delete patient.historiaClinica.pendingLanSync;
    delete patient.historiaClinica.lanSyncPending;
  }

  saveState({ immediate: true });
  invalidateHistoriaClinicaPanel();
  if (needsBackgroundLan) schedulePendingHistoriaClinicaLanSync(patient);
  return { ok: true, lanDeferred: needsBackgroundLan };
}
