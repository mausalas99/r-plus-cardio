/**
 * Shared Mi rotación panel host + safe render wrapper.
 */
import { isDbMode } from '../db-storage-bridge.mjs';
import {
  bootstrapClinicalAccess,
  clinicalSessionContext,
} from '../clinical-access-runtime.mjs';
import { readRpcSettings, resolveClinicalClientId } from '../clinical-settings.mjs';
import {
  collectClinicalLsSnapshot,
  ensureClinicalDbUnlocked,
  getClinicalBootDelays,
} from './db-unlock.mjs';
import { buildTextSkeletonPanel } from '../ui-skeleton.mjs';

/** Panel body inside the visible Mi rotación backdrop. */
export function getClinicalTeamsPanelHost() {
  const bd = document.getElementById('clinical-teams-backdrop');
  if (bd) {
    const scoped = bd.querySelector('#clinical-teams-panel-body');
    if (scoped) return scoped;
  }
  return document.getElementById('clinical-teams-panel-body');
}

export function setClinicalTeamsPanelLoading() {
  const host = getClinicalTeamsPanelHost();
  if (host) {
    host.innerHTML = buildTextSkeletonPanel('clinical-teams-skeleton skel-panel', 3);
  }
}

/** Open Mi rotación shell immediately; content loads additively. */

import { escapeHtml } from '../dom-escape.mjs';
export function showClinicalTeamsPanelShell() {
  const bd = document.getElementById('clinical-teams-backdrop');
  if (!bd) return false;
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  document.body.classList.add('clinical-teams-modal-open');
  setClinicalTeamsPanelLoading();
  return true;
}

/** @param {string} message */
export function setClinicalTeamsPanelError(message) {
  const host = getClinicalTeamsPanelHost();
  if (!host) return;
  host.innerHTML = `
    <p class="clinical-registration-error">${escapeHtml(message)}</p>
    <p class="clinical-teams-lead">Cierra este diálogo y vuelve a abrir <strong>Mi rotación</strong>. Si sigue vacío, reinicia R+ por completo (Cmd+Q).</p>`;
}

/**
 * @param {(host: HTMLElement) => Promise<void>} renderFn
 */
export async function safeRenderClinicalTeamsPanel(renderFn) {
  const host = getClinicalTeamsPanelHost();
  if (!host) return;
  setClinicalTeamsPanelLoading();
  try {
    await renderFn(host);
  } catch (err) {
    console.error('[Mi rotación]', err);
    setClinicalTeamsPanelError(
      err instanceof Error ? err.message : 'Error al cargar Mi rotación.'
    );
  }
}

function delayMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tryAutoOpenClinicalDb() {
  if (!isDbMode() || typeof window === 'undefined') return false;
  const api = window.rplusDb || window.electronAPI;
  if (!api || typeof api.dbAutoUnlock !== 'function') return false;
  try {
    const res = await api.dbAutoUnlock({ lsSnapshot: collectClinicalLsSnapshot() });
    return !!(res && res.ok !== false && res.state === 'unlocked');
  } catch {
    return false;
  }
}

/** @param {number[]} delaysMs */
async function attemptClinicalPanelSessionWithDelays(settings, clientId, delaysMs) {
  async function attemptSession() {
    if (clinicalSessionContext.user?.user_id) return true;
    await tryAutoOpenClinicalDb();
    if (clinicalSessionContext.user?.user_id) return true;
    const ok = await bootstrapClinicalAccess(settings, clientId);
    return !!(ok && clinicalSessionContext.user?.user_id);
  }

  for (const ms of delaysMs) {
    if (ms > 0) await delayMs(ms);
    if (await attemptSession()) return true;
  }
  return false;
}

const INTERACTIVE_SESSION_DELAYS_MS = [0, 50, 150, 400];

/** Ensure DB clinical session exists before rendering the panel. */
export async function ensureClinicalPanelSession(opts = {}) {
  if (clinicalSessionContext.user?.user_id) return true;
  if (!isDbMode()) return false;
  const settings = readRpcSettings();
  const clientId = resolveClinicalClientId(settings);
  const bootDelays = opts.interactive ? INTERACTIVE_SESSION_DELAYS_MS : getClinicalBootDelays();

  const dbReady = await ensureClinicalDbUnlocked();
  if (!dbReady.unlocked) return false;

  if (await attemptClinicalPanelSessionWithDelays(settings, clientId, bootDelays)) {
    return true;
  }

  try {
    const { applyClinicalDbUnlockCompletion } = await import('./db-unlock.mjs');
    await applyClinicalDbUnlockCompletion({ refreshOnboarding: false });
  } catch (err) {
    console.warn('[Mi rotación] clinical session recovery:', err && err.message);
  }
  if (clinicalSessionContext.user?.user_id) return true;

  await ensureClinicalDbUnlocked();
  return attemptClinicalPanelSessionWithDelays(settings, clientId, bootDelays);
}
