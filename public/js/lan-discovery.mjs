/**
 * Concurrent LAN host discovery: registry + UDP fast path, optional subnet scan.
 */

import {
  discoverLanHostsOnSubnet,
  discoverLanHostsOnSubnetViaBeacon,
  resolveLocalLanSubnetPrefixes,
} from './lan-host-subnet-discovery.mjs';
import { upsertHost, listRegistryDiscoveryUrls } from './lan-host-registry.mjs';
import { listWardHostUrlsForProbe } from './lan-ward-host-registry.mjs';
import { pingLanHostUrl } from './lan-surrogate-host.mjs';
import {
  collectUdpDiscoveryUrls,
  resolveDiscoveryFastPath,
  runDiscoverySubnetScan,
} from './lan-discovery-udp.mjs';

const DEFAULT_REGISTRY_AGE_MS = 90_000;

function normalizeHostUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function dedupeUrls(urls) {
  const seen = new Set();
  const merged = [];
  for (const url of urls) {
    const n = normalizeHostUrl(url);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    merged.push(n);
  }
  return merged;
}

/**
 * Verify beacon hits with a single bearer ping (avoids double-fetch probeLanHostBase).
 * @param {string[]} urls
 * @param {string} teamCode
 * @returns {Promise<string[]>}
 */
async function verifyLanHostsWithBearer(urls, teamCode) {
  const code = String(teamCode || '').trim();
  if (!code) return [];
  const verified = [];
  for (const url of urls) {
    if (await pingLanHostUrl(url, code)) verified.push(normalizeHostUrl(url));
  }
  return verified;
}

/**
 * Run UDP (+ optional subnet scan); upsert UDP hits into the host registry.
 * @param {string} teamCode
 * @param {string} ownUrl
 * @param {{
 *   skipSubnetScan?: boolean,
 *   skipUdpDiscover?: boolean,
 *   forceSubnetScan?: boolean,
 *   subnetScanMode?: 'beacon' | 'bearer',
 *   registryMaxAgeMs?: number,
 * }} [opts]
 * @returns {Promise<string[]>} deduped host base URLs
 */
export async function discoverLanHostsConcurrent(teamCode, ownUrl, opts = {}) {
  const own = normalizeHostUrl(ownUrl);
  const registryUrls = listRegistryDiscoveryUrls(
    opts.registryMaxAgeMs ?? DEFAULT_REGISTRY_AGE_MS
  ).filter((url) => url !== own);

  const skipUdp = opts.skipUdpDiscover || registryUrls.length > 0;
  const udpHosts =
    skipUdp || typeof window === 'undefined' || !window.electronAPI?.lanUdpDiscover
      ? []
      : await window.electronAPI.lanUdpDiscover().catch(() => []);

  const udpUrls = collectUdpDiscoveryUrls(udpHosts, own, upsertHost);

  const localPrefixes = await resolveLocalLanSubnetPrefixes(own);
  const wardUrls = listWardHostUrlsForProbe(undefined, {
    localSubnetPrefixes: localPrefixes,
  }).filter((url) => url !== own);
  const fastUrls = dedupeUrls([...registryUrls, ...udpUrls, ...wardUrls]);
  const verifiedFast = fastUrls.length
    ? await verifyLanHostsWithBearer(fastUrls, teamCode)
    : [];

  const fastPath = resolveDiscoveryFastPath(opts, verifiedFast, fastUrls);
  if (fastPath) return fastPath;

  const scanned = await runDiscoverySubnetScan(
    opts,
    teamCode,
    ownUrl,
    verifyLanHostsWithBearer,
    discoverLanHostsOnSubnet,
    discoverLanHostsOnSubnetViaBeacon
  );

  return dedupeUrls([...verifiedFast, ...scanned]);
}
