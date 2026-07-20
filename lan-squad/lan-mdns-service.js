'use strict';
const { Bonjour } = require('bonjour-service');
const crypto = require('node:crypto');
const { pickLanCandidateBaseUrl } = require('./lan-candidate-url.js');
const {
  handleMdnsFault,
  stopMdnsInstances,
  attachMdnsListeners,
  detachMdnsListeners,
  handleDiscoveredService,
  isRecoverableMdnsError,
} = require('./lan-mdns-service-lifecycle.js');

const { LAN_HTTP_PORT } = require('../lib/http-port.js');
const SERVICE_TYPE = 'rplus';
const SERVICE_PROTOCOL = 'tcp';
const DEFAULT_PORT = LAN_HTTP_PORT;

/**
 * True when this Mac has a non-loopback IPv4 LAN address for mDNS.
 * @param {string} [hostBaseUrl]
 * @returns {boolean}
 */
function hasLanInterfaceForMdns(hostBaseUrl) {
  const explicit = String(hostBaseUrl || '').trim();
  if (explicit) return true;
  return !!pickLanCandidateBaseUrl();
}

/**
 * @param {{ clientId: string, startedAt: number, rank: string, teamHash: string, port?: number }} opts
 * @param {(peers: Array<{url: string, clientId: string, startedAt: number, rank: string, teamHash: string}>) => void} onPeers
 */
function createLanMdnsService({ clientId, startedAt, rank, teamHash, port = DEFAULT_PORT }, onPeers) {
  const state = { bonjour: null, browser: null, advertised: null, mdnsEmitter: null };

  function onMdnsSocketEvent(err) {
    handleMdnsFault(err, stop);
  }

  function detach() {
    detachMdnsListeners(state.mdnsEmitter, onMdnsSocketEvent, state);
  }

  function stop() {
    stopMdnsInstances(state, detach);
  }

  function start(hostBaseUrl) {
    stop();
    if (!hasLanInterfaceForMdns(hostBaseUrl)) return;

    state.bonjour = new Bonjour({}, (err) => {
      handleMdnsFault(err, stop);
    });
    attachMdnsListeners(state.bonjour.server && state.bonjour.server.mdns, onMdnsSocketEvent, state);

    state.advertised = state.bonjour.publish({
      name: `R+ ${rank} ${String(clientId).slice(-6)}`,
      type: `${SERVICE_TYPE}.${SERVICE_PROTOCOL}`,
      port,
      txt: { clientId, startedAt: String(startedAt), rank, teamHash },
    });

    state.browser = state.bonjour.find({ type: `${SERVICE_TYPE}.${SERVICE_PROTOCOL}` }, (service) => {
      handleDiscoveredService(service, clientId, port, onPeers);
    });
  }

  function restart(newHostBaseUrl) {
    stop();
    setTimeout(() => start(newHostBaseUrl), 300);
  }

  return { start, stop, restart };
}

function buildTeamHashSync(teamCode) {
  return crypto.createHash('sha256').update(String(teamCode || '')).digest('hex').slice(0, 8);
}

module.exports = {
  createLanMdnsService,
  buildTeamHashSync,
  isRecoverableMdnsError,
  hasLanInterfaceForMdns,
};
