'use strict';

class ConflictError extends Error {
  constructor(details) {
    super('conflict');
    this.code = 'CONFLICT';
    Object.assign(this, details);
  }
}

function keysChanged(serverData, baseData) {
  const keys = new Set([...Object.keys(serverData || {}), ...Object.keys(baseData || {})]);
  const changed = [];
  for (const k of keys) {
    if (serverData[k] !== baseData[k]) changed.push(k);
  }
  return changed;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

module.exports = { ConflictError, keysChanged, pick };
