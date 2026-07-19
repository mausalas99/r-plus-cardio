/**
 * Join-by-code, invite copy, URL consume (Mi rotación).
 */
import {
  clinicalSessionContext,
  fetchClinicalTeamsFromDb,
} from '../../clinical-access-runtime.mjs';
import {
  diagnoseInviteCodeFailure,
  inviteCodeFailureMessage,
  isClinicalTeamJoinDesktopApp,
  parseClinicalTeamJoinQuery,
  tryMountClinicalTeamInviteBrowserGate,
} from '../../clinical-team-invite.mjs';
import { isLanSalaInvitePaste } from '../../lan-join-link.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { inferMembershipCycleForJoin } from '../../clinico-access.mjs';
import { ensureClinicalPanelSession } from '../clinical-panel-host.mjs';
import { dbApi, toast, currentUserId, filterJoinedTeams } from './shared.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';
import { resolveTeamIdForInviteInput } from './teams-invite-resolve.mjs';

export { resolveTeamIdForInviteInput };

export async function joinTeamById(teamId, subAreaFraction) {
  const userId = currentUserId();
  if (!userId || !teamId) return false;

  await fetchClinicalTeamsFromDb();
  const team = (clinicalSessionContext.teams || []).find(
    (t) => String(t.team_id) === teamId
  );
  if (!team) {
    toast('Equipo no encontrado en esta base de datos.', 'error');
    return false;
  }

  if (
    filterJoinedTeams(clinicalSessionContext.teams, clinicalSessionContext.user).some(
      (t) => String(t.team_id) === teamId
    )
  ) {
    toast('Ya perteneces a este equipo.', 'info');
    const { openClinicalTeamsPanel } = await import('./teams-roster.mjs');
    await openClinicalTeamsPanel();
    return true;
  }

  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamsJoin !== 'function') {
    toast('Base de datos no disponible.', 'error');
    return false;
  }

  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const cycle = subAreaFraction || inferMembershipCycleForJoin(team, rank);
  const res = await api.dbClinicalTeamsJoin({ teamId, userId, subAreaFraction: cycle });
  if (!res?.ok) {
    toast(res?.error || 'No se pudo unir al equipo.', 'error');
    return false;
  }
  toast(`Te uniste al equipo ${team.name || ''} (ciclo ${cycle}).`, 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await publishClinicalTeamsToLan();
  const { refreshTeamsUiAfterChange } = await import('./teams-roster.mjs');
  await refreshTeamsUiAfterChange();
  return true;
}

/** Mi rotación team code field received a ⇄ sala link — hand off to Conexión guardia. */
export async function redirectLanInviteFromTeamJoinField(raw) {
  const text = String(raw || '').trim();
  if (!text) return false;

  const { openConnectionDropdown, joinLanFromInviteUi } = await import('../lan-sync.mjs');
  if (typeof openConnectionDropdown === 'function') openConnectionDropdown();

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const lanInput = document.getElementById('lan-input-invite-link');
  if (lanInput instanceof HTMLTextAreaElement || lanInput instanceof HTMLInputElement) {
    lanInput.value = text;
  }
  const details = document.querySelector('.lan-connect-other-mac');
  if (details instanceof HTMLDetailsElement) details.open = true;

  toast(
    'Ese enlace es de conexión LAN (⇄), no de equipo. Conectando desde Conexión guardia…',
    'info'
  );
  if (typeof joinLanFromInviteUi === 'function') joinLanFromInviteUi();
  return true;
}

/** @param {Event} ev */
export async function handleJoinWithCodeSubmit(ev) {
  ev.preventDefault();
  const input = document.getElementById('clinical-team-join-code-input');
  const cycleEl = document.getElementById('clinical-team-join-code-cycle');
  const code = input instanceof HTMLInputElement ? input.value : '';
  const subAreaFraction =
    cycleEl instanceof HTMLSelectElement ? String(cycleEl.value || '').trim() : '';

  if (isLanSalaInvitePaste(code)) {
    await redirectLanInviteFromTeamJoinField(code);
    return;
  }

  const teamId = await resolveTeamIdForInviteInput(code);
  if (!teamId) {
    await fetchClinicalTeamsFromDb();
    const diag = diagnoseInviteCodeFailure(code, clinicalSessionContext.teams || []);
    toast(inviteCodeFailureMessage(diag), 'error');
    return;
  }
  await joinTeamById(teamId, subAreaFraction);
}

function clearClinicalTeamJoinQueryParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('joinTeam');
    url.searchParams.delete('joinCode');
    url.searchParams.delete('clinicalTeam');
    url.searchParams.delete('teamCode');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch (_e) { void _e; }
}

/**
 * Desktop only: prefill join from ?joinCode= or legacy ?joinTeam=.
 */
export async function consumeClinicalTeamJoinFromUrl() {
  if (typeof window === 'undefined' || !isClinicalTeamJoinDesktopApp()) {
    tryMountClinicalTeamInviteBrowserGate();
    return;
  }

  const parsed = parseClinicalTeamJoinQuery(window.location.search);
  if (!parsed.teamId && !parsed.inviteCode) return;

  const sessionOk = await ensureClinicalPanelSession();
  if (!sessionOk) return;

  const { openClinicalTeamsPanel } = await import('./teams-roster.mjs');
  await openClinicalTeamsPanel();

  const input = document.getElementById('clinical-team-join-code-input');
  if (input instanceof HTMLInputElement && parsed.inviteCode) {
    input.value = parsed.inviteCode;
  }

  const teamId =
    parsed.teamId || (await resolveTeamIdForInviteInput(parsed.inviteCode));
  if (!teamId) {
    toast('Pega el código en Mi rotación y pulsa Unirme.', 'info');
    clearClinicalTeamJoinQueryParams();
    return;
  }

  const cycleEl = document.getElementById('clinical-team-join-code-cycle');
  const subAreaFraction =
    cycleEl instanceof HTMLSelectElement ? String(cycleEl.value || '').trim() : '';
  await joinTeamById(teamId, subAreaFraction);
  clearClinicalTeamJoinQueryParams();
}
