/**
 * LanConnectionManager — transparent WS → SSE → HTTP-poll fallback.
 *
 * Mirrors LanClient's EventTarget events (lan-patch, lan-live, lan-status,
 * lan-live-status) so panel.mjs / orchestrator.mjs need no handler rewrites.
 *
 * State machine:
 *   WS (default) → SSE (≥3 consecutive WS sync failures)
 *   SSE → POLL   (SSE connect fails × 2)
 *   * → WS       (WS connects successfully)
 */

const POLL_INTERVAL_MS = 15_000;
const WS_FAIL_THRESHOLD = 3;
const SSE_FAIL_THRESHOLD = 2;

/** @param {Map<string, Function[]>} eventListeners @param {object} lanClient */
function createLanTransportEmit(eventListeners, lanClient) {
  function emit(event, detail) {
    const cbs = eventListeners.get(event) || [];
    cbs.forEach((cb) => { try { cb({ detail }); } catch (_e) { void _e; } });
  }

  function addEventListener(event, cb) {
    if (!eventListeners.has(event)) eventListeners.set(event, []);
    eventListeners.get(event).push(cb);
    lanClient.addEventListener(event, cb);
  }

  return { emit, addEventListener };
}

/** @param {object} ctx */
function createSseTransport(ctx) {
  const { sseClientFactory, emit, getState } = ctx;

  function stopSse() {
    const st = getState();
    if (st.sseRetryTimer) { clearTimeout(st.sseRetryTimer); st.sseRetryTimer = null; }
    if (st.sseClient) { try { st.sseClient.disconnect(); } catch (_e) { void _e; } st.sseClient = null; }
  }

  async function connectSse() {
    stopSse();
    const st = getState();
    st.sseClient = sseClientFactory();
    try {
      await st.sseClient.connect(st.hostUrl, st.teamCode, 'sync', (ev) => {
        emit('lan-patch', ev);
      });
    } catch {
      st.sseFailCount++;
      if (st.sseFailCount >= SSE_FAIL_THRESHOLD) {
        ctx.transitionToPoll();
      } else {
        st.sseRetryTimer = setTimeout(connectSse, 2000);
        if (typeof st.sseRetryTimer.unref === 'function') st.sseRetryTimer.unref();
      }
    }
  }

  return { connectSse, stopSse };
}

/** @param {object} ctx */
function createPollTransport(ctx) {
  const { emit, getState } = ctx;

  function stopPoll() {
    const st = getState();
    if (st.pollTimer) { clearInterval(st.pollTimer); st.pollTimer = null; }
  }

  function startPoll() {
    stopPoll();
    const st = getState();
    st.pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`${st.hostUrl}/api/lan/v1/health`, {
          headers: { Authorization: `Bearer ${st.teamCode}` },
        });
        if (res.ok) {
          const data = await res.json();
          emit('lan-patch', { type: 'livesync:poll', ...data });
        }
      } catch (_e) { void _e; }
    }, POLL_INTERVAL_MS);
    if (typeof st.pollTimer.unref === 'function') st.pollTimer.unref();
  }

  return { startPoll, stopPoll };
}

/**
 * @param {{ lanClient: object, sseClientFactory: () => object }} opts
 */
export function createLanConnectionManager({ lanClient, sseClientFactory }) {
  const state = {
    transport: 'ws',
    hostUrl: '',
    teamCode: '',
    wsFailCount: 0,
    sseFailCount: 0,
    sseClient: null,
    sseRetryTimer: null,
    pollTimer: null,
  };
  const eventListeners = new Map();
  const { emit, addEventListener } = createLanTransportEmit(eventListeners, lanClient);

  const ctx = {
    sseClientFactory,
    emit,
    getState: () => state,
    transitionToPoll: null,
    transitionToSse: null,
  };

  const sse = createSseTransport(ctx);
  const poll = createPollTransport(ctx);

  function transitionToSse() {
    if (state.transport === 'sse') return;
    state.transport = 'sse';
    void sse.connectSse();
  }

  function transitionToPoll() {
    if (state.transport === 'poll') return;
    state.transport = 'poll';
    sse.stopSse();
    poll.startPoll();
  }

  function transitionToWs() {
    state.transport = 'ws';
    state.wsFailCount = 0;
    state.sseFailCount = 0;
    sse.stopSse();
    poll.stopPoll();
  }

  ctx.transitionToPoll = transitionToPoll;
  ctx.transitionToSse = transitionToSse;

  lanClient.addEventListener('lan-status', ({ detail }) => {
    if (!detail) return;
    if (detail.connected) {
      transitionToWs();
    } else if (detail.channel === 'sync') {
      state.wsFailCount++;
      if (state.transport === 'ws' && state.wsFailCount >= WS_FAIL_THRESHOLD) {
        transitionToSse();
      }
    }
  });

  function connect(hostUrl, teamCode) {
    state.hostUrl = String(hostUrl || '');
    state.teamCode = String(teamCode || '');
    lanClient.configure({ hostUrl: state.hostUrl, teamCode: state.teamCode });
    lanClient.connectSyncChannel();
  }

  function disconnect() {
    lanClient.disconnect();
    sse.stopSse();
    poll.stopPoll();
    state.transport = 'ws';
    state.wsFailCount = 0;
    state.sseFailCount = 0;
  }

  function getTransport() { return state.transport; }

  function _simulateSseFailure() {
    state.sseFailCount++;
    if (state.sseFailCount >= SSE_FAIL_THRESHOLD) transitionToPoll();
  }

  return { connect, disconnect, addEventListener, getTransport, _simulateSseFailure };
}
