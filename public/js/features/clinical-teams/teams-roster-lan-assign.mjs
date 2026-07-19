/** LAN directorio team assign / delete handlers. */
import { fetchClinicalTeamsFromDb } from '../../clinical-access-runtime.mjs';
import { resolveMembershipCycleForUser } from '../../clinico-access.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';
import { dbApi, toast, currentUserId, escapeHtml, escapeAttr } from './shared.mjs';
import { lanDirRt } from './teams-roster-lan-state.mjs';
import {
  cycleLettersForAssign,
  formatLanCycleOptionLabel,
} from './teams-roster-lan-render.mjs';

/** @param {object|null} team @param {string} userRank @param {string} rowPreferred */
function resolveLanAssignDefaultCycle(team, userId, userRank, rowPreferred, letters) {
  let defaultCycle = team ? resolveMembershipCycleForUser(team, userId, userRank) : letters[0] || 'A';
  if (rowPreferred && letters.includes(rowPreferred)) defaultCycle = rowPreferred;
  return defaultCycle;
}

export function syncLanAssignCycleSelect(teamSelect, preferredCycle = '') {
  if (!(teamSelect instanceof HTMLSelectElement)) return;
  const row = teamSelect.closest('.clinical-lan-user-row');
  const cycleSelect = row?.querySelector('.clinical-lan-assign-cycle');
  if (!(cycleSelect instanceof HTMLSelectElement)) return;

  const teamId = String(teamSelect.value || '').trim();
  if (!teamId) {
    cycleSelect.innerHTML = '<option value="">— Ciclo —</option>';
    cycleSelect.disabled = true;
    return;
  }

  const team = lanDirRt.teams.find((t) => String(t.team_id) === teamId);
  const userId = String(row?.dataset.userId || '').trim();
  const userRank = String(row?.dataset.userRank || 'R1');
  const letters = team ? cycleLettersForAssign(team, userRank) : [];
  const rowPreferred = String(preferredCycle || row?.dataset.preferredCycle || '').trim();
  const defaultCycle = resolveLanAssignDefaultCycle(team, userId, userRank, rowPreferred, letters);

  cycleSelect.innerHTML = letters
    .map((letter) => {
      const label = formatLanCycleOptionLabel(letter, userRank);
      return `<option value="${escapeAttr(letter)}" ${letter === defaultCycle ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
  cycleSelect.disabled = letters.length === 0;
  cycleSelect.value = defaultCycle;
}

/** @param {Element} row */
export function initLanUserRowAssignState(row) {
  const teamSelect = row.querySelector('.clinical-lan-assign-team');
  if (!(teamSelect instanceof HTMLSelectElement)) return;
  const preferred = String(row.dataset.preferredCycle || '').trim();
  syncLanAssignCycleSelect(teamSelect, preferred);
}

async function handleLanAssignUserToTeam(userId, teamId, subAreaFraction) {
  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamsMemberAdd !== 'function') {
    toast('No se pudo asignar.', 'error');
    return false;
  }
  const res = await api.dbClinicalTeamsMemberAdd({
    teamId,
    userId,
    subAreaFraction,
  });
  if (!res || res.ok === false) {
    toast(res?.error || 'No se asignó al equipo.', 'error');
    return false;
  }
  if (Array.isArray(res.warnings) && res.warnings[0]) {
    toast(String(res.warnings[0]), 'warn');
  }
  return true;
}

export async function handleLanDeleteDirectoryUserClick(btn) {
  const userId = String(btn.dataset.userId || '').trim();
  if (!userId) return;
  const label = String(btn.dataset.userLabel || '').trim() || userId;
  const api = dbApi();
  if (!api || typeof api.dbClinicalUserDelete !== 'function') {
    toast('Eliminar usuarios requiere R+ de escritorio con base clínica desbloqueada.', 'error');
    return;
  }
  const confirmed = window.confirm(
    `¿Eliminar a «${label}» de la base clínica en esta Mac?\n\nDesaparecerá del directorio LAN. Las demás R+ en la misma sala ⇄ lo quitarán al sincronizar.`
  );
  if (!confirmed) return;

  btn.disabled = true;
  const res = await api.dbClinicalUserDelete({
    targetUserId: userId,
    callerUserId: currentUserId(),
  });
  btn.disabled = false;
  if (!res?.ok) {
    toast(res?.error || 'No se pudo eliminar el usuario.', 'error');
    return;
  }

  toast('Usuario eliminado de esta Mac.', 'success');
  const { isBenignLanPushSkipCode } = await import('../../clinical-profile-lan-sync.mjs');
  const lanPush = await publishClinicalTeamsToLan();
  if (!lanPush.ok && !isBenignLanPushSkipCode(lanPush.code)) {
    toast(
      'Usuario eliminado aquí, pero no se pudo publicar el cambio a la sala ⇄. Revisa la conexión.',
      'warning'
    );
  }
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  const { reloadLanUsersDirectoryAfterMutation } = await import('./teams-roster-lan-load.mjs');
  await reloadLanUsersDirectoryAfterMutation();
}

/** @param {HTMLButtonElement} btn */
function readLanAssignRowSelection(btn) {
  const row = btn.closest('.clinical-lan-user-row');
  if (!row) return null;
  const userId = String(btn.dataset.userId || row.dataset.userId || '').trim();
  const teamSelect = row.querySelector('.clinical-lan-assign-team');
  const cycleSelect = row.querySelector('.clinical-lan-assign-cycle');
  const teamId =
    teamSelect instanceof HTMLSelectElement ? String(teamSelect.value || '').trim() : '';
  let subAreaFraction =
    cycleSelect instanceof HTMLSelectElement ? String(cycleSelect.value || '').trim() : '';
  const userRank = String(row.dataset.userRank || 'R1');
  return { row, userId, teamId, subAreaFraction, userRank };
}

export async function handleLanAssignButtonClick(btn) {
  if (!(btn instanceof HTMLButtonElement)) return;
  const selection = readLanAssignRowSelection(btn);
  if (!selection) return;
  const { userId, teamId, subAreaFraction: initialCycle, userRank } = selection;
  let subAreaFraction = initialCycle;

  if (!userId || !teamId) {
    toast('Elige un equipo.', 'error');
    return;
  }

  const team = lanDirRt.teams.find((t) => String(t.team_id) === teamId);
  if (!subAreaFraction && team) {
    subAreaFraction = resolveMembershipCycleForUser(team, userId, userRank);
  }
  if (!subAreaFraction) {
    toast('Elige el ciclo del integrante.', 'error');
    return;
  }

  const wasMember = Boolean(
    team?.members?.some((m) => String(m.user_id || '') === userId)
  );

  btn.disabled = true;
  const ok = await handleLanAssignUserToTeam(userId, teamId, subAreaFraction);
  btn.disabled = false;
  if (!ok) return;

  toast(wasMember ? 'Ciclo actualizado.' : 'Integrante asignado al equipo.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await publishClinicalTeamsToLan();
  try {
    const lan = await import('../lan-sync.mjs');
    if (typeof lan.scheduleLiveSyncPush === 'function') lan.scheduleLiveSyncPush();
  } catch { /* LAN optional */ }
  await fetchClinicalTeamsFromDb();
  const { reloadLanUsersDirectoryAfterMutation } = await import('./teams-roster-lan-load.mjs');
  await reloadLanUsersDirectoryAfterMutation();
}
