'use strict';

const { applyPathValue } = require('./delta-paths.js');
const { timestampFor, shouldAcceptPath, buildRejectedMeta, clone } = require('./delta-resolver-helpers.js');

function processValidatedPaths(delta, validation, existing, clientId) {
  const data = clone(existing.data || {});
  const fieldMeta = clone(existing.fieldMeta || {});
  const acceptedPaths = [];
  const rejectedPaths = [];

  for (const path of validation.paths) {
    const incomingTs = timestampFor(delta, path);
    if (!shouldAcceptPath(fieldMeta[path], incomingTs, clientId)) {
      rejectedPaths.push(path);
      continue;
    }
    applyPathValue(data, path, delta.pathValues[path]);
    acceptedPaths.push(path);
  }

  return { data, fieldMeta, acceptedPaths, rejectedPaths };
}

function buildStaleDeltaResult(entityType, entityId, patientId, rejectedPaths, fieldMeta) {
  return {
    ok: false,
    status: 'stale_delta',
    entityType,
    entityId,
    patientId,
    acceptedPaths: [],
    rejectedPaths,
    rejectedMeta: buildRejectedMeta(fieldMeta, rejectedPaths),
  };
}

function buildFieldMetaForCommit(delta, acceptedPaths, clientId, deltaSeq, hostCommittedAt, previousFieldMeta) {
  const nextMeta = { ...previousFieldMeta };
  for (const path of acceptedPaths) {
    nextMeta[path] = {
      clientTimestamp: timestampFor(delta, path),
      committedAt: hostCommittedAt,
      deltaSeq,
      clientId,
    };
  }
  return nextMeta;
}

function buildSuccessResult(delta, commit, acceptedPaths, rejectedPaths, fieldMeta) {
  const roomId = String(delta.roomId || '').trim();
  const entityType = String(delta.entityType || '');
  const entityId = String(delta.entityId || '').trim();
  const patientId = delta.patientId != null ? String(delta.patientId) : entityId;
  const clientId = String(delta.clientId || 'unknown');
  const txId = String(delta.txId || '');

  return {
    ok: true,
    status: rejectedPaths.length ? 'partial_success' : 'ok',
    roomId,
    entityType,
    entityId,
    patientId,
    originClientId: clientId,
    txId,
    deltaSeq: commit.deltaSeq,
    version: commit.version,
    acceptedPaths,
    rejectedPaths,
    rejectedMeta: buildRejectedMeta(fieldMeta, rejectedPaths),
    pathValues: Object.fromEntries(acceptedPaths.map((path) => [path, delta.pathValues[path]])),
    fieldMeta: Object.fromEntries(acceptedPaths.map((path) => [path, commit.rec.fieldMeta[path]])),
  };
}

module.exports = {
  processValidatedPaths,
  buildStaleDeltaResult,
  buildFieldMetaForCommit,
  buildSuccessResult,
};
