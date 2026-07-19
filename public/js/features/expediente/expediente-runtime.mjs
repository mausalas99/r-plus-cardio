import { esc } from '../../dom-escape.mjs';
export { esc };
// Expediente shared runtime bridge
let rt = {
  getActiveId() { return null; },
  getActiveAppTab() { return 'lab'; },
  getActiveInner() { return 'todo'; },
  getSettings() { return /** @type {any} */ ({}); },
  showToast() {},
  renderTendencias() {},
  renderPaseBoard() {},
  splitResLabsByTipo(rows) { void rows; return { labs: [], cultivo: [] }; },
  buildLabSetDateLine(set) { void set; return ''; },
  ensureParsedLabHistory(pid) { void pid; return []; },
  isRpcOffline() { return false; },
  requestDocumentJson() { return Promise.resolve(null); },
  handleDocumentGenerateResponse() { return Promise.resolve(null); },
  incrementPendingJobs() {},
  decrementPendingJobs() {},
  syncOfflineButtonStates() {},
  copyToClipboardSafe(_t) { return Promise.resolve(false); },
  guardMobileDocExport() {
    return false;
  },
};

export { rt };

export function registerExpedienteRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(rt, ctx);
}

export function aid() {
  return rt.getActiveId();
}
