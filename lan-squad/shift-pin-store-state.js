'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PIN_MIN = 100000;
const PIN_MAX = 999999;
const MAX_PIN_COLLISION_ATTEMPTS = 10;
const STORE_VERSION = 1;

/** Midnight local time on the 1st of the next calendar month (PIN valid through last day of month). */
function endOfCalendarMonthMs(now = Date.now()) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
}

function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, filePath);
}

function createPinPersistence(filePath) {
  function persist(active, grace) {
    if (!filePath) return;
    try {
      atomicWriteJson(filePath, {
        version: STORE_VERSION,
        active: active ? { pin: active.pin, expiresAt: active.expiresAt } : null,
        grace: grace.map((row) => ({ pin: row.pin, expiresAt: row.expiresAt })),
      });
    } catch (e) {
      console.error('[shift-pin] persist failed:', e && e.message ? e.message : e);
    }
  }

  function load() {
    if (!filePath || !fs.existsSync(filePath)) {
      return { active: null, grace: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const active =
        raw && raw.active && raw.active.pin
          ? { pin: String(raw.active.pin), expiresAt: Number(raw.active.expiresAt) || 0 }
          : null;
      const grace = Array.isArray(raw.grace)
        ? raw.grace
            .filter((row) => row && row.pin)
            .map((row) => ({
              pin: String(row.pin),
              expiresAt: Number(row.expiresAt) || 0,
            }))
        : [];
      return { active, grace };
    } catch (e) {
      console.error('[shift-pin] load failed:', e && e.message ? e.message : e);
      return { active: null, grace: [] };
    }
  }

  return { persist, load };
}

function createPinState(initial) {
  let active = initial.active;
  let grace = initial.grace;

  function allKnownPins() {
    const out = new Set();
    if (active && active.pin) out.add(active.pin);
    for (const row of grace) {
      if (row && row.pin) out.add(row.pin);
    }
    return out;
  }

  function pruneExpired(now = Date.now()) {
    if (active && active.expiresAt <= now) active = null;
    grace = grace.filter((row) => row && row.expiresAt > now);
  }

  function addToGrace(entry) {
    if (!entry || !entry.pin) return;
    const pin = String(entry.pin);
    const expiresAt = Number(entry.expiresAt) || 0;
    if (!expiresAt) return;
    if (grace.some((row) => row.pin === pin)) return;
    grace.push({ pin, expiresAt });
  }

  function mintUniquePin() {
    const taken = allKnownPins();
    for (let i = 0; i < MAX_PIN_COLLISION_ATTEMPTS; i++) {
      const pin = String(crypto.randomInt(PIN_MIN, PIN_MAX + 1));
      if (!taken.has(pin)) return pin;
    }
    throw new Error('Could not mint unique shift PIN');
  }

  function isActive(now = Date.now()) {
    return !!(active && active.expiresAt > now);
  }

  function formatRow(row) {
    return {
      pin: row.pin,
      expiresAt: new Date(row.expiresAt).toISOString(),
    };
  }

  function getSnapshot() {
    return { active, grace };
  }

  function setActive(next) {
    active = next;
  }

  function clearActive() {
    active = null;
  }

  return {
    pruneExpired,
    addToGrace,
    mintUniquePin,
    isActive,
    formatRow,
    getSnapshot,
    setActive,
    clearActive,
  };
}

module.exports = {
  endOfCalendarMonthMs,
  createPinPersistence,
  createPinState,
};
