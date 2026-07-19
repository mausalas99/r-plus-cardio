/** Shared runtime hooks for Estado Actual panel submodules. */

let rt = {
  getActiveId() {
    return null;
  },
  showToast() {},
  onMedicionRegistered() {},
  getSettings() {
    return {};
  },
  switchConsolidatedTab() {},
  copyToClipboardSafe(_text) {
    return Promise.resolve(false);
  },
};

export function registerEstadoActualPanelRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(rt, ctx);
}

export function getEaPanelRuntime() {
  return rt;
}
