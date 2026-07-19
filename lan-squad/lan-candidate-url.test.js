'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  pickLanCandidateBaseUrl,
  isLoopbackLanHost,
  listPrivateIpv4SubnetPrefixes,
  subnetPrefixFromIpv4,
} = require('./lan-candidate-url.js');

describe('lan-candidate-url', () => {
  it('pickLanCandidateBaseUrl returns http URL or empty', () => {
    const url = pickLanCandidateBaseUrl(3738);
    if (url) {
      assert.match(url, /^http:\/\/\d+\.\d+\.\d+\.\d+:3738$/);
    }
  });

  it('isLoopbackLanHost detects localhost', () => {
    assert.equal(isLoopbackLanHost('localhost'), true);
    assert.equal(isLoopbackLanHost('127.0.0.1'), true);
    assert.equal(isLoopbackLanHost('10.0.0.5'), false);
  });

  it('subnetPrefixFromIpv4 returns /24 prefix', () => {
    assert.equal(subnetPrefixFromIpv4('10.102.32.207'), '10.102.32');
  });

  it('listPrivateIpv4SubnetPrefixes returns string array', () => {
    const prefixes = listPrivateIpv4SubnetPrefixes();
    assert.ok(Array.isArray(prefixes));
    for (const p of prefixes) {
      assert.match(p, /^\d+\.\d+\.\d+$/);
    }
  });
});
