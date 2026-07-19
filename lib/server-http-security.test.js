'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getRequestClientIp,
  isLoopbackClientIp,
  createDocumentExportAuthMiddleware,
  shouldSkipGlobalRateLimit,
  shouldSkipGlobalJsonBodyParser,
} = require('./server-http-security.js');

describe('server-http-security', () => {
  it('isLoopbackClientIp accepts localhost variants', () => {
    assert.equal(isLoopbackClientIp('127.0.0.1'), true);
    assert.equal(isLoopbackClientIp('::1'), true);
    assert.equal(isLoopbackClientIp('192.168.1.10'), false);
  });

  it('getRequestClientIp normalizes IPv4-mapped loopback', () => {
    const req = { socket: { remoteAddress: '::ffff:127.0.0.1' } };
    assert.equal(getRequestClientIp(req), '127.0.0.1');
  });

  it('document export middleware allows loopback', () => {
    const mw = createDocumentExportAuthMiddleware(() => ({ teamCodeHash: 'x' }));
    const req = { socket: { remoteAddress: '127.0.0.1' }, get: () => '' };
    let called = false;
    const res = {
      status() {
        return this;
      },
      json() {},
    };
    mw(req, res, () => {
      called = true;
    });
    assert.equal(called, true);
  });

  it('shouldSkipGlobalRateLimit exempts ward LAN and shell routes', () => {
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'GET', path: '/api/lan/v1/ping' }),
      true
    );
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'PUT', path: '/api/lan/v1/rooms/sala-2/clinical-ops' }),
      true
    );
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'GET', path: '/api/interno/v1/ping' }),
      true
    );
    assert.equal(shouldSkipGlobalRateLimit({ method: 'GET', path: '/' }), true);
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'GET', path: '/manifest.webmanifest' }),
      true
    );
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'GET', path: '/icons/apple-touch-icon.png' }),
      true
    );
    assert.equal(
      shouldSkipGlobalRateLimit({ method: 'POST', path: '/generate' }),
      false
    );
  });

  it('shouldSkipGlobalJsonBodyParser exempts LAN sync-bundle PUT', () => {
    assert.equal(
      shouldSkipGlobalJsonBodyParser({
        method: 'PUT',
        path: '/api/lan/v1/rooms/sala-2/sync-bundle',
      }),
      true
    );
    assert.equal(
      shouldSkipGlobalJsonBodyParser({
        method: 'PUT',
        path: '/api/lan/v1/rooms/sala-2/clinical-ops',
      }),
      false
    );
    assert.equal(
      shouldSkipGlobalJsonBodyParser({ method: 'POST', path: '/generate' }),
      false
    );
  });

  it('document export middleware rejects remote without bearer', () => {
    const mw = createDocumentExportAuthMiddleware(() => ({ teamCodeHash: 'x' }));
    const req = { socket: { remoteAddress: '10.0.0.5' }, get: () => '' };
    let statusCode = 0;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {},
    };
    mw(req, res, () => {});
    assert.equal(statusCode, 403);
  });
});
