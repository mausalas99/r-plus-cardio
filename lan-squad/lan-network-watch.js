'use strict';

const {
  pickLanCandidateBaseUrl,
  listPrivateIpv4SubnetPrefixes,
} = require('./lan-candidate-url.js');

/** @param {string[]} prefixes @param {string} candidateBaseUrl */
function lanNetworkFingerprint(prefixes, candidateBaseUrl) {
  return JSON.stringify({
    prefixes: [...prefixes].sort(),
    candidate: String(candidateBaseUrl || '').trim(),
  });
}

/**
 * Poll local IPv4 subnets; notify renderer when Wi‑Fi/VLAN changes.
 * @param {(payload: { prefixes: string[], candidateBaseUrl: string, prevPrefixes: string[], prevCandidateBaseUrl: string }) => void} send
 * @param {{ intervalMs?: number }} [opts]
 */
function createLanNetworkWatch(send, opts = {}) {
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 3000;
  const readPrefixes = opts.readPrefixes || listPrivateIpv4SubnetPrefixes;
  const readCandidate = opts.readCandidate || pickLanCandidateBaseUrl;
  let lastFingerprint = '';
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;

  function poll() {
    const prefixes = readPrefixes();
    const candidateBaseUrl = readCandidate();
    const fp = lanNetworkFingerprint(prefixes, candidateBaseUrl);
    if (lastFingerprint && fp !== lastFingerprint) {
      let prevPrefixes = [];
      let prevCandidateBaseUrl = '';
      try {
        const prev = JSON.parse(lastFingerprint);
        prevPrefixes = Array.isArray(prev.prefixes) ? prev.prefixes : [];
        prevCandidateBaseUrl = String(prev.candidate || '');
      } catch (_e) { void _e; }
      send({
        prefixes,
        candidateBaseUrl,
        prevPrefixes,
        prevCandidateBaseUrl,
      });
    }
    lastFingerprint = fp;
  }

  return {
    start() {
      if (timer) return;
      poll();
      timer = setInterval(poll, intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    pollOnce: poll,
    getLastFingerprint() {
      return lastFingerprint;
    },
  };
}

module.exports = {
  lanNetworkFingerprint,
  createLanNetworkWatch,
};
