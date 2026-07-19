/**
 * Guardia hoy modal — team row HTML builders.
 */
import {
  isMemberOnCallToday,
  isTeamRankOnCallToday,
  resolveMembershipCycleForUser,
} from '../clinico-access.mjs';

/** @param {object} team @param {Date} now @param {string} [viewerUserId] */
export function teamCycleOnCallLabel(team, now, viewerUserId) {
  const r1s = (team.members || []).filter((m) => m.rank === 'R1');
  const viewerOnCycle =
    viewerUserId &&
    r1s.some(
      (m) =>
        String(m.user_id) === String(viewerUserId) &&
        isMemberOnCallToday(m, team, 'R1', now)
    );
  if (viewerOnCycle) return 'Tu turno de ciclo hoy';
  if (isTeamRankOnCallToday(team, 'R1', now)) return 'Turno de ciclo hoy';
  return 'Fuera de ciclo hoy';
}

/** @param {object} member @param {object} team */
export function r1OptionLabel(member, team) {
  const name = member.clinical_name || member.username || member.user_id;
  const cycle = String(
    member.sub_area_fraction || resolveMembershipCycleForUser(team, member.user_id, 'R1') || ''
  ).trim();
  return cycle ? `${name} · ${cycle}` : String(name);
}

/** @param {object} team @param {object[]} r1Members @param {Date} now @param {string} userId @param {object[]} salaGuardiaToday */
export function defaultR1PickUserId(team, r1Members, now, userId, salaGuardiaToday) {
  const tid = String(team.team_id || '');
  const declared = (salaGuardiaToday || []).find((g) => String(g.team_id) === tid)?.user_id;
  if (declared) return String(declared);
  const onCycle = r1Members.find((m) => isMemberOnCallToday(m, team, 'R1', now));
  if (onCycle?.user_id) return String(onCycle.user_id);
  if (r1Members.some((m) => String(m.user_id) === userId)) return userId;
  return String(r1Members[0]?.user_id || '');
}

function buildR1SelectOptions(r1Members, team, now, pickUserId) {
  return r1Members
    .map((m) => {
      const label = r1OptionLabel(m, team);
      const onMemberCycle = isMemberOnCallToday(m, team, 'R1', now);
      const suffix = onMemberCycle ? ' — ciclo hoy' : '';
      const sel = String(m.user_id) === pickUserId ? ' selected' : '';
      return `<option value="${String(m.user_id)}"${sel}>${label}${suffix}</option>`;
    })
    .join('');
}

function buildViewerSelfAction(team, r1Members, rank, userId, now) {
  const isViewerR1 = rank === 'R1' && r1Members.some((m) => String(m.user_id) === userId);
  if (!isViewerR1) return '';
  const viewerOnCycle = r1Members.some(
    (m) => String(m.user_id) === userId && isMemberOnCallToday(m, team, 'R1', now)
  );
  if (viewerOnCycle) {
    return '<p class="guardia-hoy-on-cycle-note">Tu subciclo toca hoy; confirma o continúa sin guardar.</p>';
  }
  return `<button type="button" class="btn-med-secondary guardia-hoy-self-btn" data-team-id="${String(
    team.team_id
  )}">Activar guardia hoy (yo)</button>`;
}

/** @param {object} team @param {object} ctx */
export function buildGuardiaHoyTeamRowHtml(team, ctx) {
  const { now, userId, rank, salaGuardiaToday } = ctx;
  const r1Members = (team.members || []).filter((m) => m.rank === 'R1');
  if (!r1Members.length) return '';
  const cycleLabel = teamCycleOnCallLabel(team, now, userId);
  const onCycle = isTeamRankOnCallToday(team, 'R1', now);
  const pickUserId = defaultR1PickUserId(team, r1Members, now, userId, salaGuardiaToday);
  const opts = buildR1SelectOptions(r1Members, team, now, pickUserId);
  const selfAction = buildViewerSelfAction(team, r1Members, rank, userId, now);
  return `
        <div class="guardia-hoy-team-row" data-team-id="${String(team.team_id)}">
          <div class="guardia-hoy-team-head">
            <strong>${String(team.name || team.sub_area_fraction || 'Equipo')}</strong>
            <span class="guardia-hoy-cycle-badge${onCycle ? ' is-on-cycle' : ''}">${cycleLabel}</span>
          </div>
          <label class="guardia-hoy-select-label">
            R1 de guardia
            <select class="profile-input guardia-hoy-r1-select" data-team-id="${String(team.team_id)}">
              ${opts}
            </select>
          </label>
          ${selfAction}
        </div>`;
}

export function buildGuardiaHoyModalBodyHtml(salaTeams, ctx) {
  const { now } = ctx;
  const todayLetter = ctx.todayLetter;
  const dayNum = now.getDate();
  const rows = salaTeams.map((team) => buildGuardiaHoyTeamRowHtml(team, ctx)).filter(Boolean).join('');
  const cycleBanner = todayLetter
    ? `<p class="guardia-hoy-cycle-today">Hoy (día ${dayNum}) toca subciclo <strong>${todayLetter}</strong> en Sala.</p>`
    : '';
  return (
    cycleBanner +
    (rows ||
      '<p class="guardia-hoy-empty">No hay equipos R1 en esta sala. Puedes continuar y elegir R1 en cada paciente.</p>')
  );
}
