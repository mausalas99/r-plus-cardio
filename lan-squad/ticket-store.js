'use strict';

const crypto = require('node:crypto');

const TTL_MS = 5 * 60 * 1000;
const PIN_MIN = 100000;
const PIN_MAX = 999999;
const MAX_PIN_COLLISION_ATTEMPTS = 10;

function createTicketStore({ getHostToken }) {
  if (typeof getHostToken !== 'function') {
    throw new Error('createTicketStore requires getHostToken');
  }

  const tickets = new Map();
  const pins = new Map();

  function removeRecord(record) {
    tickets.delete(record.ticketId);
    pins.delete(record.pin);
  }

  function sweep() {
    const now = Date.now();
    for (const record of tickets.values()) {
      if (record.expiresAt <= now || record.used) {
        removeRecord(record);
      }
    }
  }

  function mintUniquePin() {
    for (let i = 0; i < MAX_PIN_COLLISION_ATTEMPTS; i++) {
      const pin = String(crypto.randomInt(PIN_MIN, PIN_MAX + 1));
      if (!pins.has(pin)) return pin;
    }
    throw new Error('Could not mint unique PIN');
  }

  function mint() {
    sweep();
    const ticketId = 'req_' + crypto.randomBytes(6).toString('hex');
    const pin = mintUniquePin();
    const expiresAt = Date.now() + TTL_MS;
    const record = { ticketId, pin, expiresAt, used: false };
    tickets.set(ticketId, record);
    pins.set(pin, ticketId);
    return {
      ticketId,
      pin,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  function exchange({ ticket, pin } = {}) {
    sweep();
    let ticketId = '';
    if (ticket) {
      ticketId = String(ticket).trim();
    } else if (pin) {
      ticketId = pins.get(String(pin).trim()) || '';
    } else {
      return null;
    }
    if (!ticketId) return null;

    const record = tickets.get(ticketId);
    if (!record || record.used) return null;

    if (record.expiresAt <= Date.now()) {
      removeRecord(record);
      return null;
    }

    record.used = true;
    removeRecord(record);
    return { token: getHostToken() };
  }

  return { mint, exchange, sweep };
}

module.exports = { createTicketStore, TTL_MS };
