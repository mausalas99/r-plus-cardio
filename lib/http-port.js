'use strict';

/** Cardionotas HTTP listen port. R+ uses 3738 — keep distinct so both can run. */
const DEFAULT_HTTP_PORT = 3838;

/** UDP LAN beacon bind port. R+ uses 3739. */
const DEFAULT_BEACON_PORT = 3840;

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 * @returns {number}
 */
function parsePort(raw, fallback) {
  const n = Number(String(raw || '').trim());
  if (Number.isFinite(n) && n > 0 && n < 65536) return Math.floor(n);
  return fallback;
}

function resolveHttpPort() {
  return parsePort(
    process.env.CARDIONOTAS_HTTP_PORT || process.env.R_PLUS_HTTP_PORT,
    DEFAULT_HTTP_PORT,
  );
}

function resolveBeaconPort() {
  return parsePort(
    process.env.CARDIONOTAS_BEACON_PORT || process.env.R_PLUS_BEACON_PORT,
    DEFAULT_BEACON_PORT,
  );
}

const LAN_HTTP_PORT = resolveHttpPort();
const LAN_BEACON_PORT = resolveBeaconPort();

module.exports = {
  DEFAULT_HTTP_PORT,
  DEFAULT_BEACON_PORT,
  resolveHttpPort,
  resolveBeaconPort,
  LAN_HTTP_PORT,
  LAN_BEACON_PORT,
};
