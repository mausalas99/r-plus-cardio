/**
 * LAN network profile — 3-state RTT machine (fast / slow / offline).
 *
 * Thresholds and hysteresis:
 *   FAST → SLOW  : RTT > 500ms for 3 consecutive pings
 *   SLOW → FAST  : RTT < 200ms for 5 consecutive pings  (resets on any slow ping)
 *   FAST → OFFLINE: ping failure × 5 consecutive
 *   SLOW → OFFLINE: ping failure × 3 consecutive
 *   OFFLINE → * : only via userInitiatedReconnect()
 */

const RTT_SLOW_THRESHOLD_MS = 500;
const RTT_FAST_THRESHOLD_MS = 200;
const FAST_TO_SLOW_COUNT = 3;
const SLOW_TO_FAST_COUNT = 5;
const FAST_TO_OFFLINE_FAIL_COUNT = 5;
const SLOW_TO_OFFLINE_FAIL_COUNT = 3;

/** @param {object} state @param {(profile: string) => void} notify */
function createPingHandlers(state, notify) {
  function transition(newProfile) {
    if (newProfile === state.profile) return;
    state.profile = newProfile;
    state.consecutiveSlowCount = 0;
    state.consecutiveFastCount = 0;
    state.consecutiveFailCount = 0;
    notify(state.profile);
  }

  function recordPingSuccess(rttMs) {
    if (state.profile === 'offline') return;
    state.lastRttMs = Number(rttMs) || 0;
    state.consecutiveFailCount = 0;

    if (rttMs > RTT_SLOW_THRESHOLD_MS) {
      state.consecutiveSlowCount++;
      state.consecutiveFastCount = 0;
      if (state.profile === 'fast' && state.consecutiveSlowCount >= FAST_TO_SLOW_COUNT) {
        transition('slow');
      }
    } else if (rttMs < RTT_FAST_THRESHOLD_MS) {
      state.consecutiveFastCount++;
      state.consecutiveSlowCount = 0;
      if (state.profile === 'slow' && state.consecutiveFastCount >= SLOW_TO_FAST_COUNT) {
        transition('fast');
      }
    } else {
      state.consecutiveFastCount = 0;
      state.consecutiveSlowCount = 0;
    }
  }

  function recordPingFailure() {
    if (state.profile === 'offline') return;
    state.consecutiveFailCount++;
    state.consecutiveSlowCount = 0;
    state.consecutiveFastCount = 0;
    const threshold =
      state.profile === 'slow' ? SLOW_TO_OFFLINE_FAIL_COUNT : FAST_TO_OFFLINE_FAIL_COUNT;
    if (state.consecutiveFailCount >= threshold) {
      transition('offline');
    }
  }

  return { transition, recordPingSuccess, recordPingFailure };
}

/** @param {object} state @param {(profile: string) => void} notify */
function createReconnectHandlers(state, notify) {
  function userInitiatedReconnect() {
    return new Promise(function (resolve) {
      if (state.profile !== 'offline') {
        resolve(state.profile);
        return;
      }
      state.reconnectResolve = resolve;
    });
  }

  function _simulatePingResult(ok, rttMs) {
    if (ok) {
      state.profile = rttMs <= RTT_SLOW_THRESHOLD_MS ? 'fast' : 'slow';
      state.lastRttMs = Number(rttMs) || 0;
      state.consecutiveFailCount = 0;
      const newProfile = state.profile;
      notify(newProfile);
      if (state.reconnectResolve) {
        state.reconnectResolve(newProfile);
        state.reconnectResolve = null;
      }
    } else if (state.reconnectResolve) {
      state.reconnectResolve('offline');
      state.reconnectResolve = null;
    }
  }

  function resetProfile() {
    state.profile = 'fast';
    state.consecutiveSlowCount = 0;
    state.consecutiveFastCount = 0;
    state.consecutiveFailCount = 0;
    state.lastRttMs = 0;
    if (state.reconnectResolve) {
      state.reconnectResolve('fast');
      state.reconnectResolve = null;
    }
  }

  return { userInitiatedReconnect, _simulatePingResult, resetProfile };
}

export function createNetworkProfile() {
  const state = {
    profile: 'fast',
    consecutiveSlowCount: 0,
    consecutiveFastCount: 0,
    consecutiveFailCount: 0,
    lastRttMs: 0,
    reconnectResolve: null,
  };
  const subscribers = new Set();

  function notify(newProfile) {
    for (const cb of subscribers) {
      try { cb(newProfile); } catch (_e) { void _e; }
    }
  }

  const ping = createPingHandlers(state, notify);
  const reconnect = createReconnectHandlers(state, notify);

  return {
    recordPingSuccess: ping.recordPingSuccess,
    recordPingFailure: ping.recordPingFailure,
    recordRttSample: ping.recordPingSuccess,
    getNetworkProfile: () => state.profile,
    getLastRttMs: () => state.lastRttMs,
    subscribeNetworkProfile(cb) {
      subscribers.add(cb);
      return function unsubscribe() { subscribers.delete(cb); };
    },
    userInitiatedReconnect: reconnect.userInitiatedReconnect,
    resetProfile: reconnect.resetProfile,
    _simulatePingResult: reconnect._simulatePingResult,
  };
}

/** Production singleton. Wired in orchestrator.mjs / panel.mjs at boot. */
export const lanNetworkProfile = createNetworkProfile();
