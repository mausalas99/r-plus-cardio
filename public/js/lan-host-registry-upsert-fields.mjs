/** Field merge helpers for LAN host registry upsert. */

function resolveOptionalBool(incoming, existing, key) {
  return incoming[key] != null ? !!incoming[key] : (existing?.[key] ?? false);
}

function resolveMergedUrl(existing, record, shouldUpdateUrl) {
  return shouldUpdateUrl ? String(record.currentUrl || '') : existing.currentUrl;
}

function resolveMergedSource(existing, record, shouldUpdateUrl) {
  return shouldUpdateUrl ? record.source : (existing?.source ?? 'scan');
}

/** @param {object|null} existing @param {object} record @param {boolean} shouldUpdateUrl */
export function buildMergedHostRegistryFields(existing, record, shouldUpdateUrl) {
  return {
    fingerprint: String(record.fingerprint),
    clientId: String(record.clientId || ''),
    startedAt: Number(record.startedAt) || 0,
    currentUrl: resolveMergedUrl(existing, record, shouldUpdateUrl),
    rank: String(record.rank || existing?.rank || ''),
    dbUnlocked: resolveOptionalBool(record, existing, 'dbUnlocked'),
    shiftPinActive: resolveOptionalBool(record, existing, 'shiftPinActive'),
    rttMs: Number(record.rttMs) || (existing?.rttMs ?? 0),
    lastSeenAt: Number(record.lastSeenAt) || Date.now(),
    source: resolveMergedSource(existing, record, shouldUpdateUrl),
  };
}
