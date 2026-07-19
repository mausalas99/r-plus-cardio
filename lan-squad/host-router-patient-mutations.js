'use strict';

const express = require('express');

function mountLabHistoryRoute(r, { store, broadcastLiveRevision }) {
  r.post('/patients/:id/lab-history/upsert-set', express.json({ limit: '512kb' }), async (req, res) => {
    try {
      const { set, clientId, clientTimestamp } = req.body || {};
      if (!set || !set.id) return res.status(400).json({ error: 'set.id required' });
      const result = store.upsertPatientLabHistorySet(
        req.params.id,
        set,
        Number(clientTimestamp || 0),
        clientId
      );
      if (!result.ok) return res.status(404).json({ error: result.error });
      await store.awaitDurableCommit();
      broadcastLiveRevision(result.roomId || req.params.id, result.revision, clientId || 'host');
      res.json({
        ok: true,
        setId: set.id,
        revision: result.revision,
        deltaSeq: result.deltaSeq,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/patients/:id/lab-history/delete-set', express.json({ limit: '32kb' }), async (req, res) => {
    try {
      const { setId, clientId, clientTimestamp } = req.body || {};
      if (!setId) return res.status(400).json({ error: 'setId required' });
      const result = store.deletePatientLabHistorySet(
        req.params.id,
        setId,
        Number(clientTimestamp || 0),
        clientId
      );
      if (!result.ok) return res.status(404).json({ error: result.error });
      await store.awaitDurableCommit();
      broadcastLiveRevision(result.roomId || req.params.id, result.revision, clientId || 'host');
      res.json({
        ok: true,
        setId,
        revision: result.revision,
        deltaSeq: result.deltaSeq,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}

function mountNotaIndicacionesRoutes(r, { store, broadcastLiveRevision }) {
  r.put('/patients/:id/nota', express.json({ limit: '256kb' }), async (req, res) => {
    try {
      const { data, expectedVersion, clientId, clientTimestamp } = req.body || {};
      if (data == null) return res.status(400).json({ error: 'data required' });
      const result = store.replacePatientNota(
        req.params.id,
        data,
        Number(expectedVersion ?? 0),
        Number(clientTimestamp || 0)
      );
      if (!result.ok) return res.status(404).json({ error: result.error });
      await store.awaitDurableCommit();
      broadcastLiveRevision(result.roomId || req.params.id, result.revision ?? 0, clientId || 'host');
      res.json({
        ok: true,
        version: result.version,
        data: result.data,
        ...(result.lwwApplied ? { lwwApplied: true } : {}),
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.put('/patients/:id/indicaciones', express.json({ limit: '256kb' }), async (req, res) => {
    try {
      const { data, expectedVersion, clientId, clientTimestamp } = req.body || {};
      if (data == null) return res.status(400).json({ error: 'data required' });
      const result = store.replacePatientIndicaciones(
        req.params.id,
        data,
        Number(expectedVersion ?? 0),
        Number(clientTimestamp || 0)
      );
      if (!result.ok) return res.status(404).json({ error: result.error });
      await store.awaitDurableCommit();
      broadcastLiveRevision(result.roomId || req.params.id, result.revision ?? 0, clientId || 'host');
      res.json({
        ok: true,
        version: result.version,
        data: result.data,
        ...(result.lwwApplied ? { lwwApplied: true } : {}),
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}

function mountPatientFieldsRoute(r, { store, resolver, broadcastLiveRevision }) {
  r.put('/patients/:id/fields', express.json({ limit: '128kb' }), async (req, res) => {
    try {
      const { changedKeys, data, expectedVersion, clientId } = req.body || {};
      if (!Array.isArray(changedKeys) || !data) {
        return res.status(400).json({ error: 'changedKeys and data required' });
      }
      const result = resolver.applyMutation({
        entityType: 'patient',
        entityId: req.params.id,
        expectedVersion: Number(expectedVersion ?? 0),
        changedKeys,
        data: { ...data, id: req.params.id },
        clientId: String(clientId || ''),
      });
      if (!result.ok) return res.status(409).json({ error: 'conflict', version: result.version });
      await store.awaitDurableCommit();
      const roomId =
        (typeof store.findRoomForPatient === 'function' && store.findRoomForPatient(req.params.id)) ||
        req.params.id;
      broadcastLiveRevision(roomId, result.version ?? 0, clientId || 'host');
      res.json({ ok: true, version: result.version });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}

function mountPatientMutationRoutes(r, ctx) {
  mountLabHistoryRoute(r, ctx);
  mountNotaIndicacionesRoutes(r, ctx);
  mountPatientFieldsRoute(r, ctx);
}

module.exports = { mountPatientMutationRoutes };
