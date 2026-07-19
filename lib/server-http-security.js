'use strict';

const { verifyTeamCode } = require('../lan-squad/team-code.js');

function normalizeClientIp(raw) {
  const ip = String(raw || '').trim();
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

/** @param {import('http').IncomingMessage} req */
function getRequestClientIp(req) {
  return normalizeClientIp(req.socket && req.socket.remoteAddress);
}

/** @param {string} ip */
function isLoopbackClientIp(ip) {
  return ip === '127.0.0.1' || ip === '::1';
}

/**
 * @param {() => { teamCodeHash?: string }} getHostState
 */
function createLanTokenVerifier(getHostState) {
  return function verifyLanBearerToken(token) {
    if (!token || typeof getHostState !== 'function') return false;
    try {
      const st = getHostState();
      return verifyTeamCode(String(token), st && st.teamCodeHash);
    } catch {
      return false;
    }
  };
}

/**
 * Document generation must come from the Electron shell (loopback) or an authenticated LAN client.
 * @param {() => { teamCodeHash?: string }} getHostState
 */
function createDocumentExportAuthMiddleware(getHostState) {
  const verifyLanBearer = createLanTokenVerifier(getHostState);
  return function documentExportAuth(req, res, next) {
    const ip = getRequestClientIp(req);
    if (isLoopbackClientIp(ip)) return next();
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
    const token = match ? match[1] : '';
    if (verifyLanBearer(token)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}

/** GET/HEAD assets and health — not counted toward global HTTP rate limit. */
function isStaticOrHealthRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const p = req.path || '';
  if (p === '/health') return true;
  if (p === '/manifest.webmanifest') return true;
  if (p.startsWith('/icons/')) return true;
  if (p.startsWith('/styles/') || p.startsWith('/js/') || p.startsWith('/partials/')) return true;
  return /\.(css|js|mjs|map|woff2?|png|svg|ico|webp|html|webmanifest)(\?|$)/i.test(p);
}

/**
 * Ward LAN discovery issues many GET /ping per client; host loopback shares one IP bucket.
 * Bearer-protected /api/lan and /api/interno use dedicated limiters where needed.
 * @param {import('express').Request} req
 */
function shouldSkipGlobalRateLimit(req) {
  if (isStaticOrHealthRequest(req)) return true;
  const p = String(req.path || '');
  if (p === '/' || p === '/index.html') return true;
  if (p === '/join' || p.startsWith('/join/')) return true;
  if (p.startsWith('/interno/')) return true;
  if (p.startsWith('/api/lan/v1/')) return true;
  if (p.startsWith('/api/interno/v1/')) return true;
  return false;
}

/** LAN sync-bundle uses a route-level JSON parser (16mb); skip the global 2mb cap. */
function shouldSkipGlobalJsonBodyParser(req) {
  const p = String(req.path || req.url || '').split('?')[0];
  return /\/api\/lan\/v1\/rooms\/[^/]+\/sync-bundle$/.test(p);
}

module.exports = {
  getRequestClientIp,
  isLoopbackClientIp,
  createLanTokenVerifier,
  createDocumentExportAuthMiddleware,
  isStaticOrHealthRequest,
  shouldSkipGlobalRateLimit,
  shouldSkipGlobalJsonBodyParser,
};
