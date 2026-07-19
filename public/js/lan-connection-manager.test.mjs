// public/js/lan-connection-manager.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLanConnectionManager } from './lan-connection-manager.mjs';

describe('LanConnectionManager state machine', () => {
  it('starts in WS state', () => {
    const mgr = createLanConnectionManager({ lanClient: _fakeLanClient(), sseClientFactory: () => _fakeSseClient() });
    assert.equal(mgr.getTransport(), 'ws');
  });

  it('transitions to SSE after 3 consecutive WS failures', () => {
    const client = _fakeLanClient();
    const mgr = createLanConnectionManager({ lanClient: client, sseClientFactory: () => _fakeSseClient() });
    mgr.connect('http://10.0.0.1:3738', 'tok');
    client._simulateFailure();
    client._simulateFailure();
    client._simulateFailure();
    assert.equal(mgr.getTransport(), 'sse');
  });

  it('transitions to POLL after SSE fails twice', () => {
    const client = _fakeLanClient();
    const sseFactory = () => _fakeSseClient({ failOnConnect: true });
    const mgr = createLanConnectionManager({ lanClient: client, sseClientFactory: sseFactory });
    mgr.connect('http://10.0.0.1:3738', 'tok');
    client._simulateFailure(); client._simulateFailure(); client._simulateFailure();
    assert.equal(mgr.getTransport(), 'sse');
    mgr._simulateSseFailure(); mgr._simulateSseFailure();
    assert.equal(mgr.getTransport(), 'poll');
  });

  it('recovers to WS when WS reconnects successfully', () => {
    const client = _fakeLanClient();
    const mgr = createLanConnectionManager({ lanClient: client, sseClientFactory: () => _fakeSseClient() });
    mgr.connect('http://10.0.0.1:3738', 'tok');
    client._simulateFailure(); client._simulateFailure(); client._simulateFailure();
    assert.equal(mgr.getTransport(), 'sse');
    client._simulateSuccess();
    assert.equal(mgr.getTransport(), 'ws');
  });
});

function _fakeLanClient() {
  const listeners = {};
  let attempts = 0;
  return {
    configure() {},
    connectSyncChannel() {},
    disconnect() {},
    addEventListener(ev, cb) { listeners[ev] = (listeners[ev] || []); listeners[ev].push(cb); },
    _emit(ev, detail) { (listeners[ev] || []).forEach((cb) => cb({ detail })); },
    _simulateFailure() {
      attempts++;
      this._emit('lan-status', { connected: false, channel: 'sync' });
    },
    _simulateSuccess() {
      attempts = 0;
      this._emit('lan-status', { connected: true, channel: 'sync' });
    },
    get _syncConnectAttempt() { return attempts; },
  };
}

function _fakeSseClient({ failOnConnect = false } = {}) {
  return {
    async connect() { if (failOnConnect) throw new Error('sse_fail'); },
    disconnect() {},
  };
}
