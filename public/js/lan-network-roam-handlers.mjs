/** LAN network roaming role handlers (extracted for complexity budget). */
import { storage } from './storage.js';
import { lanClient } from './features/lan/runtime.mjs';
import { clearPinnedHostUrl, isPinnedHostLocal } from './lan-host-pin.mjs';
import { isHostOnCurrentSubnets, normalizeLanHostBase } from './lan-host-subnet-discovery.mjs';

/** @param {string} pinned @param {string[]} prefixes @param {string} candidateBaseUrl */
export function clearStalePinnedHostIfNeeded(pinned, prefixes, candidateBaseUrl) {
  if (pinned && !isHostOnCurrentSubnets(pinned, prefixes) && !isPinnedHostLocal(candidateBaseUrl)) {
    clearPinnedHostUrl();
  }
}

/** @param {string} candidateBaseUrl @param {string} teamCode @param {object} cfg */
export function applyHostRoleNetworkRoaming(candidateBaseUrl, teamCode, cfg) {
  const current = normalizeLanHostBase(cfg.hostUrl || '');
  if (current === candidateBaseUrl) return { role: 'host', candidateBaseUrl };
  storage.saveLanConfig({ hostUrl: candidateBaseUrl, teamCode });
  lanClient.configure({ hostUrl: candidateBaseUrl, teamCode });
  try {
    lanClient.disconnect();
    lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
  return { role: 'host', candidateBaseUrl };
}

/** @param {string} savedHost @param {string[]} prefixes @param {string} teamCode */
export function clearStaleClientHostIfNeeded(savedHost, prefixes, teamCode) {
  if (!savedHost || !prefixes.length || isHostOnCurrentSubnets(savedHost, prefixes)) {
    return null;
  }
  storage.saveLanConfig(teamCode ? { hostUrl: '', teamCode } : null);
  try {
    lanClient.disconnect();
  } catch (_e) { void _e; }
  return { role: 'client', clearedStaleHost: true };
}
