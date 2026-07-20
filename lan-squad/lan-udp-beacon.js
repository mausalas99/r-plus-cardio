'use strict';
const dgram = require('node:dgram');
const { DISCOVER_MSG, discoverOnPort, multicastDiscover } = require('./lan-udp-beacon-discover.js');
const { LAN_HTTP_PORT, LAN_BEACON_PORT } = require('../lib/http-port.js');

const MULTICAST_GROUP = '239.255.42.1';
const DEFAULT_BEACON_PORT = LAN_BEACON_PORT;

/**
 * @param {{ clientId: string, startedAt: number, rank: string, teamHash: string, port?: number, httpPort?: number }} opts
 */
function createUdpBeacon({
  clientId,
  startedAt,
  rank,
  teamHash,
  port = DEFAULT_BEACON_PORT,
  httpPort = LAN_HTTP_PORT,
}) {
  /** @type {dgram.Socket | null} */
  let listenSocket = null;
  let listenPort = 0;

  const beaconMsg = JSON.stringify({
    type: 'rplus-beacon',
    port: Number(httpPort) || LAN_HTTP_PORT,
    clientId,
    startedAt,
    rank,
    teamHash,
  });

  /** Start the multicast listen side. Returns Promise<number> with assigned port. */
  function startListening() {
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      listenSocket = sock;

      sock.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data && data.type === 'rplus-discover') {
            const buf = Buffer.from(beaconMsg);
            sock.send(buf, rinfo.port, rinfo.address, () => {});
          }
        } catch (_e) { void _e; }
      });

      sock.on('error', (err) => {
        reject(err);
      });

      const bindPort = Number(port) || 0;
      sock.bind(bindPort, () => {
        try {
          if (bindPort !== 0) {
            sock.addMembership(MULTICAST_GROUP);
          }
        } catch {
          // Multicast join may fail in CI/test environments without multicast — non-fatal
        }
        listenPort = sock.address().port;
        resolve(listenPort);
      });
    });
  }

  function discoverOnPortWrapped(targetPort, timeoutMs = 500) {
    return discoverOnPort(targetPort, listenPort, port, timeoutMs);
  }

  function discover(timeoutMs = 500) {
    return multicastDiscover(MULTICAST_GROUP, Number(port) || DEFAULT_BEACON_PORT, clientId, timeoutMs);
  }

  function stop() {
    if (listenSocket) {
      try { listenSocket.close(); } catch (_e) { void _e; }
      listenSocket = null;
    }
  }

  return { startListening, discoverOnPort: discoverOnPortWrapped, discover, stop };
}

module.exports = { createUdpBeacon, MULTICAST_GROUP, DISCOVER_MSG };
