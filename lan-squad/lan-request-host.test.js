'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveHostUrlForClient, hostUrlFromRequest } = require('./lan-request-host.js');

describe('lan-request-host', () => {
  it('hostUrlFromRequest uses Host header', () => {
    const req = { protocol: 'http', headers: { host: '10.102.32.212:3738' } };
    assert.equal(hostUrlFromRequest(req), 'http://10.102.32.212:3738');
  });

  it('resolveHostUrlForClient prefers ward IP for remote clients', () => {
    const req = {
      protocol: 'http',
      headers: { host: '10.102.32.212:3738' },
      socket: { remoteAddress: '10.102.32.55' },
    };
    assert.equal(
      resolveHostUrlForClient(req, () => 'http://127.0.0.1:3738'),
      'http://10.102.32.212:3738'
    );
  });

  it('resolveHostUrlForClient keeps pick URL for loopback clients', () => {
    const req = {
      protocol: 'http',
      headers: { host: '127.0.0.1:3738' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    assert.equal(
      resolveHostUrlForClient(req, () => 'http://10.1.2.3:3738'),
      'http://10.1.2.3:3738'
    );
  });
});
