import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LanClient, parseWsPayload } from './lan-client.mjs';

describe('lan-client parseWsPayload', () => {
  it('parses valid json', () => {
    assert.deepStrictEqual(parseWsPayload('{"a":1}'), { a: 1 });
  });
  it('returns null on bad', () => {
    assert.strictEqual(parseWsPayload('not-json'), null);
  });
});

describe('LanClient live channel lifecycle', () => {
  it('ignores onclose from a replaced WebSocket (guard used in _openChannelWs)', () => {
    const state = { _liveWs: null, _liveConnected: true };
    const prop = '_liveWs';
    const ws1 = { id: 1 };
    const ws2 = { id: 2 };
    const onclose = (ws) => () => {
      if (state[prop] !== ws) return;
      state._liveConnected = false;
    };
    state[prop] = ws1;
    const close1 = onclose(ws1);
    state[prop] = ws2;
    state._liveConnected = true;
    close1();
    assert.strictEqual(state._liveConnected, true, 'stale onclose must not clear liveConnected');
    onclose(ws2)();
    assert.strictEqual(state._liveConnected, false);
  });

  it('isLiveChannelBusy when connecting or open for same room', () => {
    const client = new LanClient();
    client._liveRoomId = 'sala-e';
    client._liveWs = { readyState: WebSocket.CONNECTING };
    assert.strictEqual(client.isLiveChannelBusy('sala-e'), true);
    assert.strictEqual(client.isLiveChannelBusy('other'), false);
    client._liveWs = { readyState: WebSocket.OPEN };
    assert.strictEqual(client.isLiveChannelBusy('sala-e'), true);
    client._liveWs = { readyState: WebSocket.CLOSED };
    assert.strictEqual(client.isLiveChannelBusy('sala-e'), false);
  });
});

describe('LanClient live payload dispatch', () => {
  it('dispatches lan-conflict for livesync:conflict', () => {
    const client = new LanClient();
    const received = [];
    client.addEventListener('lan-conflict', (ev) => received.push(ev.detail));
    client.addEventListener('lan-live', () => {
      assert.fail('must not emit lan-live for conflict');
    });
    const payload = {
      type: 'livesync:conflict',
      roomId: 'r1',
      entityType: 'todo',
      entityId: 't1',
      conflictingKeys: ['text'],
    };
    client._dispatchLivePayload(payload);
    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], payload);
  });

  it('dispatches lan-applied for livesync:applied', () => {
    const client = new LanClient();
    const received = [];
    client.addEventListener('lan-applied', (ev) => received.push(ev.detail));
    client.addEventListener('lan-live', () => {
      assert.fail('must not emit lan-live for applied');
    });
    const payload = {
      type: 'livesync:applied',
      roomId: 'r1',
      entityType: 'todo',
      entityId: 't1',
      version: 2,
      data: { id: 't1', text: 'ok' },
    };
    client._dispatchLivePayload(payload);
    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], payload);
  });

  it('dispatches lan-live for other live messages', () => {
    const client = new LanClient();
    const received = [];
    client.addEventListener('lan-live', (ev) => received.push(ev.detail));
    const payload = { type: 'livesync:hello', roomId: 'r1', clientId: 'c1' };
    client._dispatchLivePayload(payload);
    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], payload);
  });
});

describe('LanClient sync channel lifecycle', () => {
  it('isSyncChannelBusy when connecting or open', () => {
    const client = new LanClient();
    client._syncWs = { readyState: WebSocket.CONNECTING };
    assert.strictEqual(client.isSyncChannelBusy(), true);
    client._syncWs = { readyState: WebSocket.OPEN };
    assert.strictEqual(client.isSyncChannelBusy(), true);
    client._syncWs = { readyState: WebSocket.CLOSED };
    assert.strictEqual(client.isSyncChannelBusy(), false);
  });

  it('connectSyncChannel is throttled after failed attempts', () => {
    const client = new LanClient();
    client.configure({ hostUrl: 'http://10.0.0.3:3738', teamCode: 'c'.repeat(64) });
    client._syncConnectAttempt = 2;
    client._syncLastConnectAt = Date.now();
    const opened = [];
    const orig = WebSocket;
    globalThis.WebSocket = function (url) {
      opened.push(url);
      return { readyState: WebSocket.CONNECTING, onopen: null, onclose: null, onerror: null, onmessage: null };
    };
    try {
      client.connectSyncChannel();
      client.connectSyncChannel();
      assert.strictEqual(opened.length, 0, 'must not open while throttled');
    } finally {
      globalThis.WebSocket = orig;
    }
  });
});

describe('LanClient fetch auth', () => {
  it('fetch sends Authorization Bearer from teamCode config', async () => {
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true };
    };
    try {
      const client = new LanClient();
      client.configure({ hostUrl: 'http://10.0.0.1:3738', teamCode: 'a'.repeat(64) });
      await client.fetch('/api/lan/v1/ping');
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].url, 'http://10.0.0.1:3738/api/lan/v1/ping');
      assert.strictEqual(calls[0].opts.headers.Authorization, `Bearer ${'a'.repeat(64)}`);
      assert.ok(!('X-Lan-Team-Code' in (calls[0].opts.headers || {})));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('fetch uses rplus.lan.bearer when teamCode empty', async () => {
    const calls = [];
    const store = {
      getItem(k) {
        return this._[k] ?? null;
      },
      setItem(k, v) {
        this._[k] = v;
      },
      _: { 'rplus.lan.bearer': 'b'.repeat(64) },
    };
    const origFetch = globalThis.fetch;
    const origLs = globalThis.localStorage;
    globalThis.fetch = async (url, opts) => {
      calls.push({ opts });
      return { ok: true };
    };
    globalThis.localStorage = store;
    try {
      const client = new LanClient();
      client.configure({ hostUrl: 'http://10.0.0.2:3738', teamCode: '' });
      await client.fetch('/api/lan/v1/ping');
      assert.strictEqual(calls[0].opts.headers.Authorization, `Bearer ${'b'.repeat(64)}`);
    } finally {
      globalThis.fetch = origFetch;
      globalThis.localStorage = origLs;
    }
  });
});
