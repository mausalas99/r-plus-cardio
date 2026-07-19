/** UDP registry upsert for concurrent LAN host discovery. */

function normalizeHostUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/** @param {Array<object>} udpHosts @param {string} own @param {(record: object) => void} upsertHost */
export function collectUdpDiscoveryUrls(udpHosts, own, upsertHost) {
  const udpUrls = [];
  if (!Array.isArray(udpHosts)) return udpUrls;
  for (const h of udpHosts) {
    if (!h?.clientId || !h?.startedAt) continue;
    upsertHost({
      fingerprint: `${h.clientId}:${h.startedAt}`,
      clientId: h.clientId,
      startedAt: h.startedAt,
      currentUrl: h.url,
      rank: h.rank || '',
      dbUnlocked: false,
      shiftPinActive: false,
      rttMs: 0,
      lastSeenAt: Date.now(),
      source: 'udp',
    });
    const url = normalizeHostUrl(h.url);
    if (url && url !== own) udpUrls.push(url);
  }
  return udpUrls;
}

/** @param {object} opts @param {string[]} verifiedFast @param {string[]} fastUrls */
export function resolveDiscoveryFastPath(opts, verifiedFast, fastUrls) {
  if (opts.skipSubnetScan) {
    return verifiedFast.length ? verifiedFast : fastUrls;
  }
  if (verifiedFast.length > 0 && !opts.forceSubnetScan) return verifiedFast;
  return null;
}

/** @param {object} opts @param {string} teamCode @param {string} ownUrl @param {Function} verifyFn @param {Function} scanSubnet @param {Function} scanBeacon */
export async function runDiscoverySubnetScan(opts, teamCode, ownUrl, verifyFn, scanSubnet, scanBeacon) {
  const scanMode = opts.subnetScanMode || 'beacon';
  if (scanMode === 'bearer') return scanSubnet(teamCode, ownUrl);
  const beaconHits = await scanBeacon(ownUrl);
  return verifyFn(beaconHits, teamCode);
}
