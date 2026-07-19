/**
 * Mi rotación entry (barra superior clínica).
 */
import { isDbMode } from '../db-storage-bridge.mjs';
import { readRpcSettings, isClinicalLocalOnlyMode } from '../clinical-settings.mjs';
import { needsClinicalOnboarding } from './clinical-onboarding.mjs';
import { syncClinicalContextBarVisibility } from './clinical-context-bar.mjs';
import { syncGuardiaRotationToolbar } from './clinical-rotation.mjs';
import { isGuardiaMode } from './chrome.mjs';
import { storage } from '../storage.js';
import { subscribeRoomSyncPhase } from '../lan-sync-state.mjs';
import { buildClinicalRotationEntryStatus } from './clinical-rotation-entry-status.mjs';
import { isLanSkipShiftPin } from '../lan-shift-pin-bypass.mjs';

let entryControlsWired = false;

async function openLanConnectPanelForPin() {
  try {
    const { openConnectionDropdown, focusLanShiftPinInput } = await import('./lan-sync.mjs');
    if (typeof openConnectionDropdown === 'function') openConnectionDropdown();
    if (!isLanSkipShiftPin() && typeof focusLanShiftPinInput === 'function') {
      window.setTimeout(() => focusLanShiftPinInput(), 80);
    }
  } catch {
    if (typeof window.showToast === 'function') {
      window.showToast(
        isLanSkipShiftPin()
          ? 'Abre ⇄ (Wi‑Fi) y pulsa Conectar al turno o pega el enlace del anfitrión.'
          : 'Abre ⇄ (Wi‑Fi) arriba e ingresa el PIN del turno.',
        'info'
      );
    }
  }
}

async function handleLanConnectCtaClick() {
  const savedPin = typeof storage.getLanShiftPin === 'function' ? storage.getLanShiftPin() : '';
  const bypass = isLanSkipShiftPin();
  if (bypass || /^\d{6}$/.test(savedPin)) {
    try {
      const { tryEasyLanShiftPinConnect } = await import('../lan-shift-pin-connect.mjs');
      const result = await tryEasyLanShiftPinConnect({
        force: true,
        shiftPin: savedPin || undefined,
      });
      if (result.ok) {
        syncClinicalRotationEntryChrome();
        return;
      }
      if (bypass && typeof window.showToast === 'function') {
        window.showToast(
          'No encontramos el anfitrión en esta red. Pega el enlace del R4 en ⇄ o revisa el Wi‑Fi.',
          'error'
        );
        await openLanConnectPanelForPin();
        return;
      }
    } catch (_e) { void _e; }
  }
  await openLanConnectPanelForPin();
}

/** @returns {boolean} */
function needsLanConnectCta() {
  if (isClinicalLocalOnlyMode(readRpcSettings())) return false;
  if (needsClinicalOnboarding()) return false;
  return true;
}

async function isLanConnectCtaVisible() {
  if (!needsLanConnectCta()) return false;
  try {
    const lan = await import('./lan-sync.mjs');
    if (!lan.isLanSessionConfiguredForRest?.()) return true;
    const { getRoomSyncPhase, RoomSyncPhase } = await import('../lan-sync-state.mjs');
    const roomId =
      typeof lan.getActiveLiveSyncRoomId === 'function' ? lan.getActiveLiveSyncRoomId() : '';
    if (!roomId) return true;
    return getRoomSyncPhase(roomId) !== RoomSyncPhase.live;
  } catch {
    return true;
  }
}

function syncLanConnectCta(show) {
  const section = document.getElementById('clinical-rotation-section');
  if (!section) return;

  let btn = document.getElementById('btn-clinical-lan-connect');
  if (!show) {
    if (btn) btn.remove();
    return;
  }

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-clinical-lan-connect';
    btn.type = 'button';
    btn.className = 'app-bar-lan-connect-cta';
    btn.textContent = 'Conectar al turno';
    btn.title = isLanSkipShiftPin()
      ? 'Busca el anfitrión del turno en la Wi‑Fi del hospital'
      : 'Usa el PIN de 6 dígitos del anfitrión (⇄)';
    btn.addEventListener('click', () => void handleLanConnectCtaClick());
    section.appendChild(btn);
  }
}

export async function openMiRotacion() {
  if (!isDbMode()) {
    if (typeof window.showToast === 'function') {
      window.showToast('Mi rotación requiere la base de datos clínica.', 'info');
    }
    return;
  }
  if (isClinicalLocalOnlyMode(readRpcSettings())) {
    if (typeof window.showToast === 'function') {
      window.showToast(
        'Mi rotación y equipos LAN no están disponibles en modo solo este equipo (ajeno a medicina interna).',
        'info'
      );
    }
    return;
  }

  const { openClinicalTeamsPanel } = await import('./clinical-teams/teams-roster.mjs');
  await openClinicalTeamsPanel();
  syncClinicalRotationEntryChrome();
}

/**
 * @returns {{ primary: string, sub: string, pending: boolean }}
 */
function buildEntryStatus() {
  return buildClinicalRotationEntryStatus();
}

export function syncClinicalRotationEntryChrome() {
  const rotationSection = document.getElementById('clinical-rotation-section');
  const show =
    isDbMode() && !isClinicalLocalOnlyMode(readRpcSettings()) && !isGuardiaMode();

  if (rotationSection) rotationSection.hidden = !show;
  if (!show) {
    syncLanConnectCta(false);
    syncGuardiaRotationToolbar();
    syncClinicalContextBarVisibility();
    return;
  }

  const status = buildEntryStatus();

  const entryBtn = document.getElementById('btn-sidebar-mi-rotacion');
  const entryPrimary = document.getElementById('clinical-rotation-entry-primary');
  const entrySub = document.getElementById('clinical-rotation-entry-sub');
  if (entryBtn) {
    entryBtn.classList.toggle('is-pending', status.pending);
    const base = status.pending
      ? 'Completa rango y rotación (sala)'
      : 'Usuario LAN, equipos y entregas';
    entryBtn.setAttribute('title', `${base} — ${status.primary}: ${status.sub}`);
  }
  if (entryPrimary) entryPrimary.textContent = status.primary;
  if (entrySub) entrySub.textContent = status.sub;

  void isLanConnectCtaVisible().then((visible) => syncLanConnectCta(visible));
  syncGuardiaRotationToolbar();
  syncClinicalContextBarVisibility();
}

export function wireClinicalRotationEntryControls() {
  if (entryControlsWired) return;
  entryControlsWired = true;

  const bind = (id) => {
    const el = document.getElementById(id);
    if (!el || el._rpcMiRotacionWired) return;
    el._rpcMiRotacionWired = true;
    el.addEventListener('click', () => void openMiRotacion());
  };

  bind('btn-sidebar-mi-rotacion');

  if (typeof document !== 'undefined') {
    document.addEventListener('rpc-clinical-teams-changed', () => {
      syncClinicalRotationEntryChrome();
    });
    document.addEventListener('rpc-clinical-ops-synced', () => {
      syncClinicalRotationEntryChrome();
    });
    subscribeRoomSyncPhase(() => {
      syncClinicalRotationEntryChrome();
    });
  }
}

export const windowHandlers = {
  openMiRotacion,
};
