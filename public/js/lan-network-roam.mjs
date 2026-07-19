/**
 * Sync LAN host bindings when local subnets change (no transport/orchestrator imports).
 */
import { storage } from './storage.js';
import { getPinnedHostUrl } from './lan-host-pin.mjs';
import { findByFingerprint, getPinnedFingerprint } from './lan-host-registry.mjs';
import { pingLanHostUrl } from './lan-surrogate-host.mjs';
import { normalizeLanHostBase } from './lan-host-subnet-discovery.mjs';
import {
  applyHostRoleNetworkRoaming,
  clearStaleClientHostIfNeeded,
  clearStalePinnedHostIfNeeded,
} from './lan-network-roam-handlers.mjs';

export { isHostOnCurrentSubnets } from './lan-host-subnet-discovery.mjs';

/**
 * @param {{ prefixes?: string[], candidateBaseUrl?: string }} payload
 */
export function applyLanNetworkRoaming(payload = {}) {
  const prefixes = Array.isArray(payload.prefixes) ? payload.prefixes : [];
  const candidateBaseUrl = normalizeLanHostBase(payload.candidateBaseUrl || '');
  const cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  const teamCode = String(cfg.teamCode || '').trim();
  const uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  const pinned = getPinnedHostUrl();

  clearStalePinnedHostIfNeeded(pinned, prefixes, candidateBaseUrl);

  if (uiRole === 'host' && candidateBaseUrl && teamCode) {
    return applyHostRoleNetworkRoaming(candidateBaseUrl, teamCode, cfg);
  }

  const savedHost = normalizeLanHostBase(cfg.hostUrl || '');
  const cleared = clearStaleClientHostIfNeeded(savedHost, prefixes, teamCode);
  if (cleared) return cleared;

  return { role: uiRole, clearedStaleHost: false };
}

/**
 * @param {{ prefixes?: string[], candidateBaseUrl?: string }} payload
 * @param {{ savedHostUrl?: string, teamCode?: string, pingFn?: (url: string) => Promise<boolean> }} [opts]
 */
export async function applyLanNetworkRoamingWithFingerprint(payload, opts = {}) {
  const pinnedFp = getPinnedFingerprint();
  if (!pinnedFp) return { shortcut: false };

  const record = findByFingerprint(pinnedFp);
  if (!record) return { shortcut: false };

  const savedHost = normalizeLanHostBase(String(opts.savedHostUrl || ''));
  const registryUrl = normalizeLanHostBase(record.currentUrl);
  if (!registryUrl || registryUrl === savedHost) return { shortcut: false };

  const pingFn = typeof opts.pingFn === 'function'
    ? opts.pingFn
    : (url) => pingLanHostUrl(url, String(opts.teamCode || ''));

  const ok = await pingFn(registryUrl);
  if (!ok) return { shortcut: false };

  return { shortcut: true, newUrl: registryUrl };
}
