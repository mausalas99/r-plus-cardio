'use strict';

const express = require('express');

function mountRoomDeltaCommandRoutes(
  r,
  { store, broadcast, deltaResolver, commandResolver, syncScheduler, broadcastLiveRevision }
) {
  r.post('/rooms/:id/delta', express.json({ limit: '1mb' }), (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const out = deltaResolver.applyDelta({
      ...body,
      roomId: req.params.id,
    });
    if (out.status === 'invalid_delta') return res.status(400).json(out);
    if (out.status === 'stale_delta') return res.status(409).json(out);
    broadcast(`live:${encodeURIComponent(req.params.id)}`, {
      type: 'livesync:delta:applied',
      ...out,
    });
    broadcastLiveRevision(req.params.id, store.getRoomSyncBundle(req.params.id)?.revision, body.clientId);
    res.json(out);
  });

  r.get('/rooms/:id/deltas', (req, res) => {
    const afterSeq = Number(req.query.afterSeq || 0);
    const out = store.getRoomDeltaLog(req.params.id, afterSeq);
    if (!out.ok) {
      return res.status(409).json({
        error: out.error,
        fallback: 'sync_bundle',
      });
    }
    res.json(out);
  });

  r.post('/rooms/:id/commands', express.json({ limit: '1mb' }), (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const out = commandResolver.applyCommand({
      ...body,
      roomId: req.params.id,
    });
    if (out.code === 'STALE_BASE_SEQ_REQUIRES_SNAPSHOT') return res.status(409).json(out);
    if (!out.ok) return res.status(400).json(out);
    if (out.status === 'accepted') {
      syncScheduler.scheduleMaterialize(req.params.id, { reason: 'command' });
      broadcast(`live:${encodeURIComponent(req.params.id)}`, {
        type: 'livesync:command:applied',
        ...out,
      });
      broadcastLiveRevision(req.params.id, out.revision, body.clientId);
    }
    res.json(out);
  });

  r.post('/rooms/:id/flush', express.json({ limit: '32kb' }), async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const reason = String(body.reason || 'sync-now').slice(0, 64);
    const clientId = String(body.clientId || 'host').slice(0, 128);
    const out = await syncScheduler.flush(req.params.id, { reason, clientId });
    res.json(out);
  });
}

function mountRoomClinicalOpsRoutes(r, { store, broadcastLiveRevision, onClinicalOpsMerged }) {
  r.get('/rooms/:id/clinical-ops', (req, res) => {
    const bundle = store.getRoomSyncBundle(req.params.id);
    if (!bundle) return res.status(404).json({ error: 'no bundle' });
    const snapshot =
      bundle.clinicalOps && typeof bundle.clinicalOps === 'object' ? bundle.clinicalOps : null;
    res.json({ snapshot, revision: Number(bundle.revision || 0) });
  });

  r.put('/rooms/:id/clinical-ops', express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const out = await store.putRoomClinicalOps(req.params.id, body);
      broadcastLiveRevision(
        req.params.id,
        out && out.revision,
        body.clientId || body.uploadedByClientId
      );
      if (typeof onClinicalOpsMerged === 'function') {
        try {
          onClinicalOpsMerged(req.params.id, out);
        } catch (e) {
          console.error('[lan-clinical-ops]', e && e.message ? e.message : e);
        }
      }
      res.json(out);
    } catch (e) {
      if (e.code === 'CONFLICT') {
        return res.status(409).json({
          error: 'conflict',
          snapshot: e.serverSnapshot,
          revision: e.revision,
          conflicts: e.conflicts || [],
        });
      }
      res.status(400).json({ error: e.message });
    }
  });
}

function mountRoomLiveSyncRoutes(r, ctx) {
  mountRoomDeltaCommandRoutes(r, ctx);
  mountRoomClinicalOpsRoutes(r, ctx);
}

module.exports = { mountRoomLiveSyncRoutes };
