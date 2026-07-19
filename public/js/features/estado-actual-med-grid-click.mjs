import { addMedFieldItem, removeMedFieldItem } from './estado-actual-med-ui.mjs';

function handleMedRemoveClick(ev, target, grid, mount, ctx, monitoreo, refreshBlock) {
  const removeBtn = target.closest('[data-ea-med-remove]');
  if (!removeBtn) return false;
  ev.preventDefault();
  ev.stopPropagation();
  const rKey = removeBtn.getAttribute('data-ea-med-remove');
  const idx = Number(removeBtn.getAttribute('data-ea-med-idx'));
  if (rKey && Number.isFinite(idx)) {
    removeMedFieldItem(monitoreo, rKey, idx);
    ctx.saveState();
    ctx.syncTextarea();
    refreshBlock(mount, rKey, monitoreo);
  }
  return true;
}

function handleMedToggleClick(target, grid) {
  const toggleBtn = target.closest('[data-ea-med-manual-toggle]');
  if (!toggleBtn) return false;
  const tKey = toggleBtn.getAttribute('data-ea-med-manual-toggle');
  if (!tKey) return true;
  const panel = grid.querySelector('[data-ea-med-manual-panel="' + tKey + '"]');
  if (!panel) return true;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) {
    const input = panel.querySelector('[data-ea-med-manual-input="' + tKey + '"]');
    if (input && 'focus' in input) /** @type {HTMLElement} */ (input).focus();
  }
  return true;
}

function handleMedSaveClick(target, grid, mount, ctx, monitoreo, refreshBlock) {
  const saveBtn = target.closest('[data-ea-med-manual-save]');
  if (!saveBtn) return false;
  const sKey = saveBtn.getAttribute('data-ea-med-manual-save');
  if (!sKey) return true;
  const sPanel = grid.querySelector('[data-ea-med-manual-panel="' + sKey + '"]');
  const sInput = sPanel && sPanel.querySelector('[data-ea-med-manual-input="' + sKey + '"]');
  const text = sInput && 'value' in sInput ? String(sInput.value).trim() : '';
  if (text) {
    addMedFieldItem(monitoreo, sKey, text);
    if (sInput && 'value' in sInput) sInput.value = '';
    if (sPanel) sPanel.hidden = true;
    ctx.saveState();
    ctx.syncTextarea();
    refreshBlock(mount, sKey, monitoreo);
  }
  return true;
}

function handleMedCancelClick(target, grid) {
  const cancelBtn = target.closest('[data-ea-med-manual-cancel]');
  if (!cancelBtn) return false;
  const cKey = cancelBtn.getAttribute('data-ea-med-manual-cancel');
  if (!cKey) return true;
  const cPanel = grid.querySelector('[data-ea-med-manual-panel="' + cKey + '"]');
  const cInput = cPanel && cPanel.querySelector('[data-ea-med-manual-input="' + cKey + '"]');
  if (cInput && 'value' in cInput) cInput.value = '';
  if (cPanel) cPanel.hidden = true;
  return true;
}

/**
 * @param {HTMLElement} grid
 * @param {HTMLElement} mount
 * @param {object} ctx
 * @param {(monitoreo: object) => object} liveMonitoreoFromCtx
 * @param {(mount: HTMLElement, key: string, monitoreo: object) => void} refreshBlock
 */
export function handleMedGridClick(ev, grid, mount, ctx, liveMonitoreoFromCtx, refreshBlock) {
  const target = /** @type {HTMLElement | null} */ (ev.target);
  if (!target || !grid.contains(target)) return false;
  const monitoreo = liveMonitoreoFromCtx(ctx);
  if (handleMedRemoveClick(ev, target, grid, mount, ctx, monitoreo, refreshBlock)) return true;
  if (handleMedToggleClick(target, grid)) return true;
  if (handleMedSaveClick(target, grid, mount, ctx, monitoreo, refreshBlock)) return true;
  if (handleMedCancelClick(target, grid)) return true;
  return false;
}
