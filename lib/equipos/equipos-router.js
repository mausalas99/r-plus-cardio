'use strict';

const express = require('express');
const { broadcastEquipos } = require('./equipos-router-broadcast.js');
const { attachEquiposWs } = require('./equipos-router-ws.js');
const { createEquiposRouterContext } = require('./equipos-router-core.js');
const { mountEquiposRoutes } = require('./equipos-router-routes.js');

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   photosDir: string,
 *   httpServer?: import('http').Server,
 * }} deps
 */
function createEquiposRouter(deps) {
  const r = express.Router();
  const { authEquipos, savePhotoFromBase64, handleEquiposErr } = createEquiposRouterContext(deps);
  mountEquiposRoutes(r, {
    getDb: deps.getDb,
    authEquipos,
    savePhotoFromBase64,
    handleEquiposErr,
    photosDir: deps.photosDir,
  });
  if (deps.httpServer) {
    attachEquiposWs(deps.httpServer, deps.getDb);
  }
  return r;
}

module.exports = { createEquiposRouter, broadcastEquipos };
