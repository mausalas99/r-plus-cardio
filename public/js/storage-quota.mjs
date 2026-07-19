/** Estimación de uso de localStorage y presión de cuota para R+. */

export const STORAGE_WARN_RATIO = 0.82;
export const STORAGE_BLOCK_RATIO = 0.97;
export const FALLBACK_LOCAL_STORAGE_QUOTA = 5 * 1024 * 1024;

export function estimateJsonBytes(value) {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

/**
 * @param {{
 *   patients?: unknown,
 *   notes?: unknown,
 *   indicaciones?: unknown,
 *   labHistory?: unknown,
 *   medRecetaByPatient?: unknown,
 *   medPharmProfileByPatient?: unknown,
 *   listadoProblemas?: unknown,
 *   recetaHuByPatient?: unknown,
 *   vpoByPatient?: unknown,
 * }} data
 */
export function estimateRpcPersistBytes(data) {
  var d = data || {};
  return (
    estimateJsonBytes(d.patients) +
    estimateJsonBytes(d.notes) +
    estimateJsonBytes(d.indicaciones) +
    estimateJsonBytes(d.labHistory) +
    estimateJsonBytes(d.medRecetaByPatient) +
    estimateJsonBytes(d.medPharmProfileByPatient) +
    estimateJsonBytes(d.listadoProblemas) +
    estimateJsonBytes(d.recetaHuByPatient) +
    estimateJsonBytes(d.vpoByPatient)
  );
}

/**
 * @returns {Promise<{ usage: number|null, quota: number }>}
 */
export async function readStorageQuotaEstimate() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      var est = await navigator.storage.estimate();
      var quota = est.quota;
      if (typeof quota === 'number' && quota > 0) {
        return {
          usage: typeof est.usage === 'number' ? est.usage : null,
          quota: quota,
        };
      }
    }
  } catch (_e) { void _e; }
  return { usage: null, quota: FALLBACK_LOCAL_STORAGE_QUOTA };
}

/**
 * @param {number} pendingBytes
 * @param {{ usage?: number|null, quota?: number }} [quotaInfo]
 * @returns {'ok'|'warn'|'block'}
 */
export function assessStoragePressure(pendingBytes, quotaInfo) {
  var quota =
    quotaInfo && typeof quotaInfo.quota === 'number' && quotaInfo.quota > 0
      ? quotaInfo.quota
      : FALLBACK_LOCAL_STORAGE_QUOTA;
  var usage =
    quotaInfo && typeof quotaInfo.usage === 'number' && quotaInfo.usage >= 0
      ? quotaInfo.usage
      : null;
  var projected = (usage != null ? usage : 0) + Math.max(0, pendingBytes || 0);
  if (projected >= quota * STORAGE_BLOCK_RATIO) return 'block';
  if (projected >= quota * STORAGE_WARN_RATIO) return 'warn';
  return 'ok';
}

export function isQuotaExceededError(err) {
  if (!err) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.code === 22 ||
    err.code === 1014 ||
    /quota/i.test(String(err.message || ''))
  );
}
