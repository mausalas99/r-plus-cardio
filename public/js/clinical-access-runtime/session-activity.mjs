import { resolveClinicalSessionUserId } from '../clinical-session-context.mjs';
import {
  CLINICAL_ACTIVITY_TOUCH_MIN_MS,
  clinicalActivityLanPushTimer,
  lastClinicalActivityTouchAt,
  setClinicalActivityLanPushTimer,
  setLastClinicalActivityTouchAt,
} from './state.mjs';
import { electronApi } from './electron-api.mjs';

function scheduleClinicalActivityLanPush() {
  if (clinicalActivityLanPushTimer) return;
  setClinicalActivityLanPushTimer(
    setTimeout(() => {
      setClinicalActivityLanPushTimer(null);
      void import('../features/lan-sync.mjs')
        .then((mod) => {
          if (typeof mod.pushClinicalOpsLanNow === 'function') {
            return mod.pushClinicalOpsLanNow();
          }
        })
        .catch(() => {});
    }, 4000)
  );
}

/**
 * @param {string} [userId]
 * @param {{ force?: boolean }} [opts] — force skips throttle (clinical saves)
 */
export async function touchClinicalUserActivityRemote(userId, opts = {}) {
  const api = electronApi();
  const uid = String(userId || resolveClinicalSessionUserId() || '').trim();
  if (!api || !uid || typeof api.dbClinicalUserTouch !== 'function') return false;
  const now = Date.now();
  if (!opts.force && now - lastClinicalActivityTouchAt < CLINICAL_ACTIVITY_TOUCH_MIN_MS) {
    return false;
  }
  setLastClinicalActivityTouchAt(now);
  try {
    const res = await api.dbClinicalUserTouch({ userId: uid });
    if (res?.ok === false) return false;
    scheduleClinicalActivityLanPush();
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('rpc-clinical-user-activity-touched', { detail: { userId: uid } })
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Record session activity after clinical edits.
 * @param {{ force?: boolean }} [opts]
 */
export function touchClinicalSessionActivity(opts = {}) {
  const userId = resolveClinicalSessionUserId();
  if (!userId) return;
  void touchClinicalUserActivityRemote(userId, opts);
}
