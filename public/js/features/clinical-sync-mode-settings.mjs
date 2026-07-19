/**
 * Ajustes: switch solo-equipo ↔ guardia LAN.
 */
import { isDbMode } from '../db-storage-bridge.mjs';
import {
  isClinicalLocalOnlyMode,
  readRpcSettings,
  setClinicalSyncModeLocalOnly,
} from '../clinical-settings.mjs';

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

export function syncClinicalSyncModeSettingsUi() {
  const wrap = document.getElementById('settings-clinical-sync-mode');
  if (!wrap) return;
  const show = isDbMode() && isClinicalLocalOnlyMode(readRpcSettings());
  wrap.hidden = !show;
}

export async function enableClinicalLanFromSettings() {
  if (!isDbMode()) {
    toast('La base clínica no está activa.', 'error');
    return;
  }
  if (!isClinicalLocalOnlyMode(readRpcSettings())) {
    toast('Ya usas guardia en red (LAN).', 'info');
    return;
  }

  const ok = window.confirm(
    '¿Activar guardia en red (LAN)?\n\n' +
      'Configurarás usuario @usuario, sala y podrás usar Mi rotación y ⇄ LiveSync. ' +
      'Los expedientes en esta Mac se conservan.'
  );
  if (!ok) return;

  setClinicalSyncModeLocalOnly(false);

  try {
    const lan = await import('./lan-sync.mjs');
    if (typeof lan.ensureLanSyncRuntimeStarted === 'function') {
      lan.ensureLanSyncRuntimeStarted();
    }
  } catch (err) {
    console.warn('[R+] LAN runtime after local-only exit:', err && err.message);
  }

  try {
    const { closeSettingsDropdown, syncTeamSyncHeaderButton } = await import(
      './settings-help/settings-dropdown.mjs'
    );
    closeSettingsDropdown();
    syncTeamSyncHeaderButton();
  } catch (_e) { void _e; }

  try {
    const main = await import('./clinical-onboarding-main.mjs');
    await main.refreshMainClinicalOnboardingIfNeeded();
  } catch (_e) { void _e; }

  try {
    const rot = await import('./clinical-rotation-entry.mjs');
    if (typeof rot.syncClinicalRotationEntryChrome === 'function') {
      rot.syncClinicalRotationEntryChrome();
    }
  } catch (_e) { void _e; }

  syncClinicalSyncModeSettingsUi();
  toast('Modo LAN activado. Completa tu perfil de guardia si R+ te lo pide.', 'success');
}

export const windowHandlers = {
  enableClinicalLanFromSettings,
  syncClinicalSyncModeSettingsUi,
};
