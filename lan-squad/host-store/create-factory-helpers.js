'use strict';

const path = require('node:path');
const { hashTeamCode } = require('../team-code.js');
const { createWriteQueue } = require('../write-queue.js');
const { createCommitBarrier } = require('../persistence/commit-barrier.js');
const { createHostStateCache } = require('../host-state-cache.js');

function createHostStoreContext({ filePath, hostStateDir, teamCodePlain, dbManager, getClientId }) {
  const teamCodeHash = hashTeamCode(teamCodePlain);
  const stateDir = hostStateDir || path.join(path.dirname(filePath), 'lan-host');
  const cache = createHostStateCache();
  const queue = createWriteQueue();
  let lastPersistError = null;
  function reportPersistFailure(tag, err) {
    lastPersistError = { tag, message: err && err.message, at: new Date().toISOString() };
    console.error(`[lan-host-store] persist failed (${tag}):`, err && err.message);
  }
  const commitBarrier = createCommitBarrier({
    coalesceMs: 150,
    onError: (e) => reportPersistFailure('commit-barrier', e),
  });
  let lastCommitAudit = null;
  let initPromise = null;
  let dirtyMeta = false;
  const dirtyRooms = new Set();
  const dirtyLabSidecars = new Set();
  const labSidecarCache = new Map();
  let repairedRoomCount = 0;

  return {
    filePath,
    stateDir,
    teamCodeHash,
    dbManager,
    getClientId: typeof getClientId === 'function' ? getClientId : () => '',
    cache,
    queue,
    commitBarrier,
    reportPersistFailure,
    get lastPersistError() {
      return lastPersistError;
    },
    get lastCommitAudit() {
      return lastCommitAudit;
    },
    set lastCommitAudit(v) {
      lastCommitAudit = v;
    },
    get initPromise() {
      return initPromise;
    },
    set initPromise(v) {
      initPromise = v;
    },
    get dirtyMeta() {
      return dirtyMeta;
    },
    set dirtyMeta(v) {
      dirtyMeta = v;
    },
    dirtyRooms,
    dirtyLabSidecars,
    labSidecarCache,
    get repairedRoomCount() {
      return repairedRoomCount;
    },
    set repairedRoomCount(v) {
      repairedRoomCount = v;
    },
  };
}

function buildHostStoreApi(ctx, handlers) {
  const { persistence, roomsPatients, bundles, patientFields, entities, deltaCommands, historiaAudit } =
    handlers;
  return {
    ready: persistence.ready,
    flush: persistence.flush,
    flushCacheNow: persistence.flushCacheNow,
    awaitDurableCommit: persistence.awaitDurableCommit,
    getLastCommitAudit: persistence.getLastCommitAudit,
    getLastPersistError: persistence.getLastPersistError,
    getRepairedRoomCount: persistence.getRepairedRoomCount,
    getHostStateDir: () => ctx.stateDir,
    getState: persistence.getState,
    ...roomsPatients,
    getRoomSyncBundle: bundles.getRoomSyncBundle,
    getRoomSyncBundleForApi: bundles.getRoomSyncBundleForApi,
    getRoomClinicalOpsForApi: bundles.getRoomClinicalOpsForApi,
    putRoomSyncBundle: bundles.putRoomSyncBundle,
    ...patientFields,
    findRoomForPatient: (patientId) =>
      bundles.findRoomForPatient(persistence.ensureLoadedSync(), patientId),
    persistRoomBundleClinicalOpsToHostDb: bundles.persistRoomBundleClinicalOpsToHostDb,
    putRoomClinicalOps: bundles.putRoomClinicalOps,
    getEntity: entities.getEntity,
    setEntity: entities.setEntity,
    ensureDeltaEntity: deltaCommands.ensureDeltaEntity,
    commitDeltaEntity: deltaCommands.commitDeltaEntity,
    appendDeltaLog: deltaCommands.appendDeltaLog,
    getRoomDeltaLog: deltaCommands.getRoomDeltaLog,
    ensureRoomBundleForTest: bundles.ensureRoomBundleForTest,
    getAppliedCommand: deltaCommands.getAppliedCommand,
    getCommandEntityState: deltaCommands.getCommandEntityState,
    commitCommandEntity: deltaCommands.commitCommandEntity,
    materializeRoomViews: entities.materializeRoomViews,
    archiveHistoriaClinicaForPatient: historiaAudit.archiveHistoriaClinicaForPatient,
    purgePatientFromHostCensus: entities.purgePatientFromHostCensus,
    appendRoomBundleAudit: historiaAudit.appendRoomBundleAudit,
    appendRoomBundleAuditInMemory: historiaAudit.appendRoomBundleAuditInMemory,
    putHistoriaClinicaQueued: historiaAudit.putHistoriaClinicaQueued,
  };
}

module.exports = { createHostStoreContext, buildHostStoreApi };
