/** Mi rotación — browse/directory section HTML. */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { canViewLanUserDirectory } from '../../clinical-privileges.mjs';
import { dbApi, escapeHtml, escapeAttr, CLINICAL_SALAS, BROWSE_SALA_LS, renderClinicalTeamsCollapsible } from './shared.mjs';
import {
  renderDirectoryTeamCard,
  renderTeamManageBlock,
} from './teams-roster-team-cards.mjs';

/** Hint when ⇄ is live but roster still shows only you (not rotación nueva). */
export async function resolveLanTeamMemberHintHtml(joinedTeams) {
  const teams = Array.isArray(joinedTeams) ? joinedTeams : [];
  if (!teams.length) return '';
  const soloTeams = teams.every((team) => {
    const members = Array.isArray(team?.members) ? team.members : [];
    return members.length <= 1;
  });
  if (!soloTeams) return '';
  try {
    const lan = await import('../lan-sync.mjs');
    if (typeof lan.isLanSessionConfiguredForRest !== 'function' || !lan.isLanSessionConfiguredForRest()) {
      return '';
    }
    const roomId =
      typeof lan.getActiveLiveSyncRoomId === 'function' ? String(lan.getActiveLiveSyncRoomId() || '').trim() : '';
    if (!roomId) {
      return `<p class="clinical-teams-section-desc clinical-teams-lan-member-hint">Abre ⇄ y pulsa <strong>Unirse</strong> en la sala de guardia. Los residentes deben conectarse a tu LAN, unirse a la misma sala y registrar <strong>@usuario</strong> antes de que puedas asignarlos a un equipo.</p>`;
    }
    const canDir = canViewLanUserDirectory(clinicalSessionContext.user || {});
    if (canDir) {
      return `<p class="clinical-teams-section-desc clinical-teams-lan-member-hint">Estás en sala ⇄ pero el directorio aún no lista a otros. Cada Mac debe usar tu enlace/código LAN, <strong>Unirse</strong> en la misma sala y <strong>Guardar perfil</strong> con @usuario; después aparecen aquí y tú los asignas al equipo (no al revés).</p>`;
    }
    return `<p class="clinical-teams-section-desc clinical-teams-lan-member-hint">En <strong>Integrantes</strong> verás compañeros cuando el admin te asigne a un equipo desde el directorio LAN. Mientras tanto: ⇄ → misma sala, @usuario guardado.</p>`;
  } catch {
    return '';
  }
}

export function resolveBrowseSala(elevated, homeSala) {
  if (!elevated) return homeSala;
  try {
    const stored = localStorage.getItem(BROWSE_SALA_LS);
    if (stored === '__all__') return '__all__';
    if (stored && CLINICAL_SALAS.includes(stored)) return stored;
  } catch (_e) { void _e; }
  if (!homeSala) return '__all__';
  return homeSala;
}

/** @param {boolean} elevated @param {string} browseSala */
function buildDirectorySectionTitle(elevated, browseSala) {
  if (!elevated) return `Otros equipos · ${escapeHtml(browseSala)}`;
  if (browseSala === '__all__') return 'Explorar · todas las salas';
  return `Explorar · ${escapeHtml(browseSala)}`;
}

/** @param {boolean} elevated @param {string} browseSala */
function buildDirectoryBrowseControl(elevated, browseSala) {
  if (!elevated) return '';
  return `<label class="clinical-teams-browse-label" for="clinical-browse-sala">Sala</label>
        <select id="clinical-browse-sala" class="profile-input clinical-teams-browse-select" aria-label="Explorar equipos por sala">
          ${CLINICAL_SALAS.map(
            (s) =>
              `<option value="${escapeAttr(s)}" ${browseSala === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
          ).join('')}
          <option value="__all__" ${browseSala === '__all__' ? 'selected' : ''}>Todas las salas</option>
        </select>`;
}

/** @param {object} team @param {boolean} elevated */
function renderDirectoryTeamEntry(team, elevated) {
  const teamId = String(team.team_id || '');
  let joinBtn = '';
  let joinHint = '';
  if (team.joinEligible) {
    joinBtn = `<button type="button" class="btn-med-secondary clinical-teams-join-btn" data-team-id="${escapeAttr(teamId)}">Unirme</button>`;
    if (team.joinWarning) joinHint = String(team.joinWarning);
  } else if (team.joinReason) {
    joinHint = String(team.joinReason);
  }
  const manage = elevated ? renderTeamManageBlock(team) : { actionsHtml: '', editPanelHtml: '' };
  return renderDirectoryTeamCard(team, {
    joinBtnHtml: joinBtn,
    joinHintHtml: joinHint,
    manageHtml: manage.actionsHtml,
    editPanelHtml: manage.editPanelHtml,
  });
}

/**
 * @param {{ userId: string, elevated: boolean, browseSala: string, homeSala: string }} opts
 */
export async function renderDirectorySectionHtml(opts) {
  const { userId, elevated, browseSala, homeSala } = opts;
  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamsListBySala !== 'function') return '';

  const listOpts =
    elevated && browseSala === '__all__'
      ? { sala: '', forUserId: userId, allSalas: true }
      : { sala: browseSala || homeSala, forUserId: userId };

  const res = await api.dbClinicalTeamsListBySala(listOpts);
  const directory = (res?.ok && Array.isArray(res.teams) ? res.teams : []).filter((t) => !t.isMember);
  const browseControl = buildDirectoryBrowseControl(elevated, browseSala);
  const sectionTitle = buildDirectorySectionTitle(elevated, browseSala || homeSala);
  const sectionIntro = `
        <h4 class="clinical-teams-section-title">${sectionTitle}</h4>
        <p class="clinical-teams-section-desc">Equipos de la sala a los que puedes unirte.</p>`;
  const headRow = browseControl
    ? `<div class="clinical-teams-section-head-row clinical-teams-collapse-summary-head">
        <div class="clinical-teams-section-intro">${sectionIntro}</div>
        <div class="clinical-teams-collapse-summary-actions">${browseControl}</div>
      </div>`
    : `<div class="clinical-teams-section-intro">${sectionIntro}</div>`;

  if (!directory.length) {
    const label =
      browseSala === '__all__' ? 'ninguna sala' : escapeHtml(String(browseSala || homeSala));
    const emptyMsg = elevated
      ? `No hay otros equipos en ${label}. Los tuyos aparecen arriba.`
      : `No hay otros equipos disponibles en ${label}.`;
    return `<section class="clinical-teams-section clinical-teams-section--directory">
      ${renderClinicalTeamsCollapsible({
        collapseKey: 'section.directory',
        defaultOpen: true,
        className: 'clinical-teams-collapse--section',
        summaryHtml: headRow,
        bodyHtml: `<p class="clinical-teams-empty">${emptyMsg}</p>`,
      })}
    </section>`;
  }

  const cards = directory.map((team) => renderDirectoryTeamEntry(team, elevated)).join('');

  return `
    <section class="clinical-teams-section clinical-teams-section--directory">
      ${renderClinicalTeamsCollapsible({
        collapseKey: 'section.directory',
        defaultOpen: true,
        className: 'clinical-teams-collapse--section',
        summaryHtml: headRow,
        bodyHtml: `<div class="clinical-teams-list">${cards}</div>`,
      })}
    </section>`;
}
