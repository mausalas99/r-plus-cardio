'use strict';

const fs = require('node:fs');
const { isShardedLayout, initEmptyShardedStateSync } = require('../persistence/sharded-host-persistence.js');
const { createLabSidecarRuntime } = require('./lab-sidecar-runtime.js');
const { createPersistenceRuntime } = require('./persistence-runtime.js');
const { createRoomsPatientsHandlers } = require('./rooms-patients.js');
const { createBundleHandlers } = require('./bundles.js');
const { createPatientFieldHandlers } = require('./patient-fields.js');
const { createEntityHandlers } = require('./entities.js');
const { createDeltaCommandHandlers } = require('./delta-commands.js');
const { createHistoriaAuditHandlers } = require('./historia-audit.js');
const { createHostStoreContext, buildHostStoreApi } = require('./create-factory-helpers.js');

function createHostStore(config) {
  const ctx = createHostStoreContext(config);
  const labHandlers = createLabSidecarRuntime(ctx);
  Object.assign(ctx, labHandlers);

  const persistence = createPersistenceRuntime(ctx);
  Object.assign(ctx, persistence);

  const handlers = {
    persistence,
    roomsPatients: createRoomsPatientsHandlers(ctx),
    bundles: createBundleHandlers(ctx),
    patientFields: createPatientFieldHandlers(ctx),
    entities: createEntityHandlers(ctx),
    deltaCommands: createDeltaCommandHandlers(ctx),
    historiaAudit: createHistoriaAuditHandlers(ctx),
  };
  Object.assign(ctx, handlers.bundles);

  if (!config.dbManager && !isShardedLayout(ctx.stateDir) && !fs.existsSync(config.filePath)) {
    initEmptyShardedStateSync(ctx.stateDir, ctx.teamCodeHash);
  }

  return buildHostStoreApi(ctx, handlers);
}

module.exports = { createHostStore };
