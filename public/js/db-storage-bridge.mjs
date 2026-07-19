/**
 * Renderer bridge for SQLCipher clinical blobs (Electron IPC).
 * Blob keys align with lib/db/clinical-blob-keys.mjs.
 */
import { resolveClinicalSessionUserId } from './clinical-session-context.mjs';

/** @type {Record<string, string>} app-state / saveAll field → clinical_blob.blob_key */
/** Keep in sync with lib/db/clinical-blob-keys.mjs LS_KEY_TO_BLOB */
export const CLINICAL_LS_KEYS = [
  'rpc-patients',
  'rpc-notes',
  'rpc-indicaciones',
  'rpc-labHistory',
  'rpc-medRecetaByPatient',
  'rpc-listado-problemas',
  'rpc-recetaHuByPatient',
  'rpc-vpoByPatient',
  'rpc-medPharmProfileByPatient',
  'rpc-medCatalog',
  'rpc-todos',
  'rpc-scheduled-procedures',
  'rpc-lan-room-snapshots',
  'rpc-lan-host-patient-map',
];

export const APP_FIELD_TO_BLOB = {
  patients: 'patients',
  notes: 'notes',
  indicaciones: 'indicaciones',
  labHistory: 'labHistory',
  medRecetaByPatient: 'medRecetaByPatient',
  listadoProblemas: 'listadoProblemas',
  recetaHuByPatient: 'recetaHuByPatient',
  vpoByPatient: 'vpoByPatient',
  medPharmProfileByPatient: 'medPharmProfileByPatient',
  medCatalog: 'medCatalog',
  todos: 'todos',
  scheduledProcedures: 'scheduledProcedures',
  lanRoomSnapshots: 'lanRoomSnapshots',
  lanHostPatientMap: 'lanHostPatientMap',
};

export function isDbMode() {
  return !!(
    typeof window !== 'undefined' &&
    window.electronAPI &&
    typeof window.electronAPI.dbClinicalLoadAll === 'function'
  );
}

/** Safari/iPad/PWA LAN client — no SQLCipher; team mirror scope always applies. */
export function isWebClinicalClient() {
  return typeof window !== 'undefined' && !isDbMode();
}

/**
 * @returns {Promise<Record<string, string>>} blob_key → JSON string
 */
export async function hydrateStorageCache() {
  const res = await window.electronAPI.dbClinicalLoadAll();
  if (!res || res.ok === false) {
    const err = new Error(res?.code || res?.error || 'DB_LOAD_FAILED');
    err.code = res?.code || 'DB_LOAD_FAILED';
    throw err;
  }
  return res.blobs && typeof res.blobs === 'object' ? res.blobs : {};
}

function parseBlobJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') {
    try {
      return raw == null ? fallback : raw;
    } catch {
      return fallback;
    }
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

/**
 * Parsed clinical fields from IPC blob map (inverse of appStateFieldsToBlobs).
 * @param {Record<string, string>} blobs
 */
export function mapBlobsToAppState(blobs) {
  const b = blobs && typeof blobs === 'object' ? blobs : {};
  return {
    patients: parseBlobJson(b.patients, []),
    notes: parseBlobJson(b.notes, {}),
    indicaciones: parseBlobJson(b.indicaciones, {}),
    labHistory: parseBlobJson(b.labHistory, {}),
    medRecetaByPatient: parseBlobJson(b.medRecetaByPatient, {}),
    listadoProblemas: parseBlobJson(b.listadoProblemas, {}),
    recetaHuByPatient: parseBlobJson(b.recetaHuByPatient, {}),
    vpoByPatient: parseBlobJson(b.vpoByPatient, {}),
    medPharmProfileByPatient: parseBlobJson(b.medPharmProfileByPatient, {}),
    medCatalog: parseBlobJson(b.medCatalog, null),
    todos: parseBlobJson(b.todos, {}),
    scheduledProcedures: parseBlobJson(b.scheduledProcedures, []),
    lanRoomSnapshots: parseBlobJson(b.lanRoomSnapshots, {}),
    lanHostPatientMap: parseBlobJson(b.lanHostPatientMap, {}),
  };
}

/**
 * @param {Record<string, unknown>} fields — filtered clinical payloads (objects/arrays)
 * @returns {Record<string, string>}
 */
export function appStateFieldsToBlobs(fields) {
  const blobs = {};
  if (!fields || typeof fields !== 'object') return blobs;
  for (const [field, blobKey] of Object.entries(APP_FIELD_TO_BLOB)) {
    if (fields[field] === undefined) continue;
    blobs[blobKey] = JSON.stringify(fields[field]);
  }
  return blobs;
}

/**
 * @param {Record<string, unknown>} fields
 * @param {{ eventType?: string, meta?: Record<string, unknown> }} [auditMeta]
 */
export async function persistSaveAll(fields, auditMeta) {
  const blobs = appStateFieldsToBlobs(fields);
  const payload = {
    blobs,
    auditMeta: auditMeta && typeof auditMeta === 'object' ? auditMeta : {},
  };
  if (!payload.auditMeta.eventType) {
    payload.auditMeta.eventType = 'clinical.save_all';
  }
  const userId = resolveClinicalSessionUserId();
  if (userId) payload.userId = userId;
  const res = await window.electronAPI.dbClinicalSaveAll(payload);
  if (res?.ok !== false && userId) {
    const { touchClinicalSessionActivity } = await import('./clinical-access-runtime.mjs');
    touchClinicalSessionActivity({ force: true });
  }
  return res;
}
