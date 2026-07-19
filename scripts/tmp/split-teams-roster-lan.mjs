#!/usr/bin/env node
/**
 * Split teams-roster-lan.mjs into submodules (debt campaign).
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public/js/features/clinical-teams');

function write(name, body) {
  const p = path.join(DIR, name);
  fs.writeFileSync(p, body.endsWith('\n') ? body : `${body}\n`);
  console.log(name, fs.readFileSync(p, 'utf8').split('\n').length, 'lines');
}

write(
  'teams-roster-lan-state.mjs',
  `/** LAN directorio mutable runtime state. */
export const lanDirRt = {
  teams: [],
  collapsedRanks: new Set(),
  expandedRanks: new Set(),
  lastFingerprint: '',
  lanPullLastAt: 0,
  ipcLastAt: 0,
  freezeAutoRefresh: false,
  filterQuery: '',
  filterStatus: 'all',
  filterSala: '',
  filterActivity: 'all',
};

export const LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD = 4;
export const LAN_DIRECTORY_LAN_PULL_MIN_MS = 30_000;
export const LAN_DIRECTORY_IPC_MIN_MS = 4_000;

export const LAN_DIRECTORY_FILTER_SELECT_IDS = new Set([
  'clinical-lan-directory-status-filter',
  'clinical-lan-directory-sala-filter',
  'clinical-lan-directory-activity-filter',
]);

export const LAN_USER_RANK_ORDER = ['R1', 'R2', 'R3', 'R4', 'Admin'];
`
);

write(
  'teams-roster-lan-dom.mjs',
  `/** LAN directorio modal DOM accessors. */

export function lanUsersModalBackdropEl() {
  return document.getElementById('clinical-lan-users-backdrop');
}

export function lanUsersModalBodyEl() {
  return document.getElementById('clinical-lan-users-panel-body');
}

export function isLanDirectoryModalOpen() {
  const bd = lanUsersModalBackdropEl();
  return !!(bd && bd.classList.contains('open'));
}
`
);

write(
  'teams-roster-lan-filters.mjs',
  `/** LAN directorio toolbar, client-side filters, collapse persistence. */
import { CLINICAL_SALAS } from './shared.mjs';
import { escapeHtml, escapeAttr } from './shared.mjs';
import { lanDirectoryUserMatchesFilters } from './lan-directory-filters.mjs';
import { lanUsersModalBodyEl } from './teams-roster-lan-dom.mjs';
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
        \`<option value="\${escapeAttr(s)}"\${lanDirRt.filterSala === s ? ' selected' : ''}>\${escapeHtml(s)}</option>\`
    )
    .join('');
  const statusSelected = (value) => (lanDirRt.filterStatus === value ? ' selected' : '');
  const activitySelected = (value) => (lanDirRt.filterActivity === value ? ' selected' : '');
  return \`
    <div class="clinical-lan-directory-toolbar">
      <label class="clinical-lan-directory-search-wrap">
        <span class="visually-hidden">Buscar usuario</span>
        <input type="search" id="clinical-lan-directory-search" class="profile-input clinical-lan-directory-search" placeholder="Buscar @usuario o nombre…" value="\${escapeAttr(lanDirRt.filterQuery)}" autocomplete="off">
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Actividad</span>
        <select id="clinical-lan-directory-activity-filter" class="profile-input">
          <option value="all"\${activitySelected('all')}>Todas</option>
          <option value="active"\${activitySelected('active')}>Activos (24 h)</option>
          <option value="inactive"\${activitySelected('inactive')}>Inactivos</option>
        </select>
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Equipo</span>
        <select id="clinical-lan-directory-status-filter" class="profile-input">
          <option value="all"\${statusSelected('all')}>Todos</option>
          <option value="unassigned"\${statusSelected('unassigned')}>Sin equipo</option>
          <option value="assigned"\${statusSelected('assigned')}>Con equipo</option>
        </select>
      </label>
      <label class="clinical-lan-directory-filter">
        <span class="clinical-lan-directory-filter-label">Sala</span>
        <select id="clinical-lan-directory-sala-filter" class="profile-input">
          <option value=""\${lanDirRt.filterSala ? '' : ' selected'}>Todas</option>
          \${salaOptions}
        </select>
      </label>
      <span class="clinical-lan-directory-match-count" aria-live="polite"></span>
    </div>\`;
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
        visibleInGroup === totalInGroup ? String(totalInGroup) : \`\${visibleInGroup}/\${totalInGroup}\`;
    }
    const anyVisible = visibleInGroup > 0;
    group.hidden = !anyVisible;
    group.classList.toggle('clinical-lan-rank-group--filtered-out', !anyVisible);
  });

  if (countEl) {
    countEl.textContent =
      visible === total ? \`\${total} usuarios\` : \`Mostrando \${visible} de \${total}\`;
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
    const el = host.querySelector(\`#\${id}\`);
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

import { lanUsersModalBackdropEl } from './teams-roster-lan-dom.mjs';
`
);

// Fix import order in filters file - move dom import to top
const filtersPath = path.join(DIR, 'teams-roster-lan-filters.mjs');
let filtersBody = fs.readFileSync(filtersPath, 'utf8');
filtersBody = filtersBody.replace(
  `import { lanUsersModalBodyEl } from './teams-roster-lan-dom.mjs';`,
  `import { lanUsersModalBackdropEl, lanUsersModalBodyEl } from './teams-roster-lan-dom.mjs';`
);
filtersBody = filtersBody.replace(/\nimport \{ lanUsersModalBackdropEl \} from '\.\/teams-roster-lan-dom\.mjs';\n$/, '\n');
fs.writeFileSync(filtersPath, filtersBody);

const src = fs.readFileSync(path.join(DIR, 'teams-roster-lan.mjs'), 'utf8');
const lines = src.split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// render block: cycleLetters through renderLanUsersModalBodyHtml (335-575) + top buttons (76-85)
const renderBody = [
  slice(76, 85),
  slice(152, 167),
  slice(335, 575),
].join('\n\n');

write(
  'teams-roster-lan-render.mjs',
  `/** LAN directorio HTML rendering. */
import { getCycleLetterOptionsForRank } from '../../clinico-access.mjs';
import { getClinicalOpsTrace } from '../../lan-sync-diagnostics.mjs';
import { canViewLanUserDirectory } from '../../clinical-privileges.mjs';
import { isValidUsernameFormat, normalizeUsername } from '../../clinical-username.mjs';
import {
  clinicalUserActivityTier,
  clinicalUserActivityLabel,
  formatClinicalUserLastActivity,
} from '../../../../lib/clinical-user-activity.mjs';
import { escapeHtml, escapeAttr } from './shared.mjs';
import {
  shouldLanRankGroupOpen,
  renderLanDirectoryToolbarHtml,
} from './teams-roster-lan-filters.mjs';
import { LAN_USER_RANK_ORDER } from './teams-roster-lan-state.mjs';

${renderBody
  .replace(/^export function renderLanUsersDirectoryTopButtonHtml/gm, 'export function renderLanUsersDirectoryTopButtonHtml')
  .replace(/^function /gm, 'function ')
  .replace(/^export function renderLanUsersDirectoryEntryHtml/gm, 'export function renderLanUsersDirectoryEntryHtml')}
`
);

write(
  'teams-roster-lan-assign.mjs',
  `/** LAN directorio team assign / delete handlers. */
import { fetchClinicalTeamsFromDb } from '../../clinical-access-runtime.mjs';
import { resolveMembershipCycleForUser } from '../../clinico-access.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';
import { dbApi, toast, currentUserId, escapeHtml, escapeAttr } from './shared.mjs';
import { lanDirRt } from './teams-roster-lan-state.mjs';
import {
  cycleLettersForAssign,
  formatLanCycleOptionLabel,
} from './teams-roster-lan-render.mjs';

${slice(577, 719)}
`
);

write(
  'teams-roster-lan-load.mjs',
  `/** LAN directorio load, reload, fingerprint, draft preservation. */
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

${slice(721, 925).replace(/^export async function loadLanUsersDirectoryIntoHost/gm, 'export async function loadLanUsersDirectoryIntoHost').replace(/^export async function refreshLanDirectoryFromHostUi/gm, 'export async function refreshLanDirectoryFromHostUi').replace(/_lanUsersModalTeams/g, 'lanDirRt.teams').replace(/lastLanDirectoryFingerprint/g, 'lanDirRt.lastFingerprint').replace(/lanDirectoryIpcLastAt/g, 'lanDirRt.ipcLastAt').replace(/lanDirectoryFreezeAutoRefresh/g, 'lanDirRt.freezeAutoRefresh').replace(/lanDirectoryLanPullLastAt/g, 'lanDirRt.lanPullLastAt')}
`
);

write(
  'teams-roster-lan-modal.mjs',
  `/** LAN directorio modal open/close. */
import { clinicalSessionContext, touchClinicalSessionActivity } from '../../clinical-access-runtime.mjs';
import { canViewLanUserDirectory } from '../../clinical-privileges.mjs';
import { flushPendingClinicalOpsLanSnapshot } from '../../clinical-ops-lan.mjs';
import { toast, escapeHtml } from './shared.mjs';
import { lanDirRt } from './teams-roster-lan-state.mjs';
import {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
} from './teams-roster-lan-dom.mjs';
import { ensureLanDirectoryFilterDelegation } from './teams-roster-lan-filters.mjs';
import {
  loadLanUsersDirectoryIntoHost,
  pullLanDirectoryFromHostIfDue,
} from './teams-roster-lan-load.mjs';

${slice(927, 982).replace(/lastLanDirectoryFingerprint/g, 'lanDirRt.lastFingerprint').replace(/lanDirectoryFreezeAutoRefresh/g, 'lanDirRt.freezeAutoRefresh')}
`
);

// Export pullLanDirectoryFromHostIfDue from load module (was private)
let loadBody = fs.readFileSync(path.join(DIR, 'teams-roster-lan-load.mjs'), 'utf8');
loadBody = loadBody.replace(
  'async function pullLanDirectoryFromHostIfDue',
  'export async function pullLanDirectoryFromHostIfDue'
);
fs.writeFileSync(path.join(DIR, 'teams-roster-lan-load.mjs'), loadBody);

write(
  'teams-roster-lan-wire.mjs',
  `/** LAN directorio control wiring. */
import { getClinicalTeamsPanelHost } from '../clinical-panel-host.mjs';
import {
  LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD,
  lanDirRt,
} from './teams-roster-lan-state.mjs';
import {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  isLanDirectoryModalOpen,
} from './teams-roster-lan-dom.mjs';
import {
  ensureLanDirectoryFilterDelegation,
  bindLanDirectoryFilterControls,
} from './teams-roster-lan-filters.mjs';
import {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
} from './teams-roster-lan-modal.mjs';
import {
  reloadLanUsersDirectoryPreservingUi,
  refreshLanDirectoryFromHostUi,
} from './teams-roster-lan-load.mjs';
import {
  syncLanAssignCycleSelect,
  handleLanDeleteDirectoryUserClick,
  handleLanAssignButtonClick,
} from './teams-roster-lan-assign.mjs';

${slice(984, 1082).replace(/lanDirectoryCollapsedRanks/g, 'lanDirRt.collapsedRanks').replace(/lanDirectoryExpandedRanks/g, 'lanDirRt.expandedRanks')}
`
);

// Export reloadLanUsersDirectoryPreservingUi from load (used by wire)
loadBody = fs.readFileSync(path.join(DIR, 'teams-roster-lan-load.mjs'), 'utf8');
loadBody = loadBody.replace(
  'async function reloadLanUsersDirectoryPreservingUi',
  'export async function reloadLanUsersDirectoryPreservingUi'
);
fs.writeFileSync(path.join(DIR, 'teams-roster-lan-load.mjs'), loadBody);

// Export helpers from render used by assign
let renderBodyFile = fs.readFileSync(path.join(DIR, 'teams-roster-lan-render.mjs'), 'utf8');
renderBodyFile = renderBodyFile
  .replace(/^function cycleLettersForAssign/m, 'export function cycleLettersForAssign')
  .replace(/^function resolveLanUserPlacement/m, 'export function resolveLanUserPlacement')
  .replace(/^function formatLanCycleOptionLabel/m, 'export function formatLanCycleOptionLabel')
  .replace(/^function renderLanUsersModalBodyHtml/m, 'export function renderLanUsersModalBodyHtml');
fs.writeFileSync(path.join(DIR, 'teams-roster-lan-render.mjs'), renderBodyFile);

// Export assign helpers used by load/wire
let assignBody = fs.readFileSync(path.join(DIR, 'teams-roster-lan-assign.mjs'), 'utf8');
assignBody = assignBody
  .replace(/^function syncLanAssignCycleSelect/m, 'export function syncLanAssignCycleSelect')
  .replace(/^function initLanUserRowAssignState/m, 'export function initLanUserRowAssignState')
  .replace(/^async function handleLanDeleteDirectoryUserClick/m, 'export async function handleLanDeleteDirectoryUserClick')
  .replace(/^async function handleLanAssignButtonClick/m, 'export async function handleLanAssignButtonClick')
  .replace(/_lanUsersModalTeams/g, 'lanDirRt.teams')
  .replace(
    /await reloadLanUsersDirectoryAfterMutation\(\);/g,
    "const { reloadLanUsersDirectoryAfterMutation } = await import('./teams-roster-lan-load.mjs');\n  await reloadLanUsersDirectoryAfterMutation();"
  );
fs.writeFileSync(path.join(DIR, 'teams-roster-lan-assign.mjs'), assignBody);

write(
  'teams-roster-lan.mjs',
  `/** Mi rotación — LAN users directory (barrel). */
export {
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  isLanDirectoryModalOpen,
} from './teams-roster-lan-dom.mjs';

export {
  renderLanUsersDirectoryTopButtonHtml,
  renderLanUsersDirectoryEntryHtml,
} from './teams-roster-lan-render.mjs';

export {
  loadLanUsersDirectoryIntoHost,
  refreshLanDirectoryFromHostUi,
} from './teams-roster-lan-load.mjs';

export {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
} from './teams-roster-lan-modal.mjs';

export { wireLanUsersDirectoryControls } from './teams-roster-lan-wire.mjs';
`
);

console.log('teams-roster-lan split done');
