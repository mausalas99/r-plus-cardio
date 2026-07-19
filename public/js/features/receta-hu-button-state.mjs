import { setAsyncButtonLoading } from '../ui-motion.mjs';
import { rt } from './receta-hu-shared.mjs';

export function resetExportButtonState() {
  var btn = document.getElementById('btn-receta-hu-export');
  if (!btn) return;
  if (!btn.dataset.uiMotionDefaultLabel) {
    btn.dataset.uiMotionDefaultLabel = 'Exportar PDF';
  }
  delete btn.dataset.rpcOffline;
  setAsyncButtonLoading(btn, false);
  if (!(rt.isRpcOffline && rt.isRpcOffline())) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  }
}
