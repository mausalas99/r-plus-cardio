'use strict';

const express = require('express');
const { createDeltaResolver } = require('./delta-resolver.js');
const { createCommandResolver } = require('./command-resolver.js');
const { createSyncScheduler } = require('./sync-scheduler.js');
const { createBroadcastHelpers, startHeartbeat } = require('./host-router-utils.js');
const { mountCoreRoutes } = require('./host-router-core.js');
const { mountPatientRoutes } = require('./host-router-patients.js');
const { mountRoomRoutes } = require('./host-router-rooms.js');
const { mountHistoriaRoutes } = require('./host-router-historia.js');
const { mountMutationRoutes } = require('./host-router-mutations.js');

function createLanRouter(config) {
  const store = config.store;
  const broadcast = config.broadcast;
  const resolver = config.resolver;
  const getHostClinicalMeta = config.getHostClinicalMeta;
  const getHealthExtras = config.getHealthExtras;
  const sseBroadcast = config.sseBroadcast;
  const onClinicalOpsMerged = config.onClinicalOpsMerged;
  const clientIdentityStore = config.clientIdentityStore != null ? config.clientIdentityStore : null;
  const r = express.Router();
  const getState = () => store.getState();
  const deltaResolver = createDeltaResolver(store);
  const commandResolver = createCommandResolver(store);
  const syncScheduler = createSyncScheduler({ hostStore: store });
  const { broadcastAll, broadcastLiveRevision } = createBroadcastHelpers({ broadcast, sseBroadcast });

  const ctx = {
    store,
    broadcast,
    resolver,
    getState,
    getHostClinicalMeta,
    getHealthExtras,
    clientIdentityStore,
    deltaResolver,
    commandResolver,
    syncScheduler,
    broadcastLiveRevision,
    onClinicalOpsMerged,
  };

  mountCoreRoutes(r, ctx);
  mountPatientRoutes(r, ctx);
  mountRoomRoutes(r, ctx);
  mountHistoriaRoutes(r, ctx);
  mountMutationRoutes(r, ctx);

  startHeartbeat(broadcastAll, getHostClinicalMeta, getHealthExtras);

  return r;
}

module.exports = { createLanRouter };
