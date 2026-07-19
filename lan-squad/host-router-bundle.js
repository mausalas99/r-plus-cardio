'use strict';

const express = require('express');

async function refreshBundleClinicalOps(store, roomId, out) {
  if (
    !out ||
    !out.bundle ||
    !out.bundle.clinicalOps ||
    typeof store.persistRoomBundleClinicalOpsToHostDb !== 'function'
  ) {
    return out;
  }
  await store.persistRoomBundleClinicalOpsToHostDb(roomId);
  const refreshed =
    typeof store.getRoomClinicalOpsForApi === 'function'
      ? store.getRoomClinicalOpsForApi(roomId)
      : null;
  if (!refreshed) return out;
  return {
    ...out,
    bundle: {
      ...out.bundle,
      clinicalOps: refreshed.clinicalOps,
      entityVersions: refreshed.entityVersions,
      revision: refreshed.revision,
    },
  };
}

function mountSyncBundleRoute(r, { store, broadcastLiveRevision }) {
  r.put('/rooms/:id/sync-bundle', express.json({ limit: '16mb' }), async (req, res) => {
    try {
      const body = req.body && req.body.bundle ? req.body.bundle : req.body;
      let out = store.putRoomSyncBundle(req.params.id, body);
      out = await refreshBundleClinicalOps(store, req.params.id, out);
      if (out && out.bundle) {
        broadcastLiveRevision(
          req.params.id,
          out.bundle.revision,
          body.uploadedByClientId || body.clientId
        );
      }
      const payload = { bundle: out.bundle, merged: true };
      if (Array.isArray(out.lwwAppliedKeys) && out.lwwAppliedKeys.length) {
        payload.lwwAppliedKeys = out.lwwAppliedKeys;
      }
      res.json(payload);
    } catch (e) {
      if (e.code === 'CONFLICT') {
        return res.status(409).json({
          error: 'conflict',
          bundle: e.serverBundle,
          conflicts: e.conflicts || [],
        });
      }
      res.status(400).json({ error: e.message });
    }
  });
}

module.exports = { mountSyncBundleRoute, refreshBundleClinicalOps };
