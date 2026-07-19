'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  lanNetworkFingerprint,
  createLanNetworkWatch,
} = require('./lan-network-watch.js');

describe('lan-network-watch', () => {
  it('lanNetworkFingerprint is stable for same inputs', () => {
    const a = lanNetworkFingerprint(['10.2.1', '10.1.2'], 'http://10.1.2.3:3738');
    const b = lanNetworkFingerprint(['10.1.2', '10.2.1'], 'http://10.1.2.3:3738');
    assert.equal(a, b);
  });

  it('createLanNetworkWatch emits after fingerprint change', () => {
    const events = [];
    let prefixes = ['10.0.0'];
    let candidate = 'http://10.0.0.2:3738';
    const watch = createLanNetworkWatch((payload) => events.push(payload), {
      intervalMs: 60000,
      readPrefixes: () => prefixes,
      readCandidate: () => candidate,
    });
    watch.pollOnce();
    assert.equal(events.length, 0);
    prefixes = ['10.0.1'];
    candidate = 'http://10.0.1.4:3738';
    watch.pollOnce();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].prefixes, ['10.0.1']);
    assert.equal(events[0].candidateBaseUrl, 'http://10.0.1.4:3738');
    assert.deepEqual(events[0].prevPrefixes, ['10.0.0']);
    assert.equal(events[0].prevCandidateBaseUrl, 'http://10.0.0.2:3738');
    watch.stop();
  });
});
