export function parseWsPayload(s) {
  try {
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

/** Avoid "closed before connection is established" when replacing a CONNECTING socket. */
function safeCloseWebSocket(ws) {
  if (!ws) return;
  try {
    const state = ws.readyState;
    if (state === WebSocket.CONNECTING) {
      ws.onopen = () => {
        try {
          ws.close();
        } catch (_e) { void _e; }
      };
      return;
    }
    if (state === WebSocket.OPEN) {
      ws.close();
    }
  } catch (_e) { void _e; }
}

function syncConnectBackoffMs(attempt) {
  return Math.min(30000, 500 * Math.pow(2, Math.min(Math.max(0, attempt), 6)));
}

export class LanClient extends EventTarget {
  constructor() {
    super();
    this._syncWs = null;
    this._liveWs = null;
    this._liveRoomId = null;
    this._cfg = null;
    this._syncConnected = false;
    this._liveConnected = false;
    this._syncConnectAttempt = 0;
    this._syncLastConnectAt = 0;
  }

  /** Compat: canal sync (presencia / pacientes). */
  get connected() {
    return this._syncConnected;
  }

  get liveConnected() {
    return this._liveConnected;
  }

  get liveRoomId() {
    return this._liveRoomId;
  }

  /** true si el canal live de esta sala está conectando o abierto (evita reconexiones que lo cortan). */
  isLiveChannelBusy(roomId) {
    const want = String(roomId || '').trim();
    const have = String(this._liveRoomId || '').trim();
    const ws = this._liveWs;
    if (!ws) return false;
    const rs = ws.readyState;
    if (rs !== WebSocket.CONNECTING && rs !== WebSocket.OPEN) return false;
    return !want || want === have;
  }

  /** Canal sync en CONNECTING/OPEN — evita abrir otro socket mientras uno está activo. */
  isSyncChannelBusy() {
    const ws = this._syncWs;
    if (!ws) return false;
    const rs = ws.readyState;
    return rs === WebSocket.CONNECTING || rs === WebSocket.OPEN;
  }

  _isSyncConnectThrottled() {
    if (!this._syncLastConnectAt) return false;
    return Date.now() - this._syncLastConnectAt < syncConnectBackoffMs(this._syncConnectAttempt);
  }

  configure(cfg) {
    this._cfg = cfg;
  }

  baseUrl() {
    const c = this._cfg;
    if (!c || !c.hostUrl) return '';
    return String(c.hostUrl).replace(/\/$/, '');
  }

  _bearerToken() {
    const fromCfg = this._cfg ? String(this._cfg.teamCode ?? '').trim() : '';
    if (fromCfg) return fromCfg;
    try {
      return String(localStorage.getItem('rplus.lan.bearer') || '').trim();
    } catch {
      return '';
    }
  }

  async fetch(path, opts = {}) {
    const url = `${this.baseUrl()}${path}`;
    const token = this._bearerToken();
    const headers = {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return fetch(url, { ...opts, headers });
  }

  /** WebSocket de presencia / notificaciones LAN; no es el relay `live:*` de salas. */
  connectSyncChannel() {
    if (!this.baseUrl() || !this._bearerToken()) return;
    if (this.isSyncChannelBusy()) return;
    if (this._isSyncConnectThrottled()) return;
    this._syncLastConnectAt = Date.now();
    this._openChannelWs('sync', '_syncWs', 'sync');
  }

  connectLiveChannel(roomId) {
    const id = String(roomId || '').trim();
    if (!id) return;
    if (this.isLiveChannelBusy(id)) return;
    this._liveRoomId = id;
    const ch = `live:${encodeURIComponent(id)}`;
    this._openChannelWs(ch, '_liveWs', 'live');
  }

  disconnectLiveChannel() {
    if (this._liveWs) {
      safeCloseWebSocket(this._liveWs);
      this._liveWs = null;
    }
    this._liveConnected = false;
    this._liveRoomId = null;
  }

  disconnect() {
    this.disconnectLiveChannel();
    if (this._syncWs) {
      safeCloseWebSocket(this._syncWs);
      this._syncWs = null;
    }
    this._syncConnected = false;
    this._syncConnectAttempt = 0;
    this._syncLastConnectAt = 0;
  }

  sendLive(obj) {
    if (!this._liveWs || this._liveWs.readyState !== 1) return false;
    try {
      this._liveWs.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  _openChannelWs(channel, prop, kind) {
    const prev = this[prop];
    if (prev) {
      safeCloseWebSocket(prev);
    }
    const base = this.baseUrl().replace(/^http/, 'ws');
    const u = `${base}/api/lan/v1/ws?channel=${encodeURIComponent(channel)}`;
    const ws = new WebSocket(u);
    this[prop] = ws;
    const token = this._bearerToken();

    ws.onopen = () => {
      if (this[prop] !== ws) return;
      try {
        ws.send(JSON.stringify({ type: 'auth', token }));
      } catch (_e) { void _e; }
      if (kind === 'sync') {
        this._syncConnectAttempt = 0;
        this._syncConnected = true;
        this.dispatchEvent(new CustomEvent('lan-status', { detail: { connected: true, channel: 'sync' } }));
      } else {
        this._liveConnected = true;
        this.dispatchEvent(
          new CustomEvent('lan-live-status', { detail: { connected: true, roomId: this._liveRoomId } })
        );
      }
    };

    ws.onerror = () => {
      if (this[prop] !== ws) return;
      if (kind === 'sync') {
        this._syncConnectAttempt += 1;
      }
    };

    ws.onclose = () => {
      if (this[prop] !== ws) return;
      if (kind === 'sync') {
        if (!this._syncConnected) {
          this._syncConnectAttempt += 1;
        }
        this._syncConnected = false;
        if (this[prop] === ws) {
          this[prop] = null;
        }
        this.dispatchEvent(new CustomEvent('lan-status', { detail: { connected: false, channel: 'sync' } }));
      } else {
        this._liveConnected = false;
        this.dispatchEvent(
          new CustomEvent('lan-live-status', { detail: { connected: false, roomId: this._liveRoomId } })
        );
      }
    };

    ws.onmessage = (ev) => {
      if (this[prop] !== ws) return;
      const data = parseWsPayload(ev.data);
      if (!data) return;
      if (kind === 'sync') {
        this.dispatchEvent(new CustomEvent('lan-patch', { detail: data }));
      } else {
        this._dispatchLivePayload(data);
      }
    };
  }

  _dispatchLivePayload(data) {
    if (!data) return;
    if (data.type === 'livesync:conflict') {
      this.dispatchEvent(new CustomEvent('lan-conflict', { detail: data }));
      return;
    }
    if (data.type === 'livesync:applied') {
      this.dispatchEvent(new CustomEvent('lan-applied', { detail: data }));
      return;
    }
    this.dispatchEvent(new CustomEvent('lan-live', { detail: data }));
  }
}
