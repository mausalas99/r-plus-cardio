import { clinicalSessionContext } from '../clinical-session-context.mjs';

/** @type {import('../features/session-manager.mjs').BackgroundVitalsMonitorLoop|null} */
export let vitalsLoop = null;
/** @type {import('../features/session-manager.mjs').ClientSessionInactivityLocker|null} */
export let sessionLocker = null;

export function setVitalsLoop(loop) {
  vitalsLoop = loop;
}

export function setSessionLocker(locker) {
  sessionLocker = locker;
}

export let clinicalAccessBootDone = false;
/** @type {Array<() => void>} */
export let clinicalAccessBootWaiters = [];

export function setClinicalAccessBootDone(value) {
  clinicalAccessBootDone = value;
}

export function setClinicalAccessBootWaiters(waiters) {
  clinicalAccessBootWaiters = waiters;
}

export let lastClinicalActivityTouchAt = 0;
/** Throttle DB writes; clinical saves also touch via IPC save_all. */
export const CLINICAL_ACTIVITY_TOUCH_MIN_MS = 60 * 1000;
export let clinicalActivityLanPushTimer = null;

export function setLastClinicalActivityTouchAt(value) {
  lastClinicalActivityTouchAt = value;
}

export function setClinicalActivityLanPushTimer(timer) {
  clinicalActivityLanPushTimer = timer;
}

export let refreshClinicalPatientListForScopeInFlight = null;

export function setRefreshClinicalPatientListForScopeInFlight(value) {
  refreshClinicalPatientListForScopeInFlight = value;
}

export let clinicalOpsSyncedRefreshTimer = null;

export function setClinicalOpsSyncedRefreshTimer(timer) {
  clinicalOpsSyncedRefreshTimer = timer;
}

export function resetClinicalSessionContext() {
  clinicalSessionContext.user = null;
  clinicalSessionContext.guardias = [];
  clinicalSessionContext.guardiasMap = new Map();
  clinicalSessionContext.orphanGuardias = [];
  clinicalSessionContext.teams = [];
  clinicalSessionContext.scopeContext = null;
  clinicalSessionContext.decryptedPrivateKeyPem = null;
}
