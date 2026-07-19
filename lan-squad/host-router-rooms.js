'use strict';

const { mountRoomCrudRoutes } = require('./host-router-rooms-crud.js');
const { mountRoomLiveSyncRoutes } = require('./host-router-rooms-livesync.js');

function mountRoomRoutes(r, ctx) {
  mountRoomCrudRoutes(r, ctx);
  mountRoomLiveSyncRoutes(r, ctx);
}

module.exports = { mountRoomRoutes };
