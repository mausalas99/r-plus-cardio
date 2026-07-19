'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldInjectLanCors, isPrivateLanHost } = require('./electron-lan-cors.cjs');

describe('electron-lan-cors', () => {
  it('isPrivateLanHost accepts ward subnets and loopback', () => {
    assert.equal(isPrivateLanHost('10.0.57.52'), true);
    assert.equal(isPrivateLanHost('192.168.1.4'), true);
    assert.equal(isPrivateLanHost('localhost'), true);
    assert.equal(isPrivateLanHost('8.8.8.8'), false);
  });

  it('shouldInjectLanCors matches private LAN API URLs on 3738', () => {
    assert.equal(
      shouldInjectLanCors('http://10.0.57.52:3738/api/lan/v1/rooms/sala-2/sync-bundle'),
      true
    );
    assert.equal(shouldInjectLanCors('http://10.0.57.52:3738/health'), false);
    assert.equal(shouldInjectLanCors('http://8.8.8.8:3738/api/lan/v1/ping'), false);
  });
});
