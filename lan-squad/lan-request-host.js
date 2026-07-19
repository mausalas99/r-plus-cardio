'use strict';

const { getRequestClientIp, isLoopbackClientIp } = require('../lib/server-http-security.js');

/** @param {import('express').Request} req */
function hostUrlFromRequest(req) {
  const host = String((req && req.headers && req.headers.host) || '').trim();
  if (!host) return '';
  const proto = req && req.protocol ? req.protocol : 'http';
  try {
    const u = new URL(`${proto}://${host}`);
    if (!u.hostname || /^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) return '';
    return `${u.protocol}//${u.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * iPad/Safari must not receive localhost from pickLanCandidate when the page is opened at ward IP.
 * @param {import('express').Request} req
 * @param {() => string} getHostUrl
 */
function resolveHostUrlForClient(req, getHostUrl) {
  const fromPick = String((typeof getHostUrl === 'function' ? getHostUrl() : '') || '')
    .trim()
    .replace(/\/+$/, '');
  const clientIp = getRequestClientIp(req);
  if (!isLoopbackClientIp(clientIp)) {
    const fromReq = hostUrlFromRequest(req);
    if (fromReq) return fromReq;
  }
  return fromPick;
}

module.exports = { hostUrlFromRequest, resolveHostUrlForClient };
