'use strict';

const { mountPatientMutationRoutes } = require('./host-router-patient-mutations.js');
const { mountSyncBundleRoute } = require('./host-router-bundle.js');

function mountMutationRoutes(r, ctx) {
  mountPatientMutationRoutes(r, ctx);
  mountSyncBundleRoute(r, ctx);
}

module.exports = { mountMutationRoutes };
