/** Mi rotación — team card HTML fragments. */
import { getClinicalScopeContextForEvaluate, clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { patients } from '../../app-state.mjs';
import { resolvePatientTeamIdFromAssignments } from '../../clinico-access.mjs';
import {
  getCycleLettersForTeamCreate,
  getCycleLetterOptionsForRank,
  formatMemberCycleLabel,
  isSalaWardService,
} from '../../clinico-access.mjs';
import { teamInviteCode } from '../../clinical-team-invite.mjs';
import { effectiveClinicalRank, canManageTeamRoster } from '../../clinical-privileges.mjs';
import { normalizeUsername } from '../../clinical-username.mjs';
import { escapeHtml, escapeAttr, CLINICAL_SALAS, renderClinicalTeamsCollapsible } from './shared.mjs';

/** @param {string} teamId @param {object[]} assignments @param {string|Date} now */
export function countLocalCensusPatientsForTeam(teamId, assignments, now) {
  const tid = String(teamId || '');
  if (!tid) return 0;
  let count = 0;
  for (const p of patients || []) {
    if (!p?.id) continue;
    if (resolvePatientTeamIdFromAssignments(String(p.id), assignments, now) === tid) count += 1;
  }
  return count;
}

/** Una línea de contexto sin repetir sala/servicio. @param {object} team */
export function renderTeamMetaLine(team) {
  const parts = [];
  const sala = String(team.sala || '').trim();
  const service = String(team.service || '').trim();
  if (sala) parts.push(sala);
  if (service && service.toLowerCase() !== 'sala') parts.push(service);
  if (!parts.length) return '';
  return `<p class="clinical-teams-card-meta">${parts.map((p) => escapeHtml(p)).join(' · ')}</p>`;
}

/** @param {number} onDevice @param {number} assignedLan */
function formatTeamPatientCountMessage(onDevice, assignedLan) {
  if (onDevice <= 0 && assignedLan > 0) {
    return assignedLan === 1
      ? '1 asignado en la red — sincronizando expediente…'
      : `${assignedLan} asignados en la red — sincronizando expedientes…`;
  }
  if (assignedLan > onDevice && assignedLan > 0) {
    const pending = assignedLan - onDevice;
    const visible = onDevice === 1 ? '1 paciente en censo' : `${onDevice} pacientes en censo`;
    const waiting =
      pending === 1
        ? '1 asignado en la red sin expediente aquí'
        : `${pending} asignados en la red sin expediente aquí`;
    return `${visible} · ${waiting}`;
  }
  return onDevice === 1 ? '1 paciente en censo' : `${onDevice} pacientes en censo`;
}

/** @param {object} team */
export function renderTeamPatientCountLine(team) {
  const teamId = String(team?.team_id || '');
  const ctx = getClinicalScopeContextForEvaluate();
  const assignments = Array.isArray(ctx?.assignments) ? ctx.assignments : [];
  const now = ctx?.now || new Date().toISOString();
  const onDevice = countLocalCensusPatientsForTeam(teamId, assignments, now);
  const assignedLan = Math.max(
    Number(team?.lanAssignmentCount) || 0,
    Number(team?.patientCount) || 0
  );

  if (onDevice <= 0 && assignedLan <= 0) return '';

  const label = formatTeamPatientCountMessage(onDevice, assignedLan);
  return `<p class="clinical-teams-card-meta clinical-teams-card-patients">${escapeHtml(label)}</p>`;
}

/**
 * @param {object} team
 * @param {string} rank
 * @param {string} [current]
 * @param {string} selectId
 */
export function renderCycleSelectForRank(team, rank, current, selectId) {
  const service = String(team.service || 'Sala');
  const id = selectId || 'clinical-cycle-select';
  const cur = String(current || '').trim();
  const letters = getCycleLetterOptionsForRank(service, rank);
  const opts = letters
    .map(
      (l) =>
        `<option value="${escapeAttr(l)}" ${l === cur ? 'selected' : ''}>${escapeHtml(l)}</option>`
    )
    .join('');
  return `<select id="${escapeAttr(id)}" class="profile-input clinical-teams-cycle-select" required>${opts}</select>`;
}

/** @param {object} team */
export function renderAddMemberCycleSelect(team) {
  const teamId = String(team.team_id || '');
  const service = String(team.service || 'Sala');
  const id = `clinical-add-cycle-${teamId}`;
  if (!isSalaWardService(service)) {
    const letters = getCycleLetterOptionsForRank(service, 'R2');
    return `<select id="${escapeAttr(id)}" class="profile-input clinical-teams-add-member-cycle" required>
      ${letters.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}
    </select>`;
  }
  const r2 = getCycleLettersForTeamCreate('Sala', 'R2');
  const r1a = getCycleLettersForTeamCreate('Sala', 'R1', 0);
  const r1b = getCycleLettersForTeamCreate('Sala', 'R1', 1);
  return `<select id="${escapeAttr(id)}" class="profile-input clinical-teams-add-member-cycle" required>
    <optgroup label="R2 · A–F">${r2.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}</optgroup>
    <optgroup label="R1 · primera línea">${r1a.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}</optgroup>
    <optgroup label="R1 · segunda línea">${r1b.map((l) => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}</optgroup>
  </select>`;
}

/** @param {object} m */
export function renderMemberRow(m) {
  const handle = escapeHtml(m.username || m.user_id);
  const name = String(m.clinical_name || '').trim();
  const rank = escapeHtml(effectiveClinicalRank({ rank: m.rank }));
  const displayName = name ? escapeHtml(name) : handle;
  const cycle = formatMemberCycleLabel(m);
  const meta = name ? `@${handle} · ${rank}` : rank;
  const cycleHtml = cycle
    ? `<span class="clinical-teams-member-cycle">${escapeHtml(cycle)}</span>`
    : '';
  return `<li class="clinical-teams-member-row">
    <span class="clinical-teams-member-row-name">${displayName}</span>
    <span class="clinical-teams-member-row-meta">${meta}${cycleHtml ? ` · ${cycleHtml}` : ''}</span>
  </li>`;
}

/** @param {object[]} members */
export function renderMembersBlock(members, { compact = false, teamId = '' } = {}) {
  const list = Array.isArray(members) ? members : [];
  const count = list.length;
  const rows = count
    ? list.map((m) => renderMemberRow(m)).join('')
    : '<li class="clinical-teams-empty clinical-teams-empty--inline">Sin integrantes</li>';
  const heading = count === 1 ? 'Integrantes (1)' : `Integrantes (${count})`;
  const listHtml = `<ul class="clinical-teams-member-rows">${rows}</ul>`;
  const tid = String(teamId || '').trim();
  if (!tid) {
    return `
    <div class="clinical-teams-card-members${compact ? ' clinical-teams-card-members--compact' : ''}">
      <h6 class="clinical-teams-members-heading">${heading}</h6>
      ${listHtml}
    </div>`;
  }
  return renderClinicalTeamsCollapsible({
    collapseKey: `card.${tid}.members`,
    defaultOpen: true,
    className: `clinical-teams-collapse--card-block clinical-teams-card-members${compact ? ' clinical-teams-card-members--compact' : ''}`,
    summaryHtml: `<span class="clinical-teams-members-heading">${heading}</span>`,
    bodyHtml: listHtml,
  });
}

/**
 * @param {object} team
 * @param {{ user_id?: string, username?: string }} user
 */
export function renderMyCycleEditBlock(team, user) {
  const teamId = String(team.team_id || '');
  const userId = String(user?.user_id || '');
  const handle = normalizeUsername(user?.username || '');
  const members = Array.isArray(team.members) ? team.members : [];
  const me = members.find((m) => {
    if (userId && String(m.user_id) === userId) return true;
    if (handle && normalizeUsername(m.username || '') === handle) return true;
    return false;
  });
  if (!me) return '';

  const rank = effectiveClinicalRank({ rank: me.rank });
  const current = String(me.sub_area_fraction || '').trim();
  const selectId = `clinical-my-cycle-${teamId}`;
  const service = String(team.service || 'Sala');
  const hint = isSalaWardService(service)
    ? rank === 'R2'
      ? 'Tu letra A–F en el ciclo de sala.'
      : rank === 'R1'
        ? 'Tu subciclo (A1–D1 o A2–D2), independiente del resto del equipo.'
        : 'Letra de rotación para este servicio.'
    : 'Letra de rotación A–D (misma para todos los rangos en este servicio).';

  const formHtml = `
      <form class="clinical-teams-my-cycle-form" data-team-id="${escapeAttr(teamId)}">
        <p class="clinical-teams-hint">${escapeHtml(hint)}</p>
        <div class="clinical-teams-my-cycle-row">
          <label class="visually-hidden" for="${escapeAttr(selectId)}">Mi ciclo</label>
          ${renderCycleSelectForRank(team, rank, current, selectId)}
          <button type="submit" class="btn-save">Guardar</button>
        </div>
      </form>`;
  return renderClinicalTeamsCollapsible({
    collapseKey: `card.${teamId}.cycle`,
    defaultOpen: true,
    className: 'clinical-teams-collapse--card-block clinical-teams-my-cycle-box',
    summaryHtml: '<span class="clinical-teams-my-cycle-title">Mi ciclo en este equipo</span>',
    bodyHtml: formHtml,
  });
}

/** @param {object} team */
export function renderLeaveTeamBox(team) {
  const teamId = escapeAttr(String(team.team_id || ''));
  const teamName = escapeAttr(String(team.name || 'este equipo'));
  return `
    <div class="clinical-teams-leave-box">
      <button type="button" class="btn-med-secondary clinical-teams-leave-btn" data-team-id="${teamId}" data-team-name="${teamName}">
        Salir del equipo
      </button>
    </div>`;
}

/** @param {object} team */
export function renderTeamManageActionsHtml(team) {
  const teamId = escapeAttr(String(team.team_id || ''));
  const teamNameAttr = escapeAttr(String(team.name || 'Equipo'));
  return `
    <div class="clinical-teams-manage-actions">
      <button type="button" class="btn-med-secondary clinical-teams-edit-btn" data-team-id="${teamId}">Editar</button>
      <button type="button" class="btn-med-secondary clinical-teams-delete-btn" data-team-id="${teamId}" data-team-name="${teamNameAttr}">Eliminar</button>
    </div>`;
}

/** @param {object} team */
export function renderTeamEditPanelHtml(team) {
  const teamId = escapeAttr(String(team.team_id || ''));
  const name = escapeHtml(String(team.name || ''));
  const sala = String(team.sala || '').trim();
  return `
    <div class="clinical-teams-edit-panel" hidden data-team-id="${teamId}">
      <form class="clinical-teams-edit-form" data-team-id="${teamId}">
        <div class="field-group">
          <label for="clinical-edit-name-${teamId}">Nombre del equipo</label>
          <input id="clinical-edit-name-${teamId}" type="text" class="profile-input clinical-teams-edit-name" value="${name}" required>
        </div>
        <div class="field-group">
          <label for="clinical-edit-sala-${teamId}">Sala</label>
          <select id="clinical-edit-sala-${teamId}" class="profile-input clinical-teams-edit-sala" required>
            ${CLINICAL_SALAS.map(
              (s) =>
                `<option value="${escapeAttr(s)}" ${sala === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="clinical-teams-edit-form-actions">
          <button type="submit" class="btn-save">Guardar cambios</button>
          <button type="button" class="btn-med-secondary clinical-teams-edit-cancel">Cancelar</button>
        </div>
      </form>
    </div>`;
}

/** @param {object} team */
export function renderTeamManageBlock(team) {
  const user = clinicalSessionContext.user || {};
  if (!canManageTeamRoster(user)) return { actionsHtml: '', editPanelHtml: '' };
  return {
    actionsHtml: renderTeamManageActionsHtml(team),
    editPanelHtml: renderTeamEditPanelHtml(team),
  };
}

/** @param {object} team @param {string} teamId */
export function renderTeamInviteCollapsible(team, teamId) {
  const tid = String(teamId || team?.team_id || '').trim();
  const inviteBody = `
        <p class="clinical-teams-invite-code-line">Código para invitar: <code class="clinical-teams-invite-code">${escapeHtml(teamInviteCode(tid))}</code></p>
        <div class="clinical-teams-invite-link-row">
          <button type="button" class="btn-med-secondary clinical-teams-copy-invite-btn" data-team-id="${escapeAttr(tid)}">Copiar invitación</button>
          <p class="clinical-teams-invite-hint">Incluye el código e instrucciones para <strong>Mi rotación</strong> en la app R+ del Mac (no Safari).</p>
        </div>
        <form class="clinical-teams-add-member-form" data-team-id="${escapeAttr(tid)}" data-team-service="${escapeAttr(team.service || '')}">
          <p class="clinical-teams-add-member-label">Agregar integrante</p>
          <div class="clinical-teams-add-member-fields">
            <div class="field-group clinical-teams-add-member-user">
              <label for="clinical-add-member-${escapeAttr(tid)}">Usuario LAN</label>
              <input id="clinical-add-member-${escapeAttr(tid)}" type="text" class="profile-input clinical-teams-add-member-input" placeholder="sin @" required aria-describedby="clinical-add-hint-${escapeAttr(tid)}">
            </div>
            <div class="field-group clinical-teams-add-cycle-group">
              <label for="clinical-add-cycle-${escapeAttr(tid)}">Ciclo del integrante</label>
              ${renderAddMemberCycleSelect(team)}
            </div>
            <button type="submit" class="btn-save clinical-teams-btn-add">Agregar</button>
          </div>
          <p class="clinical-teams-invite-hint" id="clinical-add-hint-${escapeAttr(tid)}">Debe existir en Mi rotación (usuario LAN, sin @). Cada R1/R2 lleva su propio ciclo (D1, D2, A–F).</p>
        </form>`;
  return renderClinicalTeamsCollapsible({
    collapseKey: `card.${tid}.invite`,
    defaultOpen: false,
    className: 'clinical-teams-collapse--card-block clinical-teams-invite-box',
    summaryHtml: '<span class="clinical-teams-invite-summary">Invitar y agregar integrantes</span>',
    bodyHtml: inviteBody,
  });
}

/**
 * @param {object} team
 */
export function renderJoinedTeamCard(team) {
  const user = clinicalSessionContext.user || {};
  const teamId = String(team.team_id || '');
  const members = Array.isArray(team.members) ? team.members : [];
  const manage = renderTeamManageBlock(team);

  return `
    <article class="clinical-teams-card clinical-teams-card--mine" data-team-id="${escapeAttr(teamId)}">
      <div class="clinical-teams-card-top${manage.actionsHtml ? ' clinical-teams-card-top--directory' : ''}">
        <div class="clinical-teams-card-top-text">
          <p class="clinical-teams-card-eyebrow">Residente líder</p>
          <h5 class="clinical-teams-card-title">${escapeHtml(team.name || 'Equipo')}</h5>
          ${renderTeamMetaLine(team)}
          ${renderTeamPatientCountLine(team)}
        </div>
        ${manage.actionsHtml ? `<div class="clinical-teams-card-actions">${manage.actionsHtml}</div>` : ''}
      </div>
      ${manage.editPanelHtml}
      ${renderMembersBlock(members, { teamId })}
      ${renderMyCycleEditBlock(team, user)}
      ${renderLeaveTeamBox(team)}
      ${renderTeamInviteCollapsible(team, teamId)}
    </article>`;
}

/**
 * @param {object} team
 * @param {{ joinBtnHtml?: string, joinHintHtml?: string, manageHtml?: string, editPanelHtml?: string }} [opts]
 */
export function renderDirectoryTeamCard(team, opts = {}) {
  const teamId = String(team.team_id || '');
  const members = Array.isArray(team.members) ? team.members : [];
  const joinBtn = opts.joinBtnHtml || '';
  const joinHint = opts.joinHintHtml || '';
  const manage = opts.manageHtml || '';
  const editPanel = opts.editPanelHtml || '';
  const actionButtons = [joinBtn, manage].filter(Boolean).join('');

  return `
    <article class="clinical-teams-card clinical-teams-card--directory" data-team-id="${escapeAttr(teamId)}">
      <div class="clinical-teams-card-top clinical-teams-card-top--directory">
        <div class="clinical-teams-card-top-text">
          <p class="clinical-teams-card-eyebrow">Equipo en sala</p>
          <h5 class="clinical-teams-card-title">${escapeHtml(team.name || '')}</h5>
          ${renderTeamMetaLine(team)}
          ${renderTeamPatientCountLine(team)}
        </div>
        ${actionButtons ? `<div class="clinical-teams-card-actions">${actionButtons}</div>` : ''}
      </div>
      ${joinHint ? `<p class="clinical-teams-card-join-reason">${escapeHtml(joinHint)}</p>` : ''}
      ${editPanel}
      ${renderMembersBlock(members, { compact: true, teamId })}
    </article>`;
}
