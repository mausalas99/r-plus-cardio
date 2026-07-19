'use strict';

/**
 * Shift PIN gate for LAN join. Default off (open exchange) for ward rollout.
 * Set R_PLUS_LAN_REQUIRE_SHIFT_PIN=1 before release to restore PIN pairing.
 */
function isShiftPinRequired() {
  return process.env.R_PLUS_LAN_REQUIRE_SHIFT_PIN === '1';
}

function isShiftPinBypassEnabled() {
  return !isShiftPinRequired();
}

module.exports = { isShiftPinRequired, isShiftPinBypassEnabled };
