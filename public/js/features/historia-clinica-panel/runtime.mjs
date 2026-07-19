import { patients } from '../../app-state.mjs';

import { esc } from '../../dom-escape.mjs';
export { esc };
let rt = {
  getActiveId() {
    return null;
  },
  getSettings() {
    return {};
  },
  showToast(_msg, _type) {},
  copyToClipboardSafe(_t) {
    return Promise.resolve(false);
  },
  navigateToEstadoActualPanel() {},
};

export const MOUNT_ID = 'historia-clinica-mount';

export { rt };

export function registerHistoriaClinicaRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export function activePatient() {
  var id = rt.getActiveId();
  if (!id) return null;
  return patients.find(function (p) {
    return String(p.id) === String(id);
  });
}

export function lookbackHours(defaultHours) {
  var s = typeof rt.getSettings === 'function' ? rt.getSettings() : {};
  var hc = s && s.historiaClinica;
  var n = hc && hc.labLookbackHours != null ? Number(hc.labLookbackHours) : defaultHours;
  return Number.isFinite(n) && n > 0 ? n : defaultHours;
}
