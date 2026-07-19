import { importDiagnosticosFromPaste } from '../vpo-data.mjs';

/** @param {HTMLElement} mount @param {object} state @param {object} rt @param {() => void} scheduleSave @param {(mount: HTMLElement, state: object) => void} refreshDxListDom @param {(mount: HTMLElement, state: object) => void} commitDxList */
export function handleVpoDxSplitPlus(ev, mount, state, rt, scheduleSave, refreshDxListDom) {
  ev.preventDefault();
  const ta = mount.querySelector('[data-vpo-dx-paste]');
  if (!importDiagnosticosFromPaste(state, ta ? ta.value : '')) {
    rt.showToast('Pega diagnósticos separados por +', 'error');
    return true;
  }
  if (ta) ta.value = '';
  scheduleSave();
  refreshDxListDom(mount, state);
  rt.showToast('Diagnósticos separados', 'success');
  return true;
}

/** @param {HTMLElement} mount @param {object} state @param {(mount: HTMLElement, state: object) => void} commitDxList */
export function handleVpoDxAddRow(ev, mount, state, commitDxList) {
  ev.preventDefault();
  if (!state.diagnosticosList) state.diagnosticosList = [''];
  if (state.diagnosticosList[state.diagnosticosList.length - 1]) state.diagnosticosList.push('');
  commitDxList(mount, state);
  const lastInput = mount.querySelector('[data-vpo-dx-idx="' + (state.diagnosticosList.length - 1) + '"]');
  if (lastInput) lastInput.focus();
  return true;
}

/** @param {Event} ev @param {HTMLElement} mount @param {HTMLElement} btn @param {object} state @param {(mount: HTMLElement, state: object) => void} commitDxList */
export function handleVpoDxRemoveRow(ev, mount, btn, state, commitDxList) {
  ev.preventDefault();
  const idx = parseInt(btn.getAttribute('data-vpo-dx-remove'), 10);
  if (!state.diagnosticosList || state.diagnosticosList.length <= 1) return true;
  state.diagnosticosList.splice(idx, 1);
  if (!state.diagnosticosList.length) state.diagnosticosList = [''];
  commitDxList(mount, state);
  return true;
}
