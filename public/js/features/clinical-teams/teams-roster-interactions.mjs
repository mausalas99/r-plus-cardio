/**
 * Post-render DOM wiring for Mi rotación (no import from teams-roster.mjs).
 * Loaded dynamically from teams-roster-render after innerHTML is set.
 */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import {
  buildClinicalTeamInviteMessage,
} from '../../clinical-team-invite.mjs';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import {
  hasProgramAdminPrivileges,
} from '../../clinical-privileges.mjs';
import { verifyAdminAccessCode } from '../../../../lib/admin-access-code.mjs';
import { joinClinicalTeamByButton } from './teams-roster-join-handler.mjs';
import {
  toast,
  BROWSE_SALA_LS,
  promptAdminAccessCode,
  isAdminAccessGrantedThisSession,
  markAdminAccessGrantedThisSession,
  rememberAdminAccessCode,
  clearAdminAccessGrant,
  writeClinicalTeamsCollapseOpen,
} from './shared.mjs';
import { getClinicalTeamsPanelHost } from '../clinical-panel-host.mjs';
import {
  syncCreateTeamCycleField,
  syncCreateTeamServiceFromSala,
  renderClinicalTeamsPanel,
} from './teams-roster-render.mjs';

function syncSalaFieldVisibility() {
  syncCreateTeamServiceFromSala();
}

function wireAdminCheckboxGate() {
  const cb = document.getElementById('clinical-profile-admin');
  if (!(cb instanceof HTMLInputElement) || cb._rpcAdminGateWired) return;
  cb._rpcAdminGateWired = true;

  const hadAdminOnLoad =
    cb.checked || hasProgramAdminPrivileges(clinicalSessionContext.user);
  if (hadAdminOnLoad) {
    markAdminAccessGrantedThisSession();
  }

  cb.addEventListener('click', (ev) => {
    if (cb.checked) {
      clearAdminAccessGrant();
      return;
    }
    if (isAdminAccessGrantedThisSession()) return;

    ev.preventDefault();
    void promptAdminAccessCode().then((code) => {
      if (code && verifyAdminAccessCode(code)) {
        cb.checked = true;
        rememberAdminAccessCode(code);
        return;
      }
      cb.checked = false;
      if (code != null) toast('Código incorrecto.', 'error');
    });
  });
}

function wireCreateTeamPanel() {
  const openBtn = document.getElementById('btn-clinical-team-create-open');
  const panel = document.getElementById('clinical-team-create-panel');
  if (!(openBtn instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;
  if (openBtn._rpcCreateOpenWired) return;
  openBtn._rpcCreateOpenWired = true;

  const showPanel = () => {
    panel.hidden = false;
    openBtn.hidden = true;
    syncCreateTeamServiceFromSala();
    const firstField = panel.querySelector('input, select, textarea');
    if (firstField instanceof HTMLElement) firstField.focus();
  };
  const hidePanel = () => {
    panel.hidden = true;
    openBtn.hidden = false;
  };

  openBtn.addEventListener('click', showPanel);
  panel.querySelectorAll('.clinical-teams-create-cancel').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement) || btn._rpcCreateCancelWired) return;
    btn._rpcCreateCancelWired = true;
    btn.addEventListener('click', hidePanel);
  });
}

export function wireClinicalTeamsPanelInteractions() {
  syncSalaFieldVisibility();
  wireCreateTeamPanel();
  wireAdminCheckboxGate();

  const salaSelect = document.getElementById('clinical-team-create-sala');
  if (salaSelect && !salaSelect._rpcSalaWired) {
    salaSelect._rpcSalaWired = true;
    salaSelect.addEventListener('change', () => syncCreateTeamServiceFromSala());
  }

  const serviceSelect = document.getElementById('clinical-team-create-service');
  if (serviceSelect && !serviceSelect._rpcServiceWired) {
    serviceSelect._rpcServiceWired = true;
    serviceSelect.addEventListener('change', () => syncCreateTeamCycleField());
  }

  const r1LineSelect = document.getElementById('clinical-team-create-r1-line');
  if (r1LineSelect && !r1LineSelect._rpcR1LineWired) {
    r1LineSelect._rpcR1LineWired = true;
    r1LineSelect.addEventListener('change', () => syncCreateTeamCycleField());
  }
}

export function wireBrowseSalaControl(elevated) {
  if (!elevated) return;
  const select = document.getElementById('clinical-browse-sala');
  if (!select || select._rpcBrowseWired) return;
  select._rpcBrowseWired = true;
  select.addEventListener('change', () => {
    try {
      localStorage.setItem(BROWSE_SALA_LS, String(select.value || ''));
    } catch (_e) { void _e; }
    void renderClinicalTeamsPanel({ silent: true, skipLanPull: true, preserveDraft: true });
  });
}

export function wireJoinButtons() {
  document.querySelectorAll('.clinical-teams-join-btn').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement) || btn._rpcJoinWired) return;
    btn._rpcJoinWired = true;
    btn.addEventListener('click', async () => {
      await joinClinicalTeamByButton(String(btn.dataset.teamId || ''));
    });
  });
}

export function wireCopyInviteButtons() {
  document.querySelectorAll('.clinical-teams-copy-invite-btn').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement) || btn._rpcInviteWired) return;
    btn._rpcInviteWired = true;
    btn.addEventListener('click', () => {
      const teamId = String(btn.dataset.teamId || '');
      const team = (clinicalSessionContext.teams || []).find(
        (t) => String(t.team_id) === teamId
      );
      if (!team) {
        toast('Equipo no encontrado.', 'error');
        return;
      }
      const text = buildClinicalTeamInviteMessage(team);
      void copyToClipboardSafe(text).then((ok) => {
        toast(
          ok ? 'Invitación copiada. Pégala en WhatsApp o correo.' : 'No se pudo copiar.',
          ok ? 'success' : 'error'
        );
      });
    });
  });
}

function wireClinicalTeamsCollapsePersistence() {
  const host = getClinicalTeamsPanelHost();
  if (!host) return;
  host.querySelectorAll('details.clinical-teams-collapse[data-collapse-key]').forEach((el) => {
    if (!(el instanceof HTMLDetailsElement) || el._rpcCollapseWired) return;
    el._rpcCollapseWired = true;
    el.addEventListener('toggle', () => {
      const key = String(el.dataset.collapseKey || '').trim();
      if (!key) return;
      writeClinicalTeamsCollapseOpen(key, el.open);
    });
  });
  host.querySelectorAll('.clinical-teams-collapse-summary-actions').forEach((wrap) => {
    if (!(wrap instanceof HTMLElement) || wrap._rpcCollapseActionsWired) return;
    wrap._rpcCollapseActionsWired = true;
    wrap.addEventListener('click', (ev) => ev.stopPropagation());
    wrap.addEventListener('mousedown', (ev) => ev.stopPropagation());
  });
}

/** Called from render after panel HTML is injected (dynamic import avoids render↔roster cycle). */
export function wireRenderedClinicalTeamsPanel(elevated) {
  wireClinicalTeamsPanelInteractions();
  wireJoinButtons();
  wireCopyInviteButtons();
  wireBrowseSalaControl(elevated);
  wireClinicalTeamsCollapsePersistence();
}
