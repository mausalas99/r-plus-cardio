/** Electron IPC update event listener registration (side-effect on import). */
import {
  handleUpdateAvailable,
  handleUpdateProgress,
  handleUpdateReady,
  handleUpdateNotAvailable,
  handleUpdateError,
  handleDowngradeFailed,
} from './electron-handlers.mjs';

function safeHandler(fn, label) {
  return function wrapped(payload) {
    try {
      fn(payload);
    } catch (e) {
      console.error(label + ' callback error:', e && e.message);
    }
  };
}

function registerElectronUpdateListeners() {
  if (typeof window === 'undefined' || !window.electronAPI) return;

  window.electronAPI.onUpdateAvailable(safeHandler(handleUpdateAvailable, 'onUpdateAvailable'));
  window.electronAPI.onUpdateProgress(safeHandler(handleUpdateProgress, 'onUpdateProgress'));
  window.electronAPI.onUpdateReady(safeHandler(handleUpdateReady, 'onUpdateReady'));
  window.electronAPI.onUpdateNotAvailable(safeHandler(handleUpdateNotAvailable, 'onUpdateNotAvailable'));
  window.electronAPI.onUpdateError(safeHandler(handleUpdateError, 'onUpdateError'));

  if (window.electronAPI.onDowngradeFailed) {
    window.electronAPI.onDowngradeFailed(safeHandler(handleDowngradeFailed, 'onDowngradeFailed'));
  }
}

registerElectronUpdateListeners();

export { registerElectronUpdateListeners };
