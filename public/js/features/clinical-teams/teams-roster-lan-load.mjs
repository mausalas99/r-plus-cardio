/** LAN directorio load, reload, fingerprint, draft preservation. */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { recordClinicalOpsTrace } from '../../lan-sync-diagnostics.mjs';
import { canDeleteLanDirectoryUser } from '../../clinical-privileges.mjs';
import { dbApi, escapeHtml, currentUserId } from './shared.mjs';
import { lanDirRt, LAN_DIRECTORY_IPC_MIN_MS, LAN_DIRECTORY_LAN_PULL_MIN_MS } from './teams-roster-lan-state.mjs';
import {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  isLanDirectoryModalOpen,
} from './teams-roster-lan-dom.mjs';
import {
  captureLanDirectoryCollapseState,
  applyLanDirectoryFilters,
  bindLanDirectoryFilterControls,
} from './teams-roster-lan-filters.mjs';
import { renderLanUsersModalBodyHtml } from './teams-roster-lan-render.mjs';
import {
  initLanUserRowAssignState,
  syncLanAssignCycleSelect,
} from './teams-roster-lan-assign.mjs';

/** @param {object[]} users @param {object[]} teams */
function buildLanDirectoryFingerprint(users, teams) {
  const userPart = (users || [])
    .map(
      (u) =>
        `${String(u.user_id || '')}\t${String(u.username || '')}\t${String(u.rank || '')}\t${String(u.clinical_name || '')}\t${String(u.sala || '')}\t${String(u.last_activity_at || '')}`
    )
    .sort()
    .join('\n');
  const teamPart = (teams || [])
    .map((t) => {
      const members = (t.members || [])
        .map((m) => `${String(m.user_id || '')}:${String(m.sub_area_fraction || '')}`)
        .sort()
        .join(',');
      return `${String(t.team_id || '')}\t${members}`;
    })
    .sort()
    .join('\n');
  return `${userPart}::${teamPart}`;
}

/** @param {{ forceIpc?: boolean, force?: boolean }} [options] */
export async function reloadLanUsersDirectoryPreservingUi(options = {}) {
  const host = lanUsersModalBodyEl();
  if (!host || !isLanDirectoryModalOpen()) return;
  if (!options.force && isLanDirectoryUserInteracting()) return;
  lanDirRt.lastFingerprint = '';
  captureLanDirectoryCollapseState(host);
  const draft = captureLanDirectoryDraftState(host);
  await loadLanUsersDirectoryIntoHost(host, {
    forceRender: true,
    forceIpc: options.forceIpc !== false,
  });
  restoreLanDirectoryDraftState(host, draft);
}

/** @param {HTMLElement} host @param {{ forceRender?: boolean, forceIpc?: boolean }} options */
async function fetchLanDirectoryLists(api, callerUserId) {
  return Promise.all([
    api.dbClinicalUsersList({ callerUserId }),
    typeof api.dbClinicalTeamsList === 'function' ? api.dbClinicalTeamsList() : Promise.resolve(null),
  ]);
}

function shouldSkipLanDirectoryIpcRefresh(options, host, now) {
  return (
    !options.forceIpc &&
    lanDirRt.freezeAutoRefresh &&
    now - lanDirRt.ipcLastAt < LAN_DIRECTORY_IPC_MIN_MS &&
    host.querySelector('.clinical-lan-rank-groups')
  );
}

function paintLanDirectoryHost(host, users, sessionUser) {
  host.innerHTML = renderLanUsersModalBodyHtml(users, lanDirRt.teams, {
    canDelete: canDeleteLanDirectoryUser(sessionUser),
    callerUserId: currentUserId(),
  });
  host.querySelectorAll('.clinical-lan-user-row').forEach((row) => initLanUserRowAssignState(row));
  bindLanDirectoryFilterControls(host);
  applyLanDirectoryFilters(host);
  const title = document.getElementById('clinical-lan-users-title');
  const pending = users.filter((u) => u && u.lanDirectoryPending).length;
  recordClinicalOpsTrace('display', {
    directoryCount: users.length,
    lanDirectoryPending: pending,
  });
  if (title) title.textContent = `Directorio de usuarios LAN (${users.length})`;
}

function shouldReuseLanDirectoryFingerprint(host, fingerprint, options) {
  return (
    !options.forceRender &&
    fingerprint === lanDirRt.lastFingerprint &&
    host.querySelector('.clinical-lan-rank-groups')
  );
}

async function loadLanDirectoryData_(api, callerUserId) {
  const [usersRes, teamsRes] = await fetchLanDirectoryLists(api, callerUserId);
  return { usersRes, teamsRes };
}

function renderLanDirectoryLoadError(host, message) {
  host.innerHTML = `<p class="clinical-teams-empty">${escapeHtml(message || 'No se pudo cargar el directorio.')}</p>`;
}

/** @param {HTMLElement} host @param {{ forceRender?: boolean, forceIpc?: boolean }} [options] */
export async function loadLanUsersDirectoryIntoHost(host, options = {}) {
  const now = Date.now();
  if (shouldSkipLanDirectoryIpcRefresh(options, host, now)) return;

  const api = dbApi();
  if (!api || typeof api.dbClinicalUsersList !== 'function') {
    renderLanDirectoryLoadError(
      host,
      'Directorio solo en la app de escritorio R+ (base clínica desbloqueada). En iPad/móvil usa el censo LAN; Mi rotación con directorio requiere Mac.'
    );
    return;
  }

  lanDirRt.ipcLastAt = now;
  const { usersRes, teamsRes } = await loadLanDirectoryData_(api, currentUserId());
  if (!usersRes?.ok) {
    renderLanDirectoryLoadError(host, usersRes?.error);
    return;
  }

  lanDirRt.teams = teamsRes?.ok && Array.isArray(teamsRes.teams) ? teamsRes.teams : [];
  const users = Array.isArray(usersRes.users) ? usersRes.users : [];
  const fingerprint = buildLanDirectoryFingerprint(users, lanDirRt.teams);
  if (shouldReuseLanDirectoryFingerprint(host, fingerprint, options)) {
    const title = document.getElementById('clinical-lan-users-title');
    if (title) title.textContent = `Directorio de usuarios LAN (${users.length})`;
    applyLanDirectoryFilters(host);
    return;
  }
  lanDirRt.lastFingerprint = fingerprint;
  paintLanDirectoryHost(host, users, clinicalSessionContext.user || {});
}

function isLanDirectoryUserInteracting() {
  const bd = lanUsersModalBackdropEl();
  if (!bd?.classList.contains('open')) return false;
  const active = document.activeElement;
  if (active instanceof HTMLElement && bd.contains(active)) {
    if (
      active.closest(
        '.clinical-lan-assign-team, .clinical-lan-assign-cycle, .clinical-lan-assign-btn, .clinical-lan-delete-user-btn, .clinical-lan-rank-group-summary, .clinical-lan-directory-refresh-btn, .clinical-lan-directory-search, #clinical-lan-directory-status-filter, #clinical-lan-directory-sala-filter, #clinical-lan-directory-activity-filter'
      )
    ) {
      return true;
    }
  }
  if (active instanceof HTMLSelectElement && bd.contains(active)) return true;
  if (
    active instanceof HTMLOptionElement &&
    active.parentElement instanceof HTMLSelectElement &&
    bd.contains(active.parentElement)
  ) {
    return true;
  }
  return false;
}

/** @param {HTMLElement} host */
function captureLanDirectoryDraftState(host) {
  /** @type {Map<string, { team: string, cycle: string }>} */
  const draft = new Map();
  host.querySelectorAll('.clinical-lan-user-row').forEach((row) => {
    const uid = String(row.dataset.userId || '').trim();
    if (!uid) return;
    const teamEl = row.querySelector('.clinical-lan-assign-team');
    const cycleEl = row.querySelector('.clinical-lan-assign-cycle');
    draft.set(uid, {
      team: teamEl instanceof HTMLSelectElement ? String(teamEl.value || '') : '',
      cycle: cycleEl instanceof HTMLSelectElement ? String(cycleEl.value || '') : '',
    });
  });
  return draft;
}

/** @param {HTMLElement} host @param {Map<string, { team: string, cycle: string }>} draft */
function restoreLanDirectoryDraftState(host, draft) {
  if (!draft || !draft.size) return;
  host.querySelectorAll('.clinical-lan-user-row').forEach((row) => {
    const uid = String(row.dataset.userId || '').trim();
    const saved = draft.get(uid);
    if (!saved) return;
    const teamSelect = row.querySelector('.clinical-lan-assign-team');
    if (teamSelect instanceof HTMLSelectElement && saved.team) {
      teamSelect.value = saved.team;
      syncLanAssignCycleSelect(teamSelect, saved.cycle);
      if (saved.cycle) {
        const cycleSelect = row.querySelector('.clinical-lan-assign-cycle');
        if (cycleSelect instanceof HTMLSelectElement) {
          cycleSelect.value = saved.cycle;
        }
      }
    }
  });
}

/** Manual or post-mutation reload; optional LAN pull from host. */
export async function refreshLanDirectoryFromHostUi(options = {}) {
  const host = lanUsersModalBodyEl();
  if (!host || !isLanDirectoryModalOpen()) return;
  const btn = host.querySelector('.clinical-lan-directory-refresh-btn');
  if (btn instanceof HTMLButtonElement) btn.disabled = true;
  try {
    if (options.pullFromHost !== false) {
      await pullLanDirectoryFromHostIfDue({ force: !!options.forcePull });
    }
    await reloadLanUsersDirectoryPreservingUi({ force: true, forceIpc: true });
  } finally {
    if (btn instanceof HTMLButtonElement) btn.disabled = false;
  }
}

export async function pullLanDirectoryFromHostIfDue(options = {}) {
  const force = !!options.force;
  const now = Date.now();
  if (!force && now - lanDirRt.lanPullLastAt < LAN_DIRECTORY_LAN_PULL_MIN_MS) {
    return false;
  }
  lanDirRt.lanPullLastAt = now;
  try {
    const lanMod = await import('../lan-sync.mjs');
    if (typeof lanMod.refreshLanClinicalDirectoryFromRoom !== 'function') return false;
    return !!(await lanMod.refreshLanClinicalDirectoryFromRoom({
      timeoutMs: 12_000,
      allRooms: true,
    }));
  } catch {
    return false;
  }
}
