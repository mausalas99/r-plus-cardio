'use strict';

const { pickLwwRecordMeta } = require('./lww-utils-core.js');

function mergeChangedKeys(merged, serverData, incomingPatch, changedKeys, incomingWins, timestampFields) {
  const overwrittenKeys = [];
  for (const key of changedKeys) {
    if (!(key in (incomingPatch || {}))) continue;
    if (timestampFields.includes(key)) continue;
    const serverVal = serverData?.[key];
    const incomingVal = incomingPatch[key];
    if (incomingWins) {
      merged[key] = incomingVal;
      if (serverVal !== incomingVal) overwrittenKeys.push(key);
    }
  }
  return overwrittenKeys;
}

function applyTimestampFields(merged, incomingPatch, incomingWins, timestampFields) {
  if (!incomingWins) return;
  for (const f of timestampFields) {
    if (incomingPatch?.[f]) merged[f] = incomingPatch[f];
  }
}

function mergeRecordsLww(serverData, incomingPatch, opts) {
  const changedKeys = Array.isArray(opts?.changedKeys) ? opts.changedKeys : Object.keys(incomingPatch || {});
  const timestampFields = opts?.timestampFields || ['lanUpdatedAt', 'updatedAt'];
  const merged = { ...(serverData || {}) };
  const incomingFull = { ...(serverData || {}), ...(incomingPatch || {}) };
  const { winner, overwritten } = pickLwwRecordMeta(
    serverData || {},
    incomingFull,
    'incoming',
    timestampFields
  );
  const incomingWins = winner === incomingFull || overwritten;
  const overwrittenKeys = mergeChangedKeys(
    merged,
    serverData,
    incomingPatch,
    changedKeys,
    incomingWins,
    timestampFields
  );
  applyTimestampFields(merged, incomingPatch, incomingWins, timestampFields);
  return { merged, overwrittenKeys };
}

module.exports = { mergeRecordsLww };
