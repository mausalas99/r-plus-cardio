'use strict';

const { endOfCalendarMonthMs, createPinPersistence, createPinState } = require('./shift-pin-store-state.js');

function createShiftPinStore({ getHostToken, filePath }) {
  if (typeof getHostToken !== 'function') {
    throw new Error('createShiftPinStore requires getHostToken');
  }

  const persistence = createPinPersistence(filePath);
  const pinState = createPinState(persistence.load());
  pinState.pruneExpired();

  function persistNow() {
    const { active, grace } = pinState.getSnapshot();
    persistence.persist(active, grace);
  }

  function ensure(nowMs = Date.now()) {
    const now = nowMs;
    pinState.pruneExpired(now);
    if (pinState.isActive(now)) {
      return pinState.formatRow(pinState.getSnapshot().active);
    }
    const pin = pinState.mintUniquePin();
    const expiresAt = endOfCalendarMonthMs(now);
    pinState.setActive({ pin, expiresAt });
    persistNow();
    return pinState.formatRow(pinState.getSnapshot().active);
  }

  function getStatus() {
    pinState.pruneExpired();
    if (!pinState.isActive()) return null;
    return pinState.formatRow(pinState.getSnapshot().active);
  }

  function regenerate() {
    const now = Date.now();
    pinState.pruneExpired(now);
    const { active } = pinState.getSnapshot();
    if (active && pinState.isActive(now)) {
      pinState.addToGrace({ pin: active.pin, expiresAt: active.expiresAt });
    }
    pinState.clearActive();
    const body = ensure(now);
    persistNow();
    return body;
  }

  /** Reusable exchange — does not burn the PIN. Honors active + grace until expiry. */
  function exchange(pin) {
    const code = String(pin || '').trim();
    if (!/^\d{6}$/.test(code)) return null;
    const now = Date.now();
    pinState.pruneExpired(now);
    const { active, grace } = pinState.getSnapshot();
    if (pinState.isActive(now) && active.pin === code) {
      return { token: getHostToken() };
    }
    const legacy = grace.find((row) => row.pin === code && row.expiresAt > now);
    if (legacy) {
      return { token: getHostToken() };
    }
    return null;
  }

  return { ensure, getStatus, regenerate, exchange, endOfCalendarMonthMs };
}

module.exports = { createShiftPinStore, endOfCalendarMonthMs };
