/**
 * Shift PIN gate — default off (no user setup). PIN UI returns when host sets
 * R_PLUS_LAN_REQUIRE_SHIFT_PIN=1 at deploy time.
 */
export function isLanSkipShiftPin() {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.isLanShiftPinRequired?.()) {
      return false;
    }
  } catch {
    // default bypass below
  }
  return true;
}
