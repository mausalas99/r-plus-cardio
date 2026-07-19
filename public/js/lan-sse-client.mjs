/**
 * Fetch-based SSE client (not EventSource) — supports custom Authorization header.
 * Required because browser EventSource cannot set headers; Electron's Chromium
 * fetch() + ReadableStream supports async iteration over the response body.
 */

/**
 * Parse one SSE line. Returns parsed object or null.
 * @param {string} line
 * @returns {object|null}
 */
export function parseSseLine(line) {
  const s = String(line || '').trim();
  if (!s || s.startsWith(':')) return null;
  if (s.startsWith('data:')) {
    const json = s.slice(5).trim();
    try { return JSON.parse(json); } catch { return null; }
  }
  return null;
}

/**
 * Async generator: yields lines from a ReadableStream in text/event-stream format.
 * @param {ReadableStream} body
 */
export async function* readEventStreamLines(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        yield line;
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (_e) { void _e; }
  }
}

export class LanSseClient {
  constructor() {
    this._ctrl = null;
  }

  /**
   * @param {string} baseUrl
   * @param {string} teamCode
   * @param {string} channel — 'sync' or 'live:{roomId}'
   * @param {(ev: object) => void} onEvent
   * @param {AbortSignal} [signal]
   */
  async connect(baseUrl, teamCode, channel, onEvent, signal) {
    this._ctrl = new AbortController();
    const signals = [this._ctrl.signal];
    if (signal) signals.push(signal);
    const combinedSignal = signals.length === 1
      ? signals[0]
      : (() => {
          const ctrl = new AbortController();
          signals.forEach((s) => s.addEventListener('abort', () => ctrl.abort(), { once: true }));
          return ctrl.signal;
        })();

    const url = `${String(baseUrl).replace(/\/+$/, '')}/api/lan/v1/sse?channel=${encodeURIComponent(channel)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${teamCode}` },
      signal: combinedSignal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`sse_connect_failed:${res.status}`);
    }
    for await (const line of readEventStreamLines(res.body)) {
      const ev = parseSseLine(line);
      if (ev && typeof onEvent === 'function') onEvent(ev);
    }
  }

  disconnect() {
    if (this._ctrl) {
      this._ctrl.abort();
      this._ctrl = null;
    }
  }
}
