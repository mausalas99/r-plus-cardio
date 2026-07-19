import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lanHostPriority,
  prefersLanHosting,
  prefersLanClientDiscoveryFirst,
  resolveHostElection,
  shouldAutoJoinPeerAsClient,
  shouldDeferToPeerHost,
  isClinicalRankConfiguredForLan,
  canLocalMacBeLanHost,
} from './lan-host-rank.mjs';
import { CLINICAL_LAN_PROFILE_GATE_VERSION } from './clinical-settings.mjs';
import {
  clearHostEscalation,
  ensureEscalationAnchor,
  getHostEscalationTier,
  LAN_HOST_ESCALATION_STEP_MS,
} from './lan-host-escalation.mjs';

describe('lan-host-rank', () => {
  it('rank gate and host eligibility', () => {
    const memory = new Map();
    const ls = {
      getItem(k) {
        return memory.has(k) ? memory.get(k) : null;
      },
      setItem(k, v) {
        memory.set(k, String(v));
      },
    };
    const prev = global.localStorage;
    global.localStorage = ls;
    try {
      assert.equal(isClinicalRankConfiguredForLan(), false);
      ls.setItem(
        'rpc-settings',
        JSON.stringify({
          clinicalRank: 'R1',
          clinicalLanProfileGateVersion: CLINICAL_LAN_PROFILE_GATE_VERSION,
        })
      );
      assert.equal(isClinicalRankConfiguredForLan(), true);
      assert.equal(canLocalMacBeLanHost({ rank: 'R1' }), false);
      ls.setItem(
        'rpc-settings',
        JSON.stringify({
          clinicalRank: 'R4',
          clinicalLanProfileGateVersion: CLINICAL_LAN_PROFILE_GATE_VERSION,
        })
      );
      assert.equal(canLocalMacBeLanHost({ rank: 'R4' }), true);
      assert.equal(canLocalMacBeLanHost({ rank: 'R1', isProgramAdmin: true }), true);
      clearHostEscalation();
      ls.setItem(
        'rpc-settings',
        JSON.stringify({
          clinicalRank: 'R3',
          clinicalLanProfileGateVersion: CLINICAL_LAN_PROFILE_GATE_VERSION,
        })
      );
      assert.equal(canLocalMacBeLanHost(), false);
      ensureEscalationAnchor(Date.now() - LAN_HOST_ESCALATION_STEP_MS - 1000);
      assert.equal(getHostEscalationTier(), 1);
      assert.equal(canLocalMacBeLanHost(), true);
      clearHostEscalation();
    } finally {
      global.localStorage = prev;
      clearHostEscalation();
    }
  });

  it('R4/admin prefer client discovery before auto-hosting', () => {
    assert.equal(prefersLanClientDiscoveryFirst({ rank: 'R4', isProgramAdmin: false }), true);
    assert.equal(prefersLanClientDiscoveryFirst({ rank: 'R1', isProgramAdmin: true }), true);
    assert.equal(prefersLanClientDiscoveryFirst({ rank: 'R2', isProgramAdmin: false }), false);
    assert.equal(prefersLanClientDiscoveryFirst({ rank: 'R1', isOnCallGuardia: true }), false);
  });

  it('prefers R4 and program admin for hosting', () => {
    assert.equal(prefersLanHosting({ rank: 'R4', isProgramAdmin: false }), true);
    assert.equal(prefersLanHosting({ rank: 'R2', isProgramAdmin: true }), true);
    assert.equal(prefersLanHosting({ rank: 'R3', isProgramAdmin: false }), false);
    assert.equal(prefersLanHosting({ rank: 'R1', isProgramAdmin: false }), false);
    assert.equal(prefersLanHosting({ rank: '', isProgramAdmin: false }), false);
    assert.equal(prefersLanHosting(null), false);
  });

  it('shouldAutoJoinPeerAsClient defers lower ranks to R4', () => {
    const self = { rank: 'R2', isProgramAdmin: false };
    const peer = { rank: 'R4', isProgramAdmin: false };
    assert.equal(shouldAutoJoinPeerAsClient(peer, self), true);
    assert.equal(shouldAutoJoinPeerAsClient(self, peer), false);
  });

  it('does not auto-join between equal non-host-eligible ranks', () => {
    const a = { rank: 'R2', isProgramAdmin: false };
    const b = { rank: 'R2', isProgramAdmin: false };
    assert.equal(shouldAutoJoinPeerAsClient(a, b), false);
    assert.equal(shouldDeferToPeerHost(a, b), false);
  });

  it('program admin outranks R4', () => {
    const admin = { rank: 'R1', isProgramAdmin: true };
    const r4 = { rank: 'R4', isProgramAdmin: false };
    assert.ok(lanHostPriority(admin) > lanHostPriority(r4));
    assert.equal(shouldAutoJoinPeerAsClient(admin, r4), true);
  });

  it('resolveHostElection: higher rank wins', () => {
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(
      resolveHostElection(
        { rank: 'R2', isProgramAdmin: false, startedAt: 1 },
        { rank: 'R4', isProgramAdmin: false, startedAt: 2 },
        urls
      ),
      'peer'
    );
  });

  it('resolveHostElection: admin outranks R4', () => {
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(
      resolveHostElection(
        { rank: 'R4', isProgramAdmin: false, startedAt: 1 },
        { rank: 'R1', isProgramAdmin: true, startedAt: 9 },
        urls
      ),
      'peer'
    );
  });

  it('resolveHostElection: equal priority earlier startedAt wins', () => {
    const self = { rank: 'R4', isProgramAdmin: false, startedAt: 200 };
    const peer = { rank: 'R4', isProgramAdmin: false, startedAt: 100 };
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(resolveHostElection(self, peer, urls), 'peer');
    assert.equal(resolveHostElection(peer, self, urls), 'self');
  });

  it('resolveHostElection: missing startedAt treated as later', () => {
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(
      resolveHostElection(
        { rank: 'R4', isProgramAdmin: false, startedAt: 0 },
        { rank: 'R4', isProgramAdmin: false, startedAt: 50 },
        urls
      ),
      'peer'
    );
  });

  it('resolveHostElection: URL lexicographic tiebreak', () => {
    const meta = { rank: 'R4', isProgramAdmin: false, startedAt: 1 };
    assert.equal(
      resolveHostElection(meta, meta, {
        selfUrl: 'http://10.0.0.3:3738',
        peerUrl: 'http://10.0.0.2:3738',
      }),
      'tie-peer'
    );
  });

  it('on-call R1 beats off-call R4 in election', () => {
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(
      resolveHostElection(
        { rank: 'R4', isProgramAdmin: false, isOnCallGuardia: false, startedAt: 1 },
        { rank: 'R1', isProgramAdmin: false, isOnCallGuardia: true, startedAt: 2 },
        urls
      ),
      'peer'
    );
  });

  it('on-call higher rank wins among on-call peers', () => {
    const urls = { selfUrl: 'http://10.0.0.2:3738', peerUrl: 'http://10.0.0.3:3738' };
    assert.equal(
      resolveHostElection(
        { rank: 'R1', isProgramAdmin: false, isOnCallGuardia: true, startedAt: 1 },
        { rank: 'R3', isProgramAdmin: false, isOnCallGuardia: true, startedAt: 2 },
        urls
      ),
      'peer'
    );
  });

  it('on-call residents can host without escalation', () => {
    const memory = new Map();
    const ls = {
      getItem(k) {
        return memory.has(k) ? memory.get(k) : null;
      },
      setItem(k, v) {
        memory.set(k, String(v));
      },
    };
    const prev = global.localStorage;
    global.localStorage = ls;
    try {
      ls.setItem(
        'rpc-settings',
        JSON.stringify({
          clinicalRank: 'R1',
          clinicalLanProfileGateVersion: CLINICAL_LAN_PROFILE_GATE_VERSION,
        })
      );
      clearHostEscalation();
      assert.equal(canLocalMacBeLanHost({ rank: 'R1', isOnCallGuardia: true }), true);
      assert.equal(canLocalMacBeLanHost({ rank: 'R1', isOnCallGuardia: false }), false);
    } finally {
      global.localStorage = prev;
      clearHostEscalation();
    }
  });

  it('shouldAutoJoinPeerAsClient defers off-call self to on-call peer', () => {
    const self = { rank: 'R4', isProgramAdmin: false, isOnCallGuardia: false };
    const peer = { rank: 'R2', isProgramAdmin: false, isOnCallGuardia: true };
    assert.equal(shouldAutoJoinPeerAsClient(peer, self), true);
    assert.equal(shouldAutoJoinPeerAsClient(self, peer), false);
  });

  it('prefersLanHosting includes on-call residents', () => {
    assert.equal(prefersLanHosting({ rank: 'R1', isOnCallGuardia: true }), true);
    assert.equal(prefersLanHosting({ rank: 'R1', isOnCallGuardia: false }), false);
  });
});
