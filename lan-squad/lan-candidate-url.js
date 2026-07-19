'use strict';
const os = require('node:os');

const DEFAULT_LAN_PORT = 3738;

/** http://<IPv4-LAN>:3738 — never localhost (for tickets / mobile join). */
function pickLanCandidateBaseUrl(port = DEFAULT_LAN_PORT) {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const fam = net.family;
      if (fam !== 'IPv4' && fam !== 4) continue;
      if (net.internal) continue;
      const addr = net.address;
      if (!addr || addr === '127.0.0.1') continue;
      candidates.push({ name, address: addr });
    }
  }
  if (!candidates.length) return '';
  const prefer = (n) => /en0|eth0|wlan|wi-?fi|wifi|ethernet|enp|wlp/i.test(n);
  candidates.sort((a, b) => {
    const pa = prefer(a.name) ? 0 : 1;
    const pb = prefer(b.name) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return String(a.address).localeCompare(String(b.address));
  });
  return `http://${candidates[0].address}:${port}`;
}

function isLoopbackLanHost(hostname) {
  return /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || '').trim());
}

function isPrivateLanIpv4(addr) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(addr || ''));
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function subnetPrefixFromIpv4(ip) {
  const s = String(ip || '');
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(s)) return '';
  return s.split('.').slice(0, 3).join('.');
}

/** Unique /24 prefixes for every active non-internal IPv4 (multi-Wi‑Fi / VLAN). */
function listPrivateIpv4SubnetPrefixes() {
  const nets = os.networkInterfaces();
  /** @type {Set<string>} */
  const prefixes = new Set();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const fam = net.family;
      if (fam !== 'IPv4' && fam !== 4) continue;
      if (net.internal) continue;
      const addr = net.address;
      if (!addr || !isPrivateLanIpv4(addr)) continue;
      const prefix = subnetPrefixFromIpv4(addr);
      if (prefix) prefixes.add(prefix);
    }
  }
  return [...prefixes].sort();
}

module.exports = {
  pickLanCandidateBaseUrl,
  isLoopbackLanHost,
  isPrivateLanIpv4,
  subnetPrefixFromIpv4,
  listPrivateIpv4SubnetPrefixes,
  DEFAULT_LAN_PORT,
};
