import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAN_HOST_ESCALATION_STEP_MS,
  clearHostEscalation,
  ensureEscalationAnchor,
  getHostEscalationTier,
  canRankHostAtEscalationTier,
  markWardTierHostSeen,
  minHostRankPriorityForTier,
  updateLanHostEscalationFromPeerMetas,
} from './lan-host-escalation.mjs';

describe('lan-host-escalation', () => {
  const memory = new Map();
  const ls = {
    getItem(k) {
      return memory.has(k) ? memory.get(k) : null;
    },
    setItem(k, v) {
      memory.set(k, String(v));
    },
    removeItem(k) {
      memory.delete(k);
    },
  };

  it('steps R4 → R3 → R2 → R1 every 10 minutes without ward host', () => {
    const prev = global.localStorage;
    global.localStorage = ls;
    clearHostEscalation();
    try {
      const t0 = 1_700_000_000_000;
      ensureEscalationAnchor(t0);
      assert.equal(getHostEscalationTier(t0 + 1000), 0);
      assert.equal(canRankHostAtEscalationTier({ rank: 'R3' }, 0), false);
      assert.equal(
        canRankHostAtEscalationTier({ rank: 'R3' }, 1),
        true
      );
      assert.equal(
        getHostEscalationTier(t0 + LAN_HOST_ESCALATION_STEP_MS + 1),
        1
      );
      assert.equal(
        canRankHostAtEscalationTier({ rank: 'R2' }, 1),
        false
      );
      assert.equal(
        getHostEscalationTier(t0 + 2 * LAN_HOST_ESCALATION_STEP_MS + 1),
        2
      );
      assert.equal(
        canRankHostAtEscalationTier({ rank: 'R2' }, 2),
        true
      );
      assert.equal(
        getHostEscalationTier(t0 + 3 * LAN_HOST_ESCALATION_STEP_MS + 1),
        3
      );
      assert.equal(
        canRankHostAtEscalationTier({ rank: 'R1' }, 3),
        true
      );
      markWardTierHostSeen(t0 + 5000);
      assert.equal(getHostEscalationTier(t0 + 3 * LAN_HOST_ESCALATION_STEP_MS), 0);
    } finally {
      global.localStorage = prev;
      clearHostEscalation();
    }
  });

  it('minHostRankPriorityForTier maps tiers to ranks', () => {
    assert.equal(minHostRankPriorityForTier(0), 4);
    assert.equal(minHostRankPriorityForTier(1), 3);
    assert.equal(minHostRankPriorityForTier(2), 2);
    assert.equal(minHostRankPriorityForTier(3), 1);
  });

  it('on-call peer meta resets escalation anchor like ward-tier host', () => {
    const prev = global.localStorage;
    global.localStorage = ls;
    clearHostEscalation();
    try {
      const t0 = 1_700_000_000_000;
      ensureEscalationAnchor(t0);
      updateLanHostEscalationFromPeerMetas(
        [{ rank: 'R1', isOnCallGuardia: true }],
        t0 + LAN_HOST_ESCALATION_STEP_MS + 1
      );
      assert.equal(getHostEscalationTier(t0 + LAN_HOST_ESCALATION_STEP_MS + 1), 0);
    } finally {
      global.localStorage = prev;
      clearHostEscalation();
    }
  });
});
