/** Shared settings / help / tour runtime (injected from app-runtimes). */

const defaults = {
  getSettings() {
    return /** @type {any} */ ({});
  },
  getActiveInner() {
    return null;
  },
  getActiveId() {
    return null;
  },
  setActiveId() {},
  switchInnerTab() {},
  renderInnerTabs() {},
  renderEstadoActualButton() {},
  renderEstadoActualBar() {},
  switchAppTab() {},
  showToast() {},
  launchConfetti() {},
  syncPreimportBackupUi() {},
  syncSettingsLanHostDiskSection() {},
  closeProfileModal() {},
  openProfileModal() {},
  renderMedRecetaPanel() {},
  renderListadoForm() {},
  openAddModalFromLabPatient() {},
  refreshAllTodoUIs() {},
  refreshExpedienteAfterPatientSelect() {},
};

const state = { rt: { ...defaults } };

export function getSettingsHelpRuntime() {
  return state.rt;
}

export function registerSettingsHelpRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(state.rt, ctx);
  import('../../presentation-mode.mjs')
    .then(function (mod) {
      if (typeof mod.registerPresentationRuntime === 'function') {
        mod.registerPresentationRuntime(state.rt);
      }
    })
    .catch(function (err) {
      console.warn('[settings-help] presentation runtime', err);
    });
}
