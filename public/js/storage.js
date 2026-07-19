// storage.js — Data persistence layer (thin barrel)
import { clinicalBlobStorageMethods } from './storage/storage-clinical-methods.mjs';
import { prefsStorageMethods } from './storage/storage-prefs-methods.mjs';
import { storageSaveAll } from './storage/storage-save-all.mjs';
export { ensureStorageHydrated, clearBlobCacheForTests } from './storage/storage-hydration.mjs';
export { isMeaningfulLabHistorySet, normalizeLabHistoryPatientSets } from './storage/storage-lab.mjs';
export { batchFetch, flushBatch } from './storage/storage-batch.mjs';

export const storage = {
  ...clinicalBlobStorageMethods,
  ...prefsStorageMethods,
  saveAll: storageSaveAll,
};

// Methods that need `this` binding
const _origRemoveScheduled = storage.removeScheduledProceduresForPatient;
storage.removeScheduledProceduresForPatient = function (patientId) {
  return _origRemoveScheduled.call(storage, patientId);
};
const _origGetLanSnapshot = storage.getLanRoomSnapshot;
storage.getLanRoomSnapshot = function (roomId) {
  return _origGetLanSnapshot.call(storage, roomId);
};
