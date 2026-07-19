/** Shared mutable state for DB unlock overlay flow. */
export const dbUnlockState = {
  unlockWaitResolve: null,
  lastMigrationProbe: null,
  lastNeedsConfirm: true,
  pendingUnlockCompletion: null,
};

export function electronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}
