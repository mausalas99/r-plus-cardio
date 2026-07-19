/** Host election tie-breakers (extracted for complexity budget). */

/**
 * @param {number} selfStarted
 * @param {number} peerStarted
 * @returns {'self'|'peer'|null}
 */
export function resolveHostElectionByStartedAt(selfStarted, peerStarted) {
  const selfMissing = selfStarted <= 0;
  const peerMissing = peerStarted <= 0;
  if (!selfMissing && peerMissing) return 'self';
  if (selfMissing && !peerMissing) return 'peer';
  if (peerStarted < selfStarted) return 'peer';
  if (selfStarted < peerStarted) return 'self';
  return null;
}

/**
 * @param {{ selfUrl?: string, peerUrl?: string }} urls
 * @returns {'tie-self'|'tie-peer'}
 */
export function resolveHostElectionByUrl(urls) {
  const selfUrl = String(urls.selfUrl || '').trim();
  const peerUrl = String(urls.peerUrl || '').trim();
  if (peerUrl && selfUrl && peerUrl < selfUrl) return 'tie-peer';
  if (peerUrl && selfUrl && selfUrl < peerUrl) return 'tie-self';
  return 'tie-self';
}

/** @param {object|null|undefined} data */
export function parseLanHostRankResponse(data) {
  return {
    rank: String(data?.rank || 'R1').trim() || 'R1',
    isProgramAdmin: !!(data?.isProgramAdmin || data?.is_program_admin),
    isOnCallGuardia: !!(data?.isOnCallGuardia || data?.is_on_call_guardia),
    startedAt: Number(data?.startedAt) || 0,
  };
}
