'use strict';

const { normalizeDeltaPath } = require('./delta-paths.js');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function timestampFor(delta, path) {
  const meta = delta.pathMeta && (delta.pathMeta[path] || delta.pathMeta[normalizeDeltaPath(path)]);
  return Number(meta && meta.clientTimestamp ? meta.clientTimestamp : 0);
}

function shouldAcceptPath(currentMeta, incomingTs, clientId) {
  const currentTs = Number(currentMeta && currentMeta.clientTimestamp ? currentMeta.clientTimestamp : 0);
  if (incomingTs > currentTs) return true;
  if (incomingTs < currentTs) return false;
  const currentClient = String(currentMeta && currentMeta.clientId ? currentMeta.clientId : '');
  return String(clientId || '') > currentClient;
}

function buildRejectedMeta(fieldMeta, rejectedPaths) {
  const rejectedMeta = {};
  for (const path of rejectedPaths) {
    const meta = fieldMeta[path] || {};
    rejectedMeta[path] = {
      winnerClientId: meta.clientId || null,
      winnerCommittedAt: meta.committedAt || null,
    };
  }
  return rejectedMeta;
}

module.exports = {
  clone,
  timestampFor,
  shouldAcceptPath,
  buildRejectedMeta,
};
