'use strict';

const equiposClients = new Set();

function broadcastEquipos(obj) {
  const payload = JSON.stringify(obj);
  for (const ws of equiposClients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

function addEquiposClient(ws) {
  equiposClients.add(ws);
}

function removeEquiposClient(ws) {
  equiposClients.delete(ws);
}

module.exports = { broadcastEquipos, addEquiposClient, removeEquiposClient };
