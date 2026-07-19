'use strict';

function tsValue(iso) {
  if (!iso || typeof iso !== 'string') return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

/** @returns {-1|0|1} negative if a older than b */
function compareUpdatedAt(aIso, bIso) {
  const a = tsValue(aIso);
  const b = tsValue(bIso);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function recordTimestamp(rec, fields) {
  const list = Array.isArray(fields) ? fields : ['updatedAt', 'lanUpdatedAt'];
  for (const f of list) {
    if (rec && rec[f]) return rec[f];
  }
  return null;
}

/** @param {'server'|'incoming'} preferOnTie */
function pickLwwRecordMeta(serverRec, incomingRec, preferOnTie, timestampFields) {
  const sTs = recordTimestamp(serverRec, timestampFields);
  const iTs = recordTimestamp(incomingRec, timestampFields);
  const cmp = compareUpdatedAt(sTs, iTs);
  if (cmp < 0) return { winner: incomingRec, overwritten: true };
  if (cmp > 0) return { winner: serverRec, overwritten: false };
  if (preferOnTie === 'incoming') {
    return { winner: incomingRec, overwritten: serverRec !== incomingRec };
  }
  return { winner: serverRec, overwritten: false };
}

/** @param {'server'|'incoming'} preferOnTie */
function pickLwwRecord(serverRec, incomingRec, preferOnTie, timestampFields) {
  return pickLwwRecordMeta(serverRec, incomingRec, preferOnTie, timestampFields).winner;
}

module.exports = { compareUpdatedAt, pickLwwRecord, pickLwwRecordMeta, recordTimestamp };
