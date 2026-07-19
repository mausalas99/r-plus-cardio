'use strict';

const express = require('express');

function mountRoomCrudRoutes(r, { store, broadcast }) {
  r.get('/rooms', (_req, res) => {
    res.json({ rooms: store.listRooms() });
  });

  r.post('/rooms', express.json(), (req, res) => {
    const row = store.createRoom(req.body && req.body.displayName);
    broadcast('rooms', { type: 'rooms-changed' });
    res.status(201).json({ room: row });
  });

  r.patch('/rooms/:id', express.json(), (req, res) => {
    const row = store.renameRoom(req.params.id, req.body && req.body.displayName);
    broadcast('rooms', { type: 'rooms-changed' });
    res.json({ room: row });
  });

  r.delete('/rooms/:id', (req, res) => {
    store.deleteRoom(req.params.id);
    broadcast('rooms', { type: 'rooms-changed' });
    res.json({ ok: true });
  });

  r.get('/rooms/:id/sync-bundle', (req, res) => {
    const bundle =
      typeof store.getRoomSyncBundleForApi === 'function'
        ? store.getRoomSyncBundleForApi(req.params.id)
        : store.getRoomSyncBundle(req.params.id);
    if (!bundle) return res.status(404).json({ error: 'no bundle' });
    res.json({ bundle });
  });
}

module.exports = { mountRoomCrudRoutes };
