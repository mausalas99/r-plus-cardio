/**
 * LAN host peer probe helpers — extracted from panel.mjs scanLanHosts.
 */
import { probeLanHostBeacon } from '../../lan-host-subnet-discovery.mjs';

/**
 * @param {string[]} urls
 * @param {string} teamCode
 * @param {{
 *   pingLanHostUrl: (url: string, teamCode: string) => Promise<boolean>,
 *   fetchLanHostRank: (url: string, teamCode: string, opts?: object) => Promise<object|null>,
 *   reactToDiscoveredLanHost?: (url: string, teamCode: string) => Promise<boolean>,
 *   addPeer: (url: string) => void,
 *   pushMeta: (meta: object) => void,
 *   onJoined?: () => void,
 *   beaconFirst?: boolean,
 * }} deps
 * @returns {Promise<boolean>} true when discovery short-circuited (host joined)
 */
async function probeSingleLanPeerUrl(url, teamCode, deps) {
  if (deps.beaconFirst) {
    if (!(await probeLanHostBeacon(url))) return false;
  }
  var alive = await deps.pingLanHostUrl(url, teamCode);
  if (!alive) return false;
  var meta = await deps.fetchLanHostRank(url, teamCode, { skipPing: true });
  if (meta) deps.pushMeta(meta);
  deps.addPeer(url);
  if (typeof deps.reactToDiscoveredLanHost !== 'function') return false;
  if (!(await deps.reactToDiscoveredLanHost(url, teamCode))) return false;
  if (deps.onJoined) deps.onJoined();
  return true;
}

export async function probeLanPeerUrls_(urls, teamCode, deps) {
  for (var i = 0; i < urls.length; i += 1) {
    var url = urls[i];
    if (!url) continue;
    if (await probeSingleLanPeerUrl(url, teamCode, deps)) return true;
  }
  return false;
}

/**
 * @param {string[]} scanned
 * @param {string} teamCode
 * @param {{
 *   pingLanHostUrl?: (url: string, teamCode: string) => Promise<boolean>,
 *   fetchLanHostRank: (url: string, teamCode: string, opts?: object) => Promise<object|null>,
 *   prefersLanHosting: (meta: object) => boolean,
 *   wsPeerCount: number,
 *   showSplitBrainHint?: (hostUrl: string) => void,
 * }} deps
 * @returns {Promise<{ peerMetas: object[], wardHosts: string[] }>}
 */
export async function collectSubnetScanMetas_(scanned, teamCode, deps) {
  var peerMetas = [];
  var wardHosts = [];
  for (var hi = 0; hi < scanned.length; hi += 1) {
    if (typeof deps.pingLanHostUrl === 'function') {
      if (!(await deps.pingLanHostUrl(scanned[hi], teamCode))) continue;
    }
    var peerMeta = await deps.fetchLanHostRank(scanned[hi], teamCode, { skipPing: true });
    if (!peerMeta) continue;
    peerMetas.push(peerMeta);
    if (deps.prefersLanHosting(peerMeta)) wardHosts.push(scanned[hi]);
  }
  if (wardHosts.length && !deps.wsPeerCount && deps.showSplitBrainHint) {
    deps.showSplitBrainHint(wardHosts[0]);
  }
  return { peerMetas, wardHosts };
}
