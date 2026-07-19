/** Pestaña / segmento VPO — orquestador. */
import { renderVpoPanel, stashVpoForPatient, registerVpoPanelRuntime } from './vpo-panel.mjs';

/** @type {{ getActiveId(): string|null }} */
let rt = {
  getActiveId() {
    return null;
  },
};

export function registerVpoRuntime(ctx) {
  if (ctx && typeof ctx === 'object') {
    Object.assign(rt, ctx);
    registerVpoPanelRuntime(ctx);
  }
}

export function renderVpo() {
  var mount = document.getElementById('vpo-container');
  if (!mount) return;
  renderVpoPanel(mount, rt.getActiveId());
}

export { stashVpoForPatient };
