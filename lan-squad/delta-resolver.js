'use strict';

const { validateDeltaPaths } = require('./delta-paths.js');
const {
  processValidatedPaths,
  buildStaleDeltaResult,
  buildFieldMetaForCommit,
  buildSuccessResult,
} = require('./delta-resolver-apply.js');

function createDeltaResolver(store, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const _nowIso = typeof opts.nowIso === 'function' ? opts.nowIso : () => new Date().toISOString();
  function applyDelta(delta) {
    const entityType = String(delta && delta.entityType ? delta.entityType : '');
    const validation = validateDeltaPaths(entityType, delta);
    if (!validation.ok) {
      return {
        ok: false,
        status: 'invalid_delta',
        error: validation.error,
        acceptedPaths: [],
        rejectedPaths: validation.rejectedPaths || [],
      };
    }

    const roomId = String(delta.roomId || '').trim();
    const entityId = String(delta.entityId || '').trim();
    const patientId = delta.patientId != null ? String(delta.patientId) : entityId;
    const clientId = String(delta.clientId || 'unknown');
    const txId = String(delta.txId || '');
    const existing =
      store.getEntity({ roomId, entityType, entityId, patientId }) ||
      { version: 0, data: {}, fieldMeta: {} };

    const { data, fieldMeta, acceptedPaths, rejectedPaths } = processValidatedPaths(
      delta,
      validation,
      existing,
      clientId
    );

    if (!acceptedPaths.length) {
      return buildStaleDeltaResult(entityType, entityId, patientId, rejectedPaths, fieldMeta);
    }

    const commit = store.commitDeltaEntity({
      roomId,
      entityType,
      entityId,
      patientId,
      data,
      fieldMeta,
      clientId,
      txId,
      acceptedPaths,
      buildFieldMeta({ deltaSeq, committedAt: hostCommittedAt, previousFieldMeta }) {
        return buildFieldMetaForCommit(
          delta,
          acceptedPaths,
          clientId,
          deltaSeq,
          hostCommittedAt,
          previousFieldMeta
        );
      },
    });

    const out = buildSuccessResult(delta, commit, acceptedPaths, rejectedPaths, fieldMeta);
    store.appendDeltaLog(roomId, out);
    if (roomId) store.materializeRoomViews(roomId);
    return out;
  }

  return { applyDelta };
}

module.exports = { createDeltaResolver };
