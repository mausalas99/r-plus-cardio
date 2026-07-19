'use strict';

/**
 * Electron window.open / shell.openExternal allowlist (audit M1).
 * Mirrors open-external IPC in main.js.
 */

function isPrivateLanHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (h === '127.0.0.1') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  const m172 = h.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  if (m172) {
    const second = Number(m172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function isAllowedExternalHost(protocol, hostname) {
  const h = String(hostname || '').toLowerCase();
  if (protocol === 'https:') {
    if (h === 'github.com' || h.endsWith('.github.com')) return true;
    if (h === 'githubusercontent.com' || h.endsWith('.githubusercontent.com')) return true;
  }
  if (protocol === 'http:' || protocol === 'https:') {
    return isPrivateLanHost(h);
  }
  return false;
}

function isAllowedExternalUrl(url) {
  if (typeof url !== 'string') return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return isAllowedExternalHost(u.protocol, u.hostname);
}

module.exports = { isAllowedExternalUrl };
