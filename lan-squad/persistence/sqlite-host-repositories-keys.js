'use strict';

function parseLabSidecarKey(key) {
  const raw = String(key || '');
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  return { roomId: raw.slice(0, sep), patientId: raw.slice(sep + 1) };
}

module.exports = { parseLabSidecarKey };
