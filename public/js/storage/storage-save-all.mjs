import {
  estimateRpcPersistBytes,
  assessStoragePressure,
} from '../storage-quota.mjs';
import {
  invalidateParsed,
  skipClinicalLocalPersist,
  safeLocalStorageSet,
  getCachedQuotaEstimate,
  getBlobCache,
  setBlobCache,
} from './storage-core.mjs';
import { isDbMode, persistSaveAll, appStateFieldsToBlobs } from '../db-storage-bridge.mjs';
import { buildSaveAllPersistPayload } from './storage-save-all-helpers.mjs';

function buildSaveAllPayloadInput(
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  listadoProblemas,
  recetaHuByPatient,
  vpoByPatient,
  medPharmProfileByPatient
) {
  return {
    patients,
    notes,
    indicaciones,
    labHistory,
    medRecetaByPatient: medRecetaByPatient || {},
    listadoProblemas: listadoProblemas !== undefined ? listadoProblemas || {} : undefined,
    recetaHuByPatient: recetaHuByPatient !== undefined ? recetaHuByPatient || {} : undefined,
    vpoByPatient: vpoByPatient !== undefined ? vpoByPatient || {} : undefined,
    medPharmProfileByPatient:
      medPharmProfileByPatient !== undefined ? medPharmProfileByPatient || {} : undefined,
  };
}

async function persistSaveAllToDb(dbFields, level) {
  const dbRes = await persistSaveAll(dbFields, {
    meta: { source: 'storage.saveAll', level: level },
  });
  if (!dbRes || dbRes.ok === false) {
    return { ok: false, code: dbRes && dbRes.code ? dbRes.code : 'DB_ERROR', level: 'block' };
  }
  const writtenBlobs = appStateFieldsToBlobs(dbFields);
  setBlobCache(Object.assign({}, getBlobCache() || {}, writtenBlobs));
  invalidateParsed();
  return { ok: true, level: level === 'warn' ? 'warn' : 'ok' };
}

function persistSaveAllToLocalStorage(localWrites, level) {
  for (let i = 0; i < localWrites.length; i += 1) {
    if (!safeLocalStorageSet(localWrites[i][0], localWrites[i][1])) {
      return { ok: false, code: 'QUOTA_EXCEEDED', level: level };
    }
  }
  invalidateParsed();
  return { ok: true, level: level === 'warn' ? 'warn' : 'ok' };
}

export async function storageSaveAll(
  patients,
  notes,
  indicaciones,
  labHistory,
  medRecetaByPatient,
  listadoProblemas,
  recetaHuByPatient,
  vpoByPatient,
  medPharmProfileByPatient
) {
  if (skipClinicalLocalPersist()) {
    return { ok: true, level: 'ok' };
  }
  const payload = buildSaveAllPayloadInput(
    patients,
    notes,
    indicaciones,
    labHistory,
    medRecetaByPatient,
    listadoProblemas,
    recetaHuByPatient,
    vpoByPatient,
    medPharmProfileByPatient
  );
  const pending = estimateRpcPersistBytes(payload);
  const quotaInfo = await getCachedQuotaEstimate();
  const level = assessStoragePressure(pending, quotaInfo);
  if (level === 'block') {
    return { ok: false, code: 'QUOTA_EXCEEDED', level: 'block' };
  }

  const { dbFields, localWrites } = buildSaveAllPersistPayload(payload);

  if (isDbMode()) {
    return persistSaveAllToDb(dbFields, level);
  }

  return persistSaveAllToLocalStorage(localWrites, level);
}
