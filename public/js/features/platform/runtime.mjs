/** Platform runtime context injected from app-runtimes. */
const state = {
  rt: {
    getActiveId() {
      return null;
    },
    setActiveId() {},
    getSettings() {
      return /** @type {any} */ ({});
    },
    showToast() {},
    syncTeamSyncHeaderButton() {},
    pushUndoSnapshot() {},
  },
};

export function registerPlatformRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(state.rt, ctx);
}

export function getPlatformRuntime() {
  return state.rt;
}
