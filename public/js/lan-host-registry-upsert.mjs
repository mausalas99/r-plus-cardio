/** LAN host registry upsert merge (extracted for complexity budget). */

import { buildMergedHostRegistryFields } from './lan-host-registry-upsert-fields.mjs';

const SOURCE_WEIGHT = {
  heartbeat: 5,
  mdns: 4,
  health_poll: 3,
  udp: 2,
  scan: 1,
};

function shouldReplaceHostRecord(existing, incoming, incomingWeight, existingWeight) {
  if (!existing) return true;
  if (incomingWeight > existingWeight) return true;
  return incomingWeight === existingWeight && incoming.lastSeenAt >= existing.lastSeenAt;
}

/** @param {object|null} existing @param {object} record @param {number} incomingWeight */
export function mergeHostRegistryRecord(existing, record, incomingWeight) {
  const existingWeight = existing ? (SOURCE_WEIGHT[existing.source] ?? 0) : -1;
  const shouldUpdateUrl = shouldReplaceHostRecord(
    existing,
    record,
    incomingWeight,
    existingWeight
  );

  return buildMergedHostRegistryFields(existing, record, shouldUpdateUrl);
}

export { SOURCE_WEIGHT };
