'use strict';

/** Multicast send/bind failures when Wi‑Fi is down or interfaces are in flux. */
const RECOVERABLE_MDNS_CODES = new Set([
  'EADDRNOTAVAIL',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'EACCES',
]);

/**
 * @param {NodeJS.ErrnoException | null | undefined} err
 * @returns {boolean}
 */
function isRecoverableMdnsError(err) {
  if (!err) return false;
  return RECOVERABLE_MDNS_CODES.has(String(err.code || ''));
}

/**
 * @param {NodeJS.ErrnoException | null | undefined} err
 * @param {() => void} stopFn
 */
function handleMdnsFault(err, stopFn) {
  if (!err) return;
  if (!isRecoverableMdnsError(err)) {
    console.warn('[lan-mdns]', err.message || String(err));
  }
  try {
    stopFn();
  } catch (_e) { void _e; }
}

function stopMdnsInstances(state, detachFn) {
  detachFn();
  try {
    if (state.browser) {
      state.browser.stop();
      state.browser = null;
    }
  } catch (_e) { void _e; }
  try {
    if (state.advertised) {
      state.advertised.stop();
      state.advertised = null;
    }
  } catch (_e) { void _e; }
  try {
    if (state.bonjour) {
      state.bonjour.destroy();
      state.bonjour = null;
    }
  } catch (_e) { void _e; }
}

function attachMdnsListeners(mdns, onEvent, stateHolder) {
  if (!mdns || typeof mdns.on !== 'function') return;
  stateHolder.mdnsEmitter = mdns;
  mdns.on('warning', onEvent);
  mdns.on('error', onEvent);
}

function detachMdnsListeners(mdnsEmitter, onEvent, stateHolder) {
  if (!mdnsEmitter) return;
  try {
    mdnsEmitter.removeListener('warning', onEvent);
    mdnsEmitter.removeListener('error', onEvent);
  } catch (_e) { void _e; }
  stateHolder.mdnsEmitter = null;
}

function handleDiscoveredService(service, clientId, port, onPeers) {
  try {
    const txt = service.txt || {};
    const peerClientId = String(txt.clientId || '').trim();
    const peerStartedAt = Number(txt.startedAt) || 0;
    const peerRank = String(txt.rank || '').trim();
    const peerTeamHash = String(txt.teamHash || '').trim();
    if (!peerClientId || !peerStartedAt) return;
    if (peerClientId === clientId) return;
    const addresses = Array.isArray(service.addresses) ? service.addresses : [];
    const ipv4 = addresses.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a)) || '';
    if (!ipv4) return;
    const url = `http://${ipv4}:${service.port || port}`;
    if (typeof onPeers === 'function') {
      onPeers([{ url, clientId: peerClientId, startedAt: peerStartedAt, rank: peerRank, teamHash: peerTeamHash }]);
    }
  } catch (_e) { void _e; }
}

module.exports = {
  isRecoverableMdnsError,
  handleMdnsFault,
  stopMdnsInstances,
  attachMdnsListeners,
  detachMdnsListeners,
  handleDiscoveredService,
};
