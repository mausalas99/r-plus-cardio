/** Pinned LAN host URL for the shift (IM-08). */

import { lanHostBasesSameMachine, normalizeLanHostBase } from './lan-host-subnet-discovery.mjs';

const PINNED_HOST_KEY = 'rpc-lan-pinned-host-url';

export function getPinnedHostUrl() {
  try {
    return String(localStorage.getItem(PINNED_HOST_KEY) || '')
      .trim()
      .replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setPinnedHostUrl(hostUrl) {
  const url = String(hostUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!url) {
    clearPinnedHostUrl();
    return;
  }
  try {
    localStorage.setItem(PINNED_HOST_KEY, url);
  } catch (_e) { void _e; }
}

export function clearPinnedHostUrl() {
  try {
    localStorage.removeItem(PINNED_HOST_KEY);
  } catch (_e) { void _e; }
}

/** True when pin points at this Mac's LAN base URL (host holds the turn; do not yield). */
export function isPinnedHostLocal(ownBaseUrl) {
  const pinned = getPinnedHostUrl();
  if (!pinned) return false;
  const own = normalizeLanHostBase(ownBaseUrl || '');
  if (!own) return false;
  return lanHostBasesSameMachine(pinned, own) || normalizeLanHostBase(pinned) === own;
}

/** True when pin targets a remote host (client should connect there). */
export function isPinnedHostRemote(ownBaseUrl) {
  const pinned = getPinnedHostUrl();
  if (!pinned) return false;
  return !isPinnedHostLocal(ownBaseUrl);
}

/** Pin blocks auto-election / peer takeover until cleared. */
export function hasPinnedHostOverride() {
  return !!getPinnedHostUrl();
}
