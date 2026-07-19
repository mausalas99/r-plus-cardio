'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isRecoverableMdnsError, hasLanInterfaceForMdns } = require('./lan-mdns-service.js');

describe('lan-mdns-service', () => {
  it('isRecoverableMdnsError treats EADDRNOTAVAIL as recoverable', () => {
    assert.equal(isRecoverableMdnsError({ code: 'EADDRNOTAVAIL' }), true);
    assert.equal(isRecoverableMdnsError({ code: 'ENOENT' }), false);
  });

  it('hasLanInterfaceForMdns accepts explicit host URL', () => {
    assert.equal(hasLanInterfaceForMdns('http://10.0.0.5:3738'), true);
    assert.equal(hasLanInterfaceForMdns(''), !!require('./lan-candidate-url.js').pickLanCandidateBaseUrl());
  });
});
