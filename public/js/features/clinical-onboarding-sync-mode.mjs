/**
 * Onboarding: LAN vs solo este equipo + minimal local profile.
 */
import { readRpcSettings, setClinicalSyncModeLocalOnly } from '../clinical-settings.mjs';
import {
  buildOnboardingStageHtml,
  buildSyncModeChoiceBodyHtml,
} from './clinical-onboarding-shell.mjs';

/** @param {string} userId */
export function localOnlyUsernameForUserId(userId) {
  const tail =
    String(userId || '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
      .slice(-10) || 'device';
  return `local_${tail}`.slice(0, 32);
}

export function renderSyncModeChoicePanel(host) {
  host.innerHTML = buildOnboardingStageHtml({
    title: '¿Cómo usarás R+?',
    leadHtml:
      '<p>Elige cómo usarás R+ en este equipo. Con red LAN pediremos tu perfil de guardia; en solo equipo entras directo.</p>',
    bodyHtml: buildSyncModeChoiceBodyHtml(),
    stepperIndex: 1,
  });
}

async function refreshOnboardingHost() {
  const { refreshMainClinicalOnboardingIfNeeded } = await import('./clinical-onboarding-main.mjs');
  await refreshMainClinicalOnboardingIfNeeded();
}

export async function handleSyncModeChoice(mode) {
  if (mode === 'local') setClinicalSyncModeLocalOnly(true);
  else if (mode === 'lan') setClinicalSyncModeLocalOnly(false);
  else return;
  await refreshOnboardingHost();
}

export async function handleSyncModeBack() {
  const settings = readRpcSettings();
  delete settings.clinicalLocalOnly;
  try {
    localStorage.setItem('rpc-settings', JSON.stringify(settings));
  } catch (_e) { void _e; }
  await refreshOnboardingHost();
}

export function wireSyncModeOnboardingInteractions() {
  const modeHost = document.querySelector('.clinical-onboard-mode-grid');
  if (modeHost && !modeHost._rpcModeWired) {
    modeHost._rpcModeWired = true;
    modeHost.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-sync-mode]');
      if (!btn) return;
      void handleSyncModeChoice(String(btn.getAttribute('data-sync-mode') || ''));
    });
  }
}
