/** LAN directorio HTML rendering. */
import { getCycleLetterOptionsForRank } from '../../clinico-access.mjs';
import { getClinicalOpsTrace } from '../../lan-sync-diagnostics.mjs';
import { canViewLanUserDirectory } from '../../clinical-privileges.mjs';
import { escapeHtml, escapeAttr } from './shared.mjs';
import {
  shouldLanRankGroupOpen,
  renderLanDirectoryToolbarHtml,
} from './teams-roster-lan-filters.mjs';
import { LAN_USER_RANK_ORDER } from './teams-roster-lan-state.mjs';
import { renderLanUserRowHtml } from './teams-roster-lan-row-html.mjs';

export { renderLanUserRowHtml };
export function renderLanUsersDirectoryTopButtonHtml(user) {
  if (!canViewLanUserDirectory(user)) return '';
  return `<button type="button" class="btn-med-secondary clinical-teams-open-lan-users-btn" id="btn-open-lan-users-directory">Directorio LAN</button>`;
}

/** @deprecated — use renderLanUsersDirectoryTopButtonHtml in create top bar */
export function renderLanUsersDirectoryEntryHtml(user) {
  return renderLanUsersDirectoryTopButtonHtml(user);
}

export function cycleLettersForAssign(team, userRank) {
  const service = String(team?.service || 'Sala');
  const rank = String(userRank || 'R1');
  return getCycleLetterOptionsForRank(service, rank);
}

export function renderLanAssignTeamOptionsHtml(teams, selectedTeamId) {
  const list = Array.isArray(teams) ? teams : [];
  const selected = String(selectedTeamId || '').trim();
  if (!list.length) {
    return '<option value="">— Sin equipos —</option>';
  }
  return (
    '<option value="">— Equipo —</option>' +
    list
      .map((team) => {
        const id = escapeAttr(String(team.team_id || ''));
        const label = escapeHtml(
          `${String(team.name || 'Equipo').trim()} · ${String(team.sala || '').trim() || 'Sala'}`
        );
        const members = Array.isArray(team.members) ? team.members.length : 0;
        const isSelected = selected && id === selected ? ' selected' : '';
        return `<option value="${id}"${isSelected}>${label} (${members})</option>`;
      })
      .join('')
  );
}

/** @param {string} userId @param {object[]} teams */
export function resolveLanUserPlacement(userId, teams) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  for (const team of teams || []) {
    const member = (team.members || []).find((m) => String(m.user_id || '') === uid);
    if (!member) continue;
    return {
      teamId: String(team.team_id || ''),
      teamName: String(team.name || 'Equipo').trim(),
      teamSala: String(team.sala || '').trim(),
      cycle: String(member.sub_area_fraction || '').trim(),
      rank: String(member.rank || ''),
    };
  }
  return null;
}

/** @param {object[]} users */
function groupLanUsersByRank(users) {
  /** @type {Map<string, object[]>} */
  const groups = new Map(LAN_USER_RANK_ORDER.map((rank) => [rank, []]));
  /** @type {object[]} */
  const other = [];
  for (const user of users) {
    const rank = String(user?.rank || 'R1');
    if (groups.has(rank)) groups.get(rank).push(user);
    else other.push(user);
  }
  return { groups, other };
}

/** @param {string} letter @param {string} userRank */
export function formatLanCycleOptionLabel(letter, userRank) {
  const frac = String(letter || '').trim();
  if (!frac) return '— Ciclo —';
  const rank = String(userRank || 'R1');
  if (rank === 'R2' || /^[A-F]$/i.test(frac)) return `Ciclo R2 · ${frac}`;
  if (rank === 'R1' || /[12]$/i.test(frac)) return `Subciclo R1 · ${frac}`;
  return `Ciclo · ${frac}`;
}

/** @param {object[]} users */
function renderLanDirectoryEmptyStateHtml(users) {
  const trace = getClinicalOpsTrace();
  const lastGet = trace.find(function (e) {
    return e.boundary === 'get' && e.data && e.data.ok === true;
  });
  const lastMerge = trace.find(function (e) {
    return e.boundary === 'merge';
  });
  const hostUsers = Number(lastGet?.data?.incomingUsers || 0);
  const mergeDeferred =
    lastMerge?.data?.deferred === true || lastMerge?.data?.code === 'DB_LOCKED';
  let hostHint = '';
  if (hostUsers > 0 && (!users || !users.length)) {
    if (mergeDeferred) {
      hostHint =
        '<p class="clinical-teams-empty">El anfitrión reporta <strong>' +
        hostUsers +
        '</strong> perfil(es) registrados, pero la base clínica no pudo fusionarlos (sesión bloqueada). Desbloquea la base clínica y pulsa <strong>Actualizar desde ⇄</strong>.</p>';
    } else {
      hostHint =
        '<p class="clinical-teams-empty">El anfitrión ya tiene <strong>' +
        hostUsers +
        '</strong> perfil(es) en ⇄, pero aún no aparecen en esta Mac. Con LiveSync conectado, pulsa <strong>Actualizar desde ⇄</strong>.</p>';
    }
  }
  return (
    hostHint +
    '<p class="clinical-teams-empty">Aún no hay otros @usuario en esta Mac. Cada residente debe conectarse a tu LAN, abrir <strong>⇄ → Unirse</strong> en la misma sala y guardar <strong>Mi rotación → Guardar perfil</strong>. Luego los asignas al equipo desde aquí (no hace falta que ya tengan equipo).</p>'
  );
}

/** @param {object[]} users @param {object[]} teams @param {{ canDelete?: boolean, callerUserId?: string }} [opts] */
export function renderLanUsersModalBodyHtml(users, teams, opts = {}) {
  const list = Array.isArray(users) ? users : [];
  const teamList = Array.isArray(teams) ? teams : [];
  const rowOpts = {
    canDelete: !!opts.canDelete,
    callerUserId: String(opts.callerUserId || ''),
  };

  if (!list.length) {
    return renderLanDirectoryEmptyStateHtml(list);
  }

  const { groups, other } = groupLanUsersByRank(list);

  const rankSections = LAN_USER_RANK_ORDER.map((rank) => {
    const usersInRank = groups.get(rank) || [];
    if (!usersInRank.length) return '';
    const openAttr = shouldLanRankGroupOpen(rank, usersInRank.length) ? ' open' : '';
    return `<details class="clinical-lan-rank-group"${openAttr} data-lan-rank-group="${escapeAttr(rank)}" data-lan-rank-count="${usersInRank.length}">
      <summary class="clinical-lan-rank-group-summary">
        <span class="clinical-lan-rank-group-title">${escapeHtml(rank)}</span>
        <span class="clinical-lan-rank-group-count">${usersInRank.length}</span>
      </summary>
      <div class="clinical-lan-user-cards">
        ${usersInRank.map((u) => renderLanUserRowHtml(u, teamList, rowOpts)).join('')}
      </div>
    </details>`;
  }).join('');

  const otherSection = other.length
    ? `<details class="clinical-lan-rank-group"${shouldLanRankGroupOpen('Otros', other.length) ? ' open' : ''} data-lan-rank-group="Otros" data-lan-rank-count="${other.length}">
        <summary class="clinical-lan-rank-group-summary">
          <span class="clinical-lan-rank-group-title">Otros</span>
          <span class="clinical-lan-rank-group-count">${other.length}</span>
        </summary>
        <div class="clinical-lan-user-cards">
          ${other.map((u) => renderLanUserRowHtml(u, teamList, rowOpts)).join('')}
        </div>
      </details>`
    : '';

  const teamsHint = teamList.length
    ? ''
    : '<p class="clinical-teams-empty">Crea un equipo vacío en Mi rotación para poder asignar residentes.</p>';

  return `
    <div class="clinical-lan-directory-head">
      <p class="clinical-lan-users-modal-lead">Asigna residentes a equipos activos en esta Mac. <strong>Actualizar desde ⇄</strong> trae usuarios de todas las salas (Sala 1–E, Interconsultas, UX, Eme, etc.).
        <button type="button" class="btn-med-secondary clinical-lan-directory-refresh-btn">Actualizar desde ⇄</button>
      </p>
      ${renderLanDirectoryToolbarHtml(list, teamList)}
    </div>
    ${teamsHint}
    <div class="clinical-lan-rank-groups">${rankSections}${otherSection}</div>`;
}
