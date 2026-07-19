/**
 * LAN host patient census — full-screen modal dashboard.
 */

import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { patients } from '../../app-state.mjs';
import { getLanClientId } from './runtime.mjs';
import { purgeLanPatientFromHost } from './orchestrator.mjs';
import {
  annotateLanHostPatientRows,
  isHostPatientOwnedByOtherClient,
  isPurgeableHostCensusRow,
} from './host-patients-annotate.mjs';
import { enrichLanHostPatientRows, formatLanHostTimestamp } from './host-patients-enrich.mjs';
import { fetchLanHostCensusSnapshot } from './host-patients-snapshot.mjs';
import {
  backupAndPurgeGhostRowsFromHost,
  buildPurgeGhostsConfirmMessage,
  partitionPurgeableGhosts,
  reportGhostPurgeResult,
} from './host-patients-ghost-purge.mjs';
import {
  clearLocalPatientDeleteTombstonesAndReconcile,
  clearPatientTombstoneAndRestoreFromHost,
  countLocalPatientDeleteTombstones,
} from './host-patients-tombstone-clear.mjs';

import { esc } from '../../dom-escape.mjs';
const MODAL_ID = 'lan-host-census-modal';

function resolveDashboardToast(opts) {
  if (typeof opts?.showToast === 'function') return opts.showToast;
  return function (msg, kind) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg, kind);
    }
  };
}

function patientLabel(row) {
  const nombre = String(row?.nombre || '').trim() || 'Sin nombre';
  const reg = String(row?.registro || '').trim();
  return reg ? nombre + ' · ' + reg : nombre;
}

function locationLabel(row) {
  const parts = [];
  const sala = String(row?.sala || '').trim();
  const cama = String(row?.cama || '').trim();
  const cuarto = String(row?.cuarto || '').trim();
  if (sala) parts.push(sala);
  if (cuarto || cama) parts.push([cuarto, cama].filter(Boolean).join('-'));
  return parts.join(' · ') || '—';
}

function statusBadge(item) {
  if (item.status === 'ghost') {
    return '<span class="lan-host-census-badge lan-host-census-badge--ghost">fantasma</span>';
  }
  if (item.row?.archived || item.local?.archived) {
    return '<span class="lan-host-census-badge lan-host-census-badge--archived">archivado</span>';
  }
  if (item.row._bundleOnly) {
    return '<span class="lan-host-census-badge">solo bundle</span>';
  }
  return '<span class="lan-host-census-badge lan-host-census-badge--local">activo</span>';
}

/** @param {HTMLElement} backdrop */
function wireLanHostCensusActions(backdrop) {
  if (backdrop._lanHostCensusActionsWired) return;
  backdrop.querySelector('.lan-host-census-refresh')?.addEventListener('click', function () {
    void refreshLanHostCensusDashboard(backdrop._lanHostCensusOpts || {});
  });
  backdrop.querySelector('.lan-host-census-purge-ghosts')?.addEventListener('click', function () {
    void purgeGhostsFromDashboard(backdrop);
  });
  backdrop.querySelector('.lan-host-census-clear-tombstones')?.addEventListener('click', function () {
    void clearTombstonesFromDashboard(backdrop);
  });
  backdrop._lanHostCensusActionsWired = true;
}

/** @param {HTMLElement} backdrop */
function wireLanHostCensusToolbar(backdrop) {
  backdrop.querySelector('.lan-host-census-search')?.addEventListener('input', function () {
    if (backdrop._lanHostCensusSearchTimer) clearTimeout(backdrop._lanHostCensusSearchTimer);
    backdrop._lanHostCensusSearchTimer = setTimeout(function () {
      backdrop._lanHostCensusSearchTimer = null;
      renderLanHostCensusTable(backdrop);
    }, 120);
  });
  backdrop.querySelector('.lan-host-census-filter-inactive')?.addEventListener('change', function () {
    renderLanHostCensusTable(backdrop);
  });
  backdrop.querySelector('.lan-host-census-filter-team')?.addEventListener('change', function () {
    renderLanHostCensusTable(backdrop);
  });
}

/** @param {HTMLElement} backdrop @param {object|null|undefined} clinicalOps */
function populateTeamFilter(backdrop, clinicalOps) {
  const sel = backdrop.querySelector('.lan-host-census-filter-team');
  if (!sel) return;
  const prev = String(sel.value || '');
  const teams = (clinicalOps?.teams || [])
    .filter(function (t) {
      return t && t.team_id && !t.archived_at;
    })
    .slice()
    .sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'es');
    });
  let html = '<option value="">Todos los equipos</option>';
  html += '<option value="__none__">Sin equipo</option>';
  for (const team of teams) {
    const label = [team.name, team.service, team.sub_area_fraction].filter(Boolean).join(' · ');
    html +=
      '<option value="' + esc(String(team.team_id)) + '">' + esc(label || String(team.team_id)) + '</option>';
  }
  sel.innerHTML = html;
  if (prev && Array.from(sel.options).some(function (o) { return o.value === prev; })) {
    sel.value = prev;
  }
}

function ensureModal() {
  let backdrop = document.getElementById(MODAL_ID);
  if (backdrop) return backdrop;
  backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;
  backdrop.className = 'modal-backdrop lan-host-census-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.innerHTML =
    '<div class="modal lan-host-census-modal" role="dialog" aria-modal="true" aria-labelledby="lan-host-census-title">' +
    '<div class="lan-host-census-header">' +
    '<div>' +
    '<h3 id="lan-host-census-title" class="modal-title">Censo LAN del anfitrión</h3>' +
    '<p class="lan-host-census-subtitle">Fantasmas, archivados y huérfanos del anfitrión — por defecto solo no activos. Filtra por equipo.</p>' +
    '</div>' +
    '<button type="button" class="btn-lan-secondary lan-host-census-close-top" aria-label="Cerrar">✕</button>' +
    '</div>' +
    '<div class="lan-host-census-toolbar">' +
    '<input type="search" class="lan-host-census-search" placeholder="Buscar nombre, registro, equipo…" autocomplete="off" />' +
    '<select class="lan-host-census-filter-team" aria-label="Filtrar por equipo"></select>' +
    '<label class="lan-host-census-filter">' +
    '<input type="checkbox" class="lan-host-census-filter-inactive" checked /> Solo no activos' +
    '</label>' +
    '</div>' +
    '<p class="lan-host-census-summary"></p>' +
    '<p class="lan-host-census-status lan-connect-card-hint"></p>' +
    '<div class="lan-host-census-table-wrap">' +
    '<table class="lan-host-census-table">' +
    '<thead><tr>' +
    '<th>Paciente</th><th>Ubicación</th><th>Equipo</th><th>Registró</th><th>Actualizado</th><th>Estado</th><th></th>' +
    '</tr></thead>' +
    '<tbody class="lan-host-census-tbody"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="modal-actions lan-host-census-actions">' +
    '<button type="button" class="btn-lan-secondary lan-host-census-purge-ghosts">Eliminar fantasmas</button>' +
    '<button type="button" class="btn-lan-secondary lan-host-census-clear-tombstones">Limpiar tombstones</button>' +
    '<button type="button" class="btn-lan-secondary lan-host-census-refresh">Actualizar</button>' +
    '<button type="button" class="btn-generate lan-host-census-close">Cerrar</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', function (ev) {
    if (ev.target === backdrop) closeLanHostCensusDashboard();
  });
  backdrop.querySelector('.lan-host-census-close-top')?.addEventListener('click', closeLanHostCensusDashboard);
  backdrop.querySelector('.lan-host-census-close')?.addEventListener('click', closeLanHostCensusDashboard);
  wireLanHostCensusToolbar(backdrop);
  wireLanHostCensusActions(backdrop);

  return backdrop;
}

/** @param {object} item */
function isPurgeableDashboardRow(item) {
  return isPurgeableHostCensusRow(item, getLanClientId());
}

function purgeOptsForCensusItem(item) {
  return {
    registro: String(item?.row?.registro || '').trim(),
    bundleOnly: item?.row?._bundleOnly === true,
    hostOnly: true,
  };
}

/** @param {HTMLElement} backdrop */
function getFilteredRows(backdrop) {
  const rows = backdrop._lanHostCensusRows || [];
  const q = String(backdrop.querySelector('.lan-host-census-search')?.value || '')
    .trim()
    .toLowerCase();
  const inactiveOnly = !!backdrop.querySelector('.lan-host-census-filter-inactive')?.checked;
  const teamFilter = String(backdrop.querySelector('.lan-host-census-filter-team')?.value || '');
  return rows.filter(function (item) {
    if (inactiveOnly && !item.inactive) return false;
    if (teamFilter === '__none__' && item.teamId) return false;
    if (teamFilter && teamFilter !== '__none__' && String(item.teamId || '') !== teamFilter) return false;
    if (!q) return true;
    const hay = [
      item.row?.nombre,
      item.row?.registro,
      item.teamLabel,
      item.registrarLabel,
      locationLabel(item.row),
    ]
      .join(' ')
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  });
}

/** @param {object[]} all @param {object[]} filtered */
function buildCensusSummaryText(all, filtered) {
  const inactiveCount = all.filter(function (x) {
    return x.inactive;
  }).length;
  const ghostCount = all.filter(function (x) {
    return x.status === 'ghost';
  }).length;
  const purgeableGhostCount = all.filter(isPurgeableDashboardRow).length;
  const tombstoneCount = countLocalPatientDeleteTombstones();
  return (
    inactiveCount +
    ' no activo(s)' +
    (ghostCount ? ' · ' + ghostCount + ' fantasma(s)' : '') +
    (purgeableGhostCount < ghostCount
      ? ' · ' + (ghostCount - purgeableGhostCount) + ' de otro equipo'
      : '') +
    (tombstoneCount ? ' · ' + tombstoneCount + ' tombstone(s) local(es)' : '') +
    ' · ' +
    all.length +
    ' en anfitrión' +
    (filtered.length !== all.length ? ' · mostrando ' + filtered.length : '')
  );
}

/** @param {object} item */
function buildCensusRowHtml(item) {
  return (
    '<tr data-patient-id="' +
    esc(String(item.row.id)) +
    '">' +
    '<td class="lan-host-census-patient"><span class="lan-host-census-patient-name">' +
    esc(patientLabel(item.row)) +
    '</span></td>' +
    '<td>' +
    esc(locationLabel(item.row)) +
    '</td>' +
    '<td>' +
    esc(item.teamLabel || '—') +
    '</td>' +
    '<td class="lan-host-census-registrar" title="' +
    esc(item.row?.registeredAt ? 'Registrado: ' + formatLanHostTimestamp(item.row.registeredAt) : '') +
    '">' +
    esc(item.registrarLabel || '—') +
    '</td>' +
    '<td class="lan-host-census-updated" title="' +
    esc(item.updatedAt || '') +
    '">' +
    esc(formatLanHostTimestamp(item.updatedAt)) +
    '</td>' +
    '<td>' +
    statusBadge(item) +
    '</td>' +
    '<td class="lan-host-census-actions-cell">' +
    (item.status === 'ghost'
      ? '<button type="button" class="btn-lan-secondary lan-host-census-restore" data-patient-id="' +
        esc(String(item.row.id)) +
        '">Restaurar</button> '
      : '') +
    '<button type="button" class="btn-lan-secondary lan-host-census-delete" data-patient-id="' +
    esc(String(item.row.id)) +
    '">Eliminar</button>' +
    '</td>' +
    '</tr>'
  );
}

function wireCensusTableActions(tbody, backdrop) {
  tbody.querySelectorAll('.lan-host-census-delete').forEach(function (btn) {
    btn.addEventListener('click', function () {
      void deletePatientFromDashboard(backdrop, btn);
    });
  });
  tbody.querySelectorAll('.lan-host-census-restore').forEach(function (btn) {
    btn.addEventListener('click', function () {
      void restorePatientFromDashboard(backdrop, btn);
    });
  });
}

/** @param {HTMLElement} backdrop */
function renderLanHostCensusTable(backdrop) {
  const tbody = backdrop.querySelector('.lan-host-census-tbody');
  const summary = backdrop.querySelector('.lan-host-census-summary');
  if (!tbody) return;
  const all = backdrop._lanHostCensusRows || [];
  const filtered = getFilteredRows(backdrop);
  if (summary) summary.textContent = buildCensusSummaryText(all, filtered);
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="lan-host-census-empty">No hay pacientes que coincidan.</td></tr>';
    return;
  }
  const sorted = filtered.slice().sort(function (a, b) {
    return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
  });
  tbody.innerHTML = sorted.map(buildCensusRowHtml).join('');
  wireCensusTableActions(tbody, backdrop);
}

/** @param {HTMLElement} backdrop @param {HTMLButtonElement} btn */
async function deletePatientFromDashboard(backdrop, btn) {
  const pid = String(btn.getAttribute('data-patient-id') || '').trim();
  if (!pid) return;
  const item = (backdrop._lanHostCensusRows || []).find(function (x) {
    return String(x.row.id) === pid;
  });
  const label = item ? patientLabel(item.row) : pid;
  const opts = backdrop._lanHostCensusOpts || {};
  const showToast = resolveDashboardToast(opts);
  if (item && isHostPatientOwnedByOtherClient(item.row, getLanClientId())) {
    showToast('Este paciente pertenece a otro equipo LAN y no se puede borrar del anfitrión.', 'info');
    return;
  }
  if (
    !window.confirm(
      '¿Eliminar «' +
        label +
        '» del anfitrión LAN?\n\nSolo se quita del servidor local si ningún otro equipo lo conserva.'
    )
  ) {
    return;
  }
  btn.disabled = true;
  const res = await purgeLanPatientFromHost(pid, purgeOptsForCensusItem(item));
  if (res?.ok) {
    showToast('Paciente eliminado del anfitrión LAN.', 'success');
    if (typeof opts.onChanged === 'function') opts.onChanged();
    await refreshLanHostCensusDashboard(opts);
  } else {
    showToast(res?.error || 'No se pudo eliminar del anfitrión.', 'error');
    btn.disabled = false;
  }
}

function showPurgeGhostsEmptyToast(showToast, foreignGhostCount) {
  showToast(
    foreignGhostCount
      ? 'No hay fantasmas propios para eliminar (' + foreignGhostCount + ' pertenecen a otro equipo).'
      : 'No hay pacientes fantasma en el anfitrión.',
    'info'
  );
}

/** @param {HTMLElement} backdrop */
async function purgeGhostsFromDashboard(backdrop) {
  const opts = backdrop._lanHostCensusOpts || {};
  const showToast = resolveDashboardToast(opts);
  const rows = backdrop._lanHostCensusRows || [];
  const { ghosts, foreignGhostCount } = partitionPurgeableGhosts(rows);
  if (!ghosts.length) {
    showPurgeGhostsEmptyToast(showToast, foreignGhostCount);
    return;
  }
  const localCount = (patients || []).filter(function (p) {
    return p && p.id;
  }).length;
  if (!window.confirm(buildPurgeGhostsConfirmMessage(ghosts.length, localCount))) {
    return;
  }
  const btn = backdrop.querySelector('.lan-host-census-purge-ghosts');
  if (btn) btn.disabled = true;
  const result = await backupAndPurgeGhostRowsFromHost(rows, showToast);
  if (btn) btn.disabled = false;
  if (result.cancelled || result.empty) return;
  reportGhostPurgeResult(result.ok, result.total, result.foreignGhostCount, showToast, result.backup);
  if (result.ok && typeof opts.onChanged === 'function') opts.onChanged();
  await refreshLanHostCensusDashboard(opts);
}

/** @param {HTMLElement} backdrop */
async function clearTombstonesFromDashboard(backdrop) {
  const opts = backdrop._lanHostCensusOpts || {};
  const showToast = resolveDashboardToast(opts);
  const count = countLocalPatientDeleteTombstones();
  if (!count) {
    showToast('No hay tombstones locales de pacientes.', 'info');
    return;
  }
  if (
    !window.confirm(
      '¿Limpiar ' +
        count +
        ' tombstone(s) local(es) de borrado?\n\nEsto permite que el censo vuelva a sincronizar pacientes ocultos por un «Eliminar fantasmas» previo. No borra datos del anfitrión.'
    )
  ) {
    return;
  }
  const btn = backdrop.querySelector('.lan-host-census-clear-tombstones');
  if (btn) btn.disabled = true;
  const result = await clearLocalPatientDeleteTombstonesAndReconcile();
  if (btn) btn.disabled = false;
  if (!result.cleared) {
    showToast('No había tombstones que limpiar.', 'info');
    return;
  }
  let msg =
    result.cleared +
    ' tombstone(s) limpiado(s).';
  if (result.restored) msg += ' ' + result.restored + ' expediente(s) recuperado(s) del anfitrión.';
  showToast(msg, result.restored ? 'success' : 'warn');
  if (typeof opts.onChanged === 'function') opts.onChanged();
  await refreshLanHostCensusDashboard(opts);
}

/** @param {HTMLElement} backdrop @param {HTMLButtonElement} btn */
async function restorePatientFromDashboard(backdrop, btn) {
  const pid = String(btn.getAttribute('data-patient-id') || '').trim();
  if (!pid) return;
  const item = (backdrop._lanHostCensusRows || []).find(function (x) {
    return String(x.row.id) === pid;
  });
  const label = item ? patientLabel(item.row) : pid;
  const opts = backdrop._lanHostCensusOpts || {};
  const showToast = resolveDashboardToast(opts);
  if (
    !window.confirm(
      '¿Restaurar «' +
        label +
        '» en tu censo?\n\nSe limpian tombstones locales y se intenta recuperar el expediente del anfitrión.'
    )
  ) {
    return;
  }
  btn.disabled = true;
  const registro = String(item?.row?.registro || '').trim();
  const result = await clearPatientTombstoneAndRestoreFromHost(pid, registro);
  if (result.restored) {
    showToast('Expediente restaurado en tu censo.', 'success');
  } else if (result.restore?.error === 'patient_not_on_host') {
    showToast('Tombstones limpiados, pero el anfitrión ya no tiene este expediente.', 'warn');
  } else {
    showToast('Tombstones limpiados. Revisa el censo tras sincronizar.', 'warn');
  }
  if (typeof opts.onChanged === 'function') opts.onChanged();
  await refreshLanHostCensusDashboard(opts);
}

/**
 * @param {{ showToast?: Function, onChanged?: Function }} [opts]
 */
export async function refreshLanHostCensusDashboard(opts) {
  const backdrop = ensureModal();
  backdrop._lanHostCensusOpts = opts || {};
  const statusEl = backdrop.querySelector('.lan-host-census-status');
  const tbody = backdrop.querySelector('.lan-host-census-tbody');
  if (statusEl) statusEl.textContent = 'Cargando censo del anfitrión…';
  if (tbody) tbody.innerHTML = '';
  const snap = await fetchLanHostCensusSnapshot();
  if (!snap.ok) {
    if (statusEl) {
      statusEl.textContent =
        snap.error === 'not_configured'
          ? 'Conecta al turno LAN (⇄) para ver el censo del anfitrión.'
          : 'No se pudo cargar el censo del anfitrión.';
    }
    backdrop._lanHostCensusRows = [];
    renderLanHostCensusTable(backdrop);
    return;
  }
  const annotated = annotateLanHostPatientRows(snap.patients, patients);
  const enriched = enrichLanHostPatientRows(annotated, snap.clinicalOps, {
    localClientId: getLanClientId(),
    localUser: clinicalSessionContext.user,
  });
  backdrop._lanHostCensusRows = enriched;
  populateTeamFilter(backdrop, snap.clinicalOps);
  if (statusEl) statusEl.textContent = '';
  renderLanHostCensusTable(backdrop);
}

/** @param {HTMLElement} backdrop */
function upgradeLanHostCensusModalIfNeeded(backdrop) {
  const toolbar = backdrop.querySelector('.lan-host-census-toolbar');
  if (toolbar && !backdrop.querySelector('.lan-host-census-filter-team')) {
    toolbar.innerHTML =
      '<input type="search" class="lan-host-census-search" placeholder="Buscar nombre, registro, equipo…" autocomplete="off" />' +
      '<select class="lan-host-census-filter-team" aria-label="Filtrar por equipo"></select>' +
      '<label class="lan-host-census-filter">' +
      '<input type="checkbox" class="lan-host-census-filter-inactive" checked /> Solo no activos' +
      '</label>';
    wireLanHostCensusToolbar(backdrop);
    const sub = backdrop.querySelector('.lan-host-census-subtitle');
    if (sub) {
      sub.textContent =
        'Fantasmas, archivados y huérfanos del anfitrión — por defecto solo no activos. Filtra por equipo.';
    }
  }
  const actions = backdrop.querySelector('.lan-host-census-actions');
  if (actions && !actions.querySelector('.lan-host-census-purge-ghosts')) {
    const refreshBtn = actions.querySelector('.lan-host-census-refresh');
    const purgeBtn = document.createElement('button');
    purgeBtn.type = 'button';
    purgeBtn.className = 'btn-lan-secondary lan-host-census-purge-ghosts';
    purgeBtn.textContent = 'Eliminar fantasmas';
    if (refreshBtn) actions.insertBefore(purgeBtn, refreshBtn);
    else actions.prepend(purgeBtn);
    backdrop._lanHostCensusActionsWired = false;
  }
  if (actions && !actions.querySelector('.lan-host-census-clear-tombstones')) {
    const refreshBtn = actions.querySelector('.lan-host-census-refresh');
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-lan-secondary lan-host-census-clear-tombstones';
    clearBtn.textContent = 'Limpiar tombstones';
    if (refreshBtn) actions.insertBefore(clearBtn, refreshBtn);
    else actions.appendChild(clearBtn);
    backdrop._lanHostCensusActionsWired = false;
  }
  wireLanHostCensusActions(backdrop);
}

/**
 * @param {{ showToast?: Function, onChanged?: Function }} [opts]
 */
export async function openLanHostCensusDashboard(opts) {
  const backdrop = ensureModal();
  upgradeLanHostCensusModalIfNeeded(backdrop);
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  await refreshLanHostCensusDashboard(opts);
}

export function closeLanHostCensusDashboard() {
  const backdrop = document.getElementById(MODAL_ID);
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
}

export function isLanHostCensusDashboardOpen() {
  const backdrop = document.getElementById(MODAL_ID);
  return !!(backdrop && backdrop.classList.contains('open'));
}
