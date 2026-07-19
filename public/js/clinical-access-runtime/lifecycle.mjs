import { patients } from '../app-state.mjs';
import { effectiveClinicalRank } from '../clinical-privileges.mjs';
import { userIsOnGuardiaCallToday } from '../clinico-access.mjs';
import { isGuardiaMode } from '../features/chrome.mjs';
import {
  BackgroundVitalsMonitorLoop,
  ClientSessionInactivityLocker,
} from '../features/session-manager.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { markClinicalAccessBootReady } from './boot-ready.mjs';
import { bootstrapClinicalAccess } from './bootstrap.mjs';
import { wireClinicalOpsSyncRefresh } from './census-lan-pull.mjs';
import { electronApi } from './electron-api.mjs';
import { renderGuardiaCensusGrid, syncGuardiaCensusPanelVisibility } from './guardia-grid.mjs';
import {
  resetClinicalSessionContext,
  sessionLocker,
  setSessionLocker,
  setVitalsLoop,
  vitalsLoop,
} from './state.mjs';
import { unlockClinicalSessionOverlay } from './session-user.mjs';

export async function initClinicalAccessRuntime(settings, clientId) {
  const ok = await bootstrapClinicalAccess(settings, clientId);
  markClinicalAccessBootReady();
  if (!ok) return;
  wireClinicalOpsSyncRefresh();

  if (vitalsLoop) vitalsLoop.stop();
  const nextVitalsLoop = new BackgroundVitalsMonitorLoop(
    {
      all: async (sql, params) => {
        void sql;
        void params;
        const api = electronApi();
        if (!api || typeof api.dbGuardiaCensus !== 'function') return [];
        const census = await api.dbGuardiaCensus({ userId: clinicalSessionContext.user?.user_id });
        if (!census || census.ok === false) return [];
        return Array.isArray(census.guardias) ? census.guardias : [];
      },
    },
    String(clinicalSessionContext.user?.user_id || clientId),
    {
      shouldMonitorVitals: () => {
        const uid = String(clinicalSessionContext.user?.user_id || '');
        if (!uid) return false;
        const rank = effectiveClinicalRank(clinicalSessionContext.user);
        const teams = clinicalSessionContext.teams || [];
        const salaGuardiaToday =
          clinicalSessionContext.salaGuardiaToday ||
          clinicalSessionContext.scopeContext?.salaGuardiaToday ||
          [];
        return userIsOnGuardiaCallToday(uid, rank, teams, new Date(), salaGuardiaToday);
      },
      resolvePatientLabel: (patientId) => {
        const p = patients.find((row) => String(row.id) === String(patientId));
        if (!p) return '';
        const name = String(p.nombre || '').trim();
        const bed = [p.cuarto, p.cama].filter(Boolean).join('-');
        if (name && bed) return `${name} (${bed})`;
        return name || bed || '';
      },
    }
  );
  setVitalsLoop(nextVitalsLoop);
  nextVitalsLoop.start();

  if (sessionLocker) sessionLocker.stop();
  const nextSessionLocker = new ClientSessionInactivityLocker(10, 'rpc-clinical-session-lock');
  setSessionLocker(nextSessionLocker);
  nextSessionLocker.start(clinicalSessionContext);

  syncGuardiaCensusPanelVisibility(settings);
  if (isGuardiaMode()) renderGuardiaCensusGrid(settings);
}

export function stopClinicalAccessRuntime() {
  if (vitalsLoop) {
    vitalsLoop.stop();
    setVitalsLoop(null);
  }
  if (sessionLocker) {
    sessionLocker.stop();
    setSessionLocker(null);
  }
  resetClinicalSessionContext();
}

/** @param {Record<string, unknown>|null|undefined} settings @param {string} clientId */
export async function resumeClinicalSession(settings, clientId) {
  await bootstrapClinicalAccess(settings, clientId);
  unlockClinicalSessionOverlay();
  if (sessionLocker) {
    sessionLocker.stop();
    const nextSessionLocker = new ClientSessionInactivityLocker(10, 'rpc-clinical-session-lock');
    setSessionLocker(nextSessionLocker);
    nextSessionLocker.start(clinicalSessionContext);
  }
}
