'use strict';
const dgram = require('node:dgram');

const DISCOVER_MSG = JSON.stringify({ type: 'rplus-discover' });

function parseBeaconMessage(msg) {
  try {
    return JSON.parse(msg.toString());
  } catch {
    return null;
  }
}

function beaconResultFromLocalhost(data) {
  return {
    url: `http://127.0.0.1:${data.port || 3738}`,
    clientId: String(data.clientId),
    startedAt: Number(data.startedAt) || 0,
    rank: String(data.rank || ''),
    teamHash: String(data.teamHash || ''),
    _fromUdp: true,
  };
}

function beaconResultFromRemote(data, rinfo) {
  return {
    url: `http://${rinfo.address}:${data.port || 3738}`,
    clientId: data.clientId,
    startedAt: data.startedAt,
    rank: data.rank,
    teamHash: data.teamHash,
    _fromUdp: true,
  };
}

/**
 * Send a discovery datagram and collect unicast replies for timeoutMs.
 * @param {number} targetPort — port to send to
 * @param {number} listenPort
 * @param {number} defaultPort
 * @param {number} [timeoutMs=500]
 * @returns {Promise<Array<{url: string, clientId: string, startedAt: number, rank: string, teamHash: string, _fromUdp: boolean}>>}
 */
function discoverOnPort(targetPort, listenPort, defaultPort, timeoutMs = 500) {
  return new Promise((resolve) => {
    const results = [];
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    sock.on('message', (msg) => {
      const data = parseBeaconMessage(msg);
      if (data && data.type === 'rplus-beacon' && data.clientId) {
        results.push(beaconResultFromLocalhost(data));
      }
    });

    sock.bind(0, () => {
      try {
        sock.setBroadcast(true);
      } catch (_e) { void _e; }
      const buf = Buffer.from(DISCOVER_MSG);
      const dest = targetPort || listenPort || Number(defaultPort);
      sock.send(buf, dest, '127.0.0.1', () => {});
      setTimeout(() => {
        try { sock.close(); } catch (_e) { void _e; }
        resolve(results);
      }, timeoutMs);
    });
  });
}

/**
 * Production discover: sends to MULTICAST_GROUP on the configured beacon port.
 * @param {string} multicastGroup
 * @param {number} port
 * @param {string} clientId
 * @param {number} [timeoutMs=500]
 */
function multicastDiscover(multicastGroup, port, clientId, timeoutMs = 500) {
  return new Promise((resolve) => {
    const results = [];
    const seen = new Set();
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    sock.on('message', (msg, rinfo) => {
      const data = parseBeaconMessage(msg);
      if (data && data.type === 'rplus-beacon' && data.clientId && data.clientId !== clientId) {
        const url = `http://${rinfo.address}:${data.port || 3738}`;
        if (!seen.has(url)) {
          seen.add(url);
          results.push(beaconResultFromRemote(data, rinfo));
        }
      }
    });

    sock.bind(0, () => {
      try { sock.setBroadcast(true); } catch (_e) { void _e; }
      try { sock.setMulticastTTL(4); } catch (_e) { void _e; }
      const buf = Buffer.from(DISCOVER_MSG);
      const destPort = Number(port);
      sock.send(buf, destPort, multicastGroup, () => {});
      setTimeout(() => {
        try { sock.close(); } catch (_e) { void _e; }
        resolve(results);
      }, timeoutMs);
    });
  });
}

module.exports = {
  DISCOVER_MSG,
  discoverOnPort,
  multicastDiscover,
  parseBeaconMessage,
};
