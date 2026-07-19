// storage-core.mjs — blob cache + clinical blob reads
import { readStorageQuotaEstimate, isQuotaExceededError } from '../storage-quota.mjs';
import { isDbMode, persistSaveAll } from '../db-storage-bridge.mjs';
import { isSessionScopedWebClient } from '../session-clinical-wipe.mjs';

/** @type {Record<string, string> | null} blob_key → JSON string when SQLCipher desktop mode */
let _blobCache = null;
export function getBlobCache() { return _blobCache; }
export function setBlobCache(v) { _blobCache = v; }

/** @type {Map<string, { raw: string | null, parsed: unknown }>} blobKey → parsed value keyed by last raw JSON (invalidate on write/hydrate). Callers must not mutate returned blobs in place; treat reads as immutable. */
var _parsedCache = new Map();
function invalidateParsed(blobKey) {
  if (blobKey == null) _parsedCache.clear();
  else _parsedCache.delete(blobKey);
}

let _cachedQuotaEstimate = null;
let _quotaEstimateTs = 0;
const QUOTA_CACHE_MS = 15000;

async function getCachedQuotaEstimate() {
  var now = Date.now();
  if (_cachedQuotaEstimate && now - _quotaEstimateTs < QUOTA_CACHE_MS) {
    return _cachedQuotaEstimate;
  }
  _cachedQuotaEstimate = await readStorageQuotaEstimate();
  _quotaEstimateTs = now;
  return _cachedQuotaEstimate;
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) return false;
    throw err;
  }
}

/** iPad/PWA: ward census lives in memory; persisting clinical blobs fills Safari localStorage. */
function skipClinicalLocalPersist() {
  return isSessionScopedWebClient();
}

function safeParse(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    var parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function safeParseArray(raw) {
  var parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function safeParseObject(raw) {
  var parsed = safeParse(raw, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function blobCacheRaw(blobKey) {
  if (!_blobCache) return undefined;
  var raw = _blobCache[blobKey];
  if (raw == null) return null;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

const WEB_SESSION_EMPTY_CLINICAL_BLOBS = new Set([
  'patients',
  'notes',
  'indicaciones',
  'labHistory',
  'medRecetaByPatient',
  'listadoProblemas',
  'recetaHuByPatient',
  'vpoByPatient',
  'medPharmProfileByPatient',
  'lanRoomSnapshots',
  'lanHostPatientMap',
]);

function readClinicalBlob(blobKey, lsKey, parseFromRaw) {
  if (skipClinicalLocalPersist() && WEB_SESSION_EMPTY_CLINICAL_BLOBS.has(blobKey)) {
    return blobKey === 'patients' ? [] : parseFromRaw('{}');
  }
  var raw;
  if (_blobCache) {
    raw = blobCacheRaw(blobKey);
  } else {
    raw = localStorage.getItem(lsKey);
  }
  var cached = _parsedCache.get(blobKey);
  if (cached && cached.raw === raw) {
    return cached.parsed;
  }
  var parsed = parseFromRaw(raw);
  _parsedCache.set(blobKey, { raw: raw, parsed: parsed });
  return parsed;
}

function readTodosMap() {
  return readClinicalBlob('todos', 'rpc-todos', safeParseObject);
}

/** @param {Record<string, unknown>} map */
function writeTodosMap(map) {
  if (skipClinicalLocalPersist()) return;
  const json = JSON.stringify(map);
  if (_blobCache) {
    _blobCache.todos = json;
    if (isDbMode()) {
      void persistSaveAll(
        { todos: map },
        { eventType: 'clinical.todos_save', meta: { source: 'storage.saveTodos' } }
      );
      invalidateParsed('todos');
      return;
    }
  }
  localStorage.setItem('rpc-todos', json);
  invalidateParsed('todos');
}
export {
  invalidateParsed,
  skipClinicalLocalPersist,
  safeParse,
  safeParseArray,
  safeParseObject,
  readClinicalBlob,
  readTodosMap,
  writeTodosMap,
  safeLocalStorageSet,
  getCachedQuotaEstimate,
};
