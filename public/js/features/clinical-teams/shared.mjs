/**
 * Mi rotación — self-serve teams and membership.
 */
import {
  clinicalSessionContext,
} from '../../clinical-access-runtime.mjs';
import { normalizeUsername } from '../../clinical-username.mjs';
import { verifyAdminAccessCode } from '../../../../lib/admin-access-code.mjs';
import { CLINICAL_SALA_VALUES } from '../../../../lib/clinical-salas.mjs';

import { escapeHtml, escapeAttr } from '../../dom-escape.mjs';
export { escapeHtml, escapeAttr };
export const CLINICAL_TEAM_SERVICES = [
  'Sala',
  'Interconsultas',
  'Eme',
  'Torre HU',
  'UX',
  'Área A/Pensionistas',
];

export const CLINICAL_SALAS = CLINICAL_SALA_VALUES;

export const BROWSE_SALA_LS = 'clinical.browseSala';
export const CLINICAL_TEAMS_COLLAPSE_LS_PREFIX = 'rpc.clinicalTeamsCollapse.';

/** @param {string} key @param {boolean} [defaultOpen] */
export function readClinicalTeamsCollapseOpen(key, defaultOpen = true) {
  try {
    const v = localStorage.getItem(CLINICAL_TEAMS_COLLAPSE_LS_PREFIX + key);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch (_e) { void _e; }
  return defaultOpen;
}

/** @param {string} key @param {boolean} open */
export function writeClinicalTeamsCollapseOpen(key, open) {
  try {
    localStorage.setItem(CLINICAL_TEAMS_COLLAPSE_LS_PREFIX + key, open ? '1' : '0');
  } catch (_e) { void _e; }
}

/**
 * Collapsible block with persisted open state (Mi rotación sections and team cards).
 * @param {{ collapseKey: string, defaultOpen?: boolean, summaryHtml: string, bodyHtml: string, className?: string }} opts
 */
export function renderClinicalTeamsCollapsible(opts) {
  const {
    collapseKey,
    defaultOpen = true,
    summaryHtml,
    bodyHtml,
    className = '',
  } = opts;
  const open = readClinicalTeamsCollapseOpen(collapseKey, defaultOpen);
  const extraClass = className ? ` ${className}` : '';
  return `
    <details class="clinical-teams-collapse${extraClass}" data-collapse-key="${escapeAttr(collapseKey)}"${open ? ' open' : ''}>
      <summary class="clinical-teams-collapse-summary">${summaryHtml}</summary>
      <div class="clinical-teams-collapse-body">${bodyHtml}</div>
    </details>`;
}

/** @type {boolean} */
let adminAccessGrantedThisSession = false;
/** @type {string|null} */
let verifiedAdminAccessCode = null;

export function isAdminAccessGrantedThisSession() {
  return adminAccessGrantedThisSession;
}

export function markAdminAccessGrantedThisSession() {
  adminAccessGrantedThisSession = true;
}

export function rememberAdminAccessCode(code) {
  adminAccessGrantedThisSession = true;
  verifiedAdminAccessCode = code;
}

export function clearAdminAccessGrant() {
  adminAccessGrantedThisSession = false;
  verifiedAdminAccessCode = null;
}

export function getVerifiedAdminAccessCode() {
  return verifiedAdminAccessCode;
}
/** @type {((value: string|null) => void)|null} */
let adminCodePromptResolve = null;

export function adminCodeModalBackdropEl() {
  return document.getElementById('clinical-admin-code-backdrop');
}

function closeAdminCodeModal() {
  const bd = adminCodeModalBackdropEl();
  if (!bd) return;
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
}

export function promptAdminAccessCode() {
  const bd = adminCodeModalBackdropEl();
  const input = document.getElementById('clinical-admin-code-input');
  const err = document.getElementById('clinical-admin-code-error');
  if (!bd || !(input instanceof HTMLInputElement)) return Promise.resolve(null);

  input.value = '';
  if (err) {
    err.hidden = true;
    err.textContent = '';
  }
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  input.focus();

  return new Promise((resolve) => {
    adminCodePromptResolve = resolve;
  });
}

function finishAdminCodePrompt(code) {
  closeAdminCodeModal();
  const resolve = adminCodePromptResolve;
  adminCodePromptResolve = null;
  resolve?.(code);
}

function submitAdminCodeModal() {
  const input = document.getElementById('clinical-admin-code-input');
  const err = document.getElementById('clinical-admin-code-error');
  const code = input instanceof HTMLInputElement ? input.value : '';
  if (!verifyAdminAccessCode(code)) {
    if (err) {
      err.textContent = 'Código incorrecto.';
      err.hidden = false;
    }
    if (input instanceof HTMLInputElement) input.focus();
    return;
  }
  finishAdminCodePrompt(String(code).trim());
}

export function cancelAdminCodeModal() {
  finishAdminCodePrompt(null);
}

export function wireAdminCodeModalControls() {
  const bd = adminCodeModalBackdropEl();
  if (bd && !bd._rpcAdminCodeBackdropWired) {
    bd._rpcAdminCodeBackdropWired = true;
    bd.addEventListener('click', (ev) => {
      if (ev.target === bd) cancelAdminCodeModal();
    });
  }

  const form = document.getElementById('clinical-admin-code-form');
  if (form && !form._rpcAdminCodeFormWired) {
    form._rpcAdminCodeFormWired = true;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      submitAdminCodeModal();
    });
  }

  const cancelBtn = document.getElementById('btn-clinical-admin-code-cancel');
  if (cancelBtn && !cancelBtn._rpcAdminCodeCancelWired) {
    cancelBtn._rpcAdminCodeCancelWired = true;
    cancelBtn.addEventListener('click', () => cancelAdminCodeModal());
  }

  const closeBtn = document.getElementById('btn-clinical-admin-code-close');
  if (closeBtn && !closeBtn._rpcAdminCodeCloseWired) {
    closeBtn._rpcAdminCodeCloseWired = true;
    closeBtn.addEventListener('click', () => cancelAdminCodeModal());
  }
}

export function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

import { showToast } from '../../ui-toast.mjs';

export function toast(msg, type = 'info') {
  showToast(msg, type);
}

/** @param {string[]|undefined|null} warnings */
export function toastTeamWarnings(warnings) {
  const first = Array.isArray(warnings) ? String(warnings[0] || '').trim() : '';
  if (first) toast(first, 'warn');
}

export function hintHtml(text) {
  return `<p class="clinical-teams-hint">${escapeHtml(text)}</p>`;
}

export function currentUserId() {
  return String(clinicalSessionContext.user?.user_id || '');
}


export function filterJoinedTeams(teams, userOrUserId, usernameHint) {
  let uid = '';
  let handle = '';
  if (userOrUserId && typeof userOrUserId === 'object') {
    uid = String(userOrUserId.user_id || '');
    handle = normalizeUsername(userOrUserId.username || '');
  } else {
    uid = String(userOrUserId || '');
    handle = normalizeUsername(usernameHint || '');
  }
  if (!uid && !handle) return [];
  return (teams || []).filter((team) =>
    (team.members || []).some((m) => {
      if (uid && String(m.user_id) === uid) return true;
      if (handle && normalizeUsername(m.username || '') === handle) return true;
      return false;
    })
  );
}

/** @param {object} team @param {{ user_id?: string, username?: string }} user */
export function isUserTeamMember(team, user) {
  const uid = String(user?.user_id || '');
  const handle = normalizeUsername(user?.username || '');
  return (team.members || []).some((m) => {
    if (uid && String(m.user_id) === uid) return true;
    if (handle && normalizeUsername(m.username || '') === handle) return true;
    return false;
  });
}
