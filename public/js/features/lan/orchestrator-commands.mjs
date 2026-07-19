/** LAN command builders and save hooks (IM-11). */
import { activeLiveSyncRoomId } from './runtime.mjs';
import { buildLanCommand } from '../../lan-command-client.mjs';
import { flushEaEstadoClinicoFieldsFromDom } from '../estado-actual-panel.mjs';
import { setSaveStateHooks } from '../../app-state.mjs';
import { touchPatientLanUpdatedAt } from './patient-entries.mjs';
import { getLanRuntime } from './orchestrator-runtime.mjs';

export function buildEstadoActualCommand(opts) {
  return buildLanCommand({
    ...opts,
    domain: 'estadoActual',
    op: 'updateField',
    entityId: `${opts.patientId}:estadoActual`,
    payload: { path: opts.path, value: opts.value },
  });
}

export function buildEventualidadAddCommand(opts) {
  return buildLanCommand({
    ...opts,
    domain: 'eventualidades',
    op: 'add',
    entityId: `${opts.patientId}:eventualidades`,
    payload: {
      eventualidadId: opts.eventualidadId,
      at: opts.at,
      text: opts.text,
    },
  });
}

export function buildPendienteCommand(opts) {
  const op = String(opts.op || '').trim();
  return buildLanCommand({
    ...opts,
    domain: 'pendientes',
    op,
    entityId: `${opts.patientId}:pendientes`,
    payload: {
      itemId: opts.itemId,
      text: opts.text,
      completed: op === 'complete' ? true : opts.completed,
    },
  });
}

export function registerLanSaveHooks(deps) {
  var post =
    deps && typeof deps.scheduleLabHistoryPostSaveMaintenance === 'function'
      ? deps.scheduleLabHistoryPostSaveMaintenance
      : function () {};
  var runtime = getLanRuntime();
  setSaveStateHooks({
    before() {
      flushEaEstadoClinicoFieldsFromDom();
      var aid = runtime.getActiveId();
      if (activeLiveSyncRoomId && aid) touchPatientLanUpdatedAt(aid);
    },
    after() {
      post();
      void import('../../clinical-access-runtime.mjs').then((mod) => {
        if (typeof mod.touchClinicalSessionActivity === 'function') {
          mod.touchClinicalSessionActivity({ force: true });
        }
      });
    },
  });
}
