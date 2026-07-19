'use strict';

const crypto = require('crypto');

const TTL_MS = 36 * 60 * 60 * 1000; // outlives any shift; in-memory only

function createClientIdentityStore({ now = Date.now } = {}) {
  /** @type {Map<string, { clientId: string, mintedAt: number }>} */
  const byToken = new Map();

  function sweep() {
    const cutoff = now() - TTL_MS;
    for (const [token, rec] of byToken.entries()) {
      if (!rec || rec.mintedAt < cutoff) byToken.delete(token);
    }
  }

  /** Mint a token bound to the client-declared id. Multiple tokens per clientId are fine (multi-exchange). */
  function issue(clientId) {
    sweep();
    const id = String(clientId || '').trim();
    if (!/^[\w.-]{4,64}$/.test(id)) return null;
    const token = 'cit_' + crypto.randomBytes(16).toString('hex');
    byToken.set(token, { clientId: id, mintedAt: now() });
    return token;
  }

  /** @returns {string} bound clientId or '' */
  function resolve(token) {
    sweep();
    const rec = byToken.get(String(token || ''));
    return rec ? rec.clientId : '';
  }

  return { issue, resolve, sweep };
}

module.exports = { createClientIdentityStore, TTL_MS };
