/** LAN directorio toolbar, client-side filters, collapse persistence. */
import { CLINICAL_SALAS } from './shared.mjs';
import { escapeHtml, escapeAttr } from './shared.mjs';
import { lanDirectoryUserMatchesFilters } from './lan-directory-filters.mjs';
import { lanUsersModalBackdropEl, lanUsersModalBodyEl } from './teams-roster-lan-dom.mjs';
import {
  lanDirRt,
  LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD,
  LAN_DIRECTORY_FILTER_SELECT_IDS,
} from './teams-roster-lan-state.mjs';

function lanRankGroupKey(rank) {
  return String(rank || '').trim() || 'Otros';
}

/** @param {string} rank @param {number} userCount */
export function shouldLanRankGroupOpen(rank, userCount) {
  const key = lanRankGroupKey(rank);
  if (lanDirRt.collapsedRanks.has(key)) return false;
  if (lanDirRt.expandedRanks.has(key)) return true;
  return userCount <= LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD;
}

/** @param {HTMLElement} host */
export function captureLanDirectoryCollapseState(host) {
  host.querySelectorAll('details.clinical-lan-rank-group').forEach((el) => {
    const key = String(el.dataset.lanRankGroup || '').trim();
    if (!key) return;
    const count = Number(el.dataset.lanRankCount) || 0;
    if (el.open) {
      lanDirRt.collapsedRanks.delete(key);
      if (count > LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD) {
        lanDirRt.expandedRanks.add(key);
      }
    } else {
      lanDirRt.collapsedRanks.add(key);
      lanDirRt.expandedRanks.delete(key);
    }
  });
}

/** @param {object[]} users @param {object[]} teams */
function lanDirectorySalaFilterOptions(users, teams) {
  const salas = new Set(CLINICAL_SALAS);
  for (const u of users || []) {
    const sala = String(u?.sala || '').trim();
    if (sala) salas.add(sala);
  }
  for (const t of teams || []) {
    const sala = String(t?.sala || '').trim();
    if (sala) salas.add(sala);
  }
  return [...salas].sort((a, b) => a.localeCompare(b, 'es'));
}

export function renderLanDirectoryToolbarHtml(users, teams) {
  const salas = lanDirectorySalaFilterOptions(users, teams);
  const salaOptions = salas
    .map(
      (s) =>
        `<option value="${escapeAttr(s)}"${lanDirRt.filterSala === s ? ' selected' : ''}>${escapeHtml(s)}</option>`
    )
    .join('');
  const statusSelected = (value) => (lanDirRt.filterStatus === value ? ' selected' : '');
  const activitySelected = (value) => (lanDirRt.filterActivity === value ? ' selected' : '');
  return `
    <div class="clinical-lan-directory-toolbar">
      <label class="clinical-lan-directory-search-wrap">
        <span class="visually-hidden">Buscar usuario</span>
        <input type="search" id="clinical-lan-directory-search" class="profile-input clinical-lan-directory-search" placeholder="Buscar @usuario o nombre…" value="${escapeAttr(lanDirRt.filterQuery)}" autocomplete="off">
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Actividad</span>
        <select id="clinical-lan-directory-activity-filter" class="profile-input">
          <option value="all"${activitySelected('all')}>Todas</option>
          <option value="active"${activitySelected('active')}>Activos (24 h)</option>
          <option value="inactive"${activitySelected('inactive')}>Inactivos</option>
        </select>
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Equipo</span>
        <select id="clinical-lan-directory-status-filter" class="profile-input">
          <option value="all"${statusSelected('all')}>Todos</option>
          <option value="unassigned"${statusSelected('unassigned')}>Sin equipo</option>
          <option value="assigned"${statusSelected('assigned')}>Con equipo</option>
        </select>
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Sala</span>
        <select id="clinical-lan-directory-sala-filter" class="profile-input">
          <option value=""${lanDirRt.filterSala ? '' : ' selected'}>Todas</option>
          ${salaOptions}
        </select>
      </label>
      <span class="clinical-lan-directory-match-count" aria-live="polite"></span>
    </div>`;
}

/** @param {HTMLElement} host */
export function applyLanDirectoryFilters(host) {
  const searchEl = host.querySelector('#clinical-lan-directory-search');
  const statusEl = host.querySelector('#clinical-lan-directory-status-filter');
  const salaEl = host.querySelector('#clinical-lan-directory-sala-filter');
  const activityEl = host.querySelector('#clinical-lan-directory-activity-filter');
  const countEl = host.querySelector('.clinical-lan-directory-match-count');

  if (searchEl instanceof HTMLInputElement) lanDirRt.filterQuery = searchEl.value;
  if (statusEl instanceof HTMLSelectElement) lanDirRt.filterStatus = statusEl.value;
  if (salaEl instanceof HTMLSelectElement) lanDirRt.filterSala = salaEl.value;
  if (activityEl instanceof HTMLSelectElement) lanDirRt.filterActivity = activityEl.value;

  const filters = {
    query: lanDirRt.filterQuery,
    status: lanDirRt.filterStatus,
    sala: lanDirRt.filterSala,
    activity: lanDirRt.filterActivity,
  };

  let visible = 0;
  let total = 0;
  host.querySelectorAll('.clinical-lan-user-card').forEach((card) => {
    total += 1;
    const show = lanDirectoryUserMatchesFilters(
      {
        search: card.dataset.search || '',
        hasTeam: card.dataset.hasTeam === '1',
        sala: card.dataset.sala || '',
        activityTier: card.dataset.activityTier || 'unknown',
      },
      filters
    );
    card.hidden = !show;
    card.classList.toggle('clinical-lan-user-card--filtered-out', !show);
    if (show) visible += 1;
  });

  host.querySelectorAll('.clinical-lan-rank-group').forEach((group) => {
    const cards = group.querySelectorAll('.clinical-lan-user-card');
    let visibleInGroup = 0;
    for (const card of cards) {
      if (!card.hidden) visibleInGroup += 1;
    }
    const groupCountEl = group.querySelector('.clinical-lan-rank-group-count');
    const totalInGroup = cards.length;
    if (groupCountEl) {
      groupCountEl.textContent =
        visibleInGroup === totalInGroup ? String(totalInGroup) : `${visibleInGroup}/${totalInGroup}`;
    }
    const anyVisible = visibleInGroup > 0;
    group.hidden = !anyVisible;
    group.classList.toggle('clinical-lan-rank-group--filtered-out', !anyVisible);
  });

  if (countEl) {
    countEl.textContent =
      visible === total ? `${total} usuarios` : `Mostrando ${visible} de ${total}`;
  }
}

function runLanDirectoryFiltersFromUi() {
  const host = lanUsersModalBodyEl();
  if (host?.querySelector('.clinical-lan-rank-groups')) applyLanDirectoryFilters(host);
}

/** Re-bind filter controls after each directory render (innerHTML replaces nodes). */
export function bindLanDirectoryFilterControls(host) {
  if (!host) return;
  if (host._lanDirFilterAbort) host._lanDirFilterAbort.abort();
  const ac = new AbortController();
  host._lanDirFilterAbort = ac;
  const { signal } = ac;
  const apply = () => applyLanDirectoryFilters(host);

  const searchEl = host.querySelector('#clinical-lan-directory-search');
  if (searchEl instanceof HTMLInputElement) {
    searchEl.addEventListener('input', apply, { signal });
    searchEl.addEventListener('search', apply, { signal });
  }
  for (const id of LAN_DIRECTORY_FILTER_SELECT_IDS) {
    const el = host.querySelector(`#${id}`);
    if (el instanceof HTMLSelectElement) el.addEventListener('change', apply, { signal });
  }
}

/** One-time delegation on modal backdrop (survives panel-body innerHTML swaps). */
export function ensureLanDirectoryFilterDelegation() {
  const bd = lanUsersModalBackdropEl();
  if (!bd || bd._rpcLanDirFilterDelegated) return;
  bd._rpcLanDirFilterDelegated = true;
  bd.addEventListener('input', (ev) => {
    if (!(ev.target instanceof HTMLInputElement)) return;
    if (ev.target.id !== 'clinical-lan-directory-search') return;
    runLanDirectoryFiltersFromUi();
  });
  bd.addEventListener('change', (ev) => {
    if (!(ev.target instanceof HTMLSelectElement)) return;
    if (!LAN_DIRECTORY_FILTER_SELECT_IDS.has(ev.target.id)) return;
    runLanDirectoryFiltersFromUi();
  });
}

